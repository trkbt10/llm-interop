/**
 * @file Streaming markdown parser with both function-based and class-based APIs
 * Provides backward compatibility while using the new modular implementation
 */

import type { MarkdownParseEvent, MarkdownParserConfig } from "./types";

import { createParserState } from "./parser-state";
import { processCodeBlock, processNonCodeBlock } from "./block-processors";
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
      const activeCodeBlock = state.activeBlocks.find((b) => b.type === "code");

      if (activeCodeBlock) {
        yield* processCodeBlock(state, activeCodeBlock);
        continue;
      }

      yield* processNonCodeBlock(state);
    }

    cleanupBuffer(state);
  }

  async function* complete(): AsyncGenerator<MarkdownParseEvent, void, unknown> {
    // Close all remaining active blocks
    for (const block of state.activeBlocks) {
      yield {
        type: "end",
        elementId: block.id,
        finalContent: state.processBlockContent(block),
      };
    }

    state.reset();
  }

  function reset(): void {
    state.reset();
  }

  return {
    processChunk,
    complete,
    reset,
    state, // Expose state for debugging/testing
  };
}
