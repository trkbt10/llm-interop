/**
 * @file Code block processor
 */
import type { MarkdownParseEvent } from "../types";
import type { ParserState, BlockState } from "../parser-state";

/**
 * Process active code block, looking for end marker or accumulating content
 */
export async function* processCodeBlock(
  state: ParserState,
  activeCodeBlock: BlockState,
): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  const remaining = state.buffer.slice(state.processedIndex);
  // Build end marker pattern based on the opening fence (supports ``` and ```` etc.)
  const endMarker = activeCodeBlock.endMarker ?? "```";
  const endRegex = new RegExp(`^${endMarker}\\s*$`, "m");
  const endMatch = remaining.match(endRegex);

  if (endMatch && endMatch.index !== undefined) {
    // Extract content up to end marker
    const content = remaining.slice(0, endMatch.index);
    activeCodeBlock.content += content;

    // Emit final content (trim outer whitespace but keep internal newlines)
    yield {
      type: "end",
      elementId: activeCodeBlock.id,
      finalContent: activeCodeBlock.content.trim(),
    };

    // Remove from active blocks
    state.activeBlocks = state.activeBlocks.filter((b) => b.id !== activeCodeBlock.id);
    state.processedIndex += content.length + endMatch[0].length;

    // Skip newline after closing ```
    if (state.buffer[state.processedIndex] === "\n") {
      state.processedIndex++;
    }
    return;
  }
  {
    // Accumulate content, emit deltas on newlines
    const nextNewline = remaining.indexOf("\n");
    if (nextNewline > 0) {
      const chunk = remaining.slice(0, nextNewline + 1);
      activeCodeBlock.content += chunk;
      state.processedIndex += chunk.length;

      // Emit only the incremental chunk for delta (not the accumulated content)
      yield {
        type: "delta",
        elementId: activeCodeBlock.id,
        content: chunk,
      };
      return;
    }

    if (remaining.length > 0) {
      // No newline yet, buffer all remaining content and emit as delta (incremental)
      activeCodeBlock.content += remaining;
      state.processedIndex += remaining.length;
      yield {
        type: "delta",
        elementId: activeCodeBlock.id,
        content: remaining,
      };
    }
  }
}

