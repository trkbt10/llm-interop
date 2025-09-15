/**
 * @file Streaming markdown parser with both function-based and class-based APIs
 * Provides backward compatibility while using the new modular implementation
 */

import type { MarkdownParseEvent, MarkdownParserConfig } from "./types";
import type { BlockState } from "./parser-state";

import { createParserState } from "./parser-state";
import { processCodeBlock, processNonCodeBlock } from "./block-processors";
import { detectBlock } from "./block-detectors";
import { cleanupBuffer } from "./parser-utils";

/**
 * Creates a streaming markdown parser for real-time content processing and UI updates.
 * Enables progressive parsing of markdown content as it arrives from LLM responses,
 * allowing applications to display formatted content immediately rather than waiting
 * for complete responses. Essential for responsive streaming chat interfaces.
 *
 * @param config - Parser configuration for customizing block detection and processing
 * @returns Parser instance with chunk processing, completion, and reset capabilities
 */
export function createStreamingMarkdownParser(config: MarkdownParserConfig = {}) {
  const state = createParserState(config);

  async function* processChunk(text: string): AsyncGenerator<MarkdownParseEvent, void, unknown> {
    state.buffer += text;

    while (state.processedIndex < state.buffer.length) {
      // Prefer the innermost active code block (stack top) for nested fences
      let activeCodeBlock: BlockState | undefined;
      for (let i = state.activeBlocks.length - 1; i >= 0; i--) {
        const b = state.activeBlocks[i];
        if (b.type === "code") {
          activeCodeBlock = b;
          break;
        }
      }

      if (activeCodeBlock) {
        // When inside a code fence, process it exclusively
        yield* processCodeBlock(state, activeCodeBlock);
        continue;
      }
      // Open a text paragraph when no block is active and current char is plain text
      if (state.activeBlocks.length === 0) {
        const remaining = state.buffer.slice(state.processedIndex);
        if (remaining.length > 0 && remaining[0] !== "\n") {
          const maybeBlock = detectBlock(remaining);
          if (!maybeBlock) {
            const id = state.generateId();
            yield { type: "begin", elementType: "text", elementId: id };
            state.activeBlocks.push({
              id,
              type: "text",
              content: "",
              startMarker: "",
              endMarker: undefined,
              contentStartIndex: state.processedIndex,
              lastEmittedLength: 0,
            });
          }
        }
      }
      yield* processNonCodeBlock(state);
    }

    // Flush tail pieces smaller than maxDeltaChunkSize so callers don't need complete()
    for (const block of state.activeBlocks) {
      if (block.type === "code" || block.type === "list" || block.type === "quote") {
        continue;
      }
      const transformed = state.transformBlockContent(block);
      const already = block.lastEmittedLength ?? 0;
      let remainder = transformed.slice(already);
      if (remainder.length === 0) {
        continue;
      }
      // For plain text paragraphs, don't emit trailing newline to keep parity with trimmed finalContent
      if (block.type === "text" && remainder.endsWith("\n")) {
        remainder = remainder.slice(0, -1);
      }
      if (remainder.length > 0) {
        yield { type: "delta", elementId: block.id, content: remainder };
      }
      // Mark all content as emitted (including any suppressed trailing newline)
      block.lastEmittedLength = transformed.length;
    }

    cleanupBuffer(state);
  }

  async function* complete(): AsyncGenerator<MarkdownParseEvent, void, unknown> {
    // Flush any remaining buffered content as deltas, then close blocks
    for (const block of state.activeBlocks) {
      const transformed = state.transformBlockContent(block);
      const already = block.lastEmittedLength ?? 0;
      const remainder = transformed.slice(already);
      if (remainder.length > 0) {
        // Emit a final delta for the remainder in one chunk
        yield { type: "delta", elementId: block.id, content: remainder };
      }
      yield { type: "end", elementId: block.id, finalContent: state.processBlockContent(block) };
    }

    state.reset();
  }

  async function* processStream(
    source: AsyncIterable<string>,
  ): AsyncGenerator<MarkdownParseEvent, void, unknown> {
    for await (const chunk of source) {
      if (!chunk) {
        continue;
      }
      yield* processChunk(chunk);
    }
    yield* complete();
  }

  function reset(): void {
    state.reset();
  }

  return {
    processChunk,
    processStream,
    complete,
    reset,
    state, // Expose state for debugging/testing
  };
}
