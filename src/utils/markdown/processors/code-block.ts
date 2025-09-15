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
  const endMarker = activeCodeBlock.endMarker ?? "```";
  // Exact-length closing fence on its own line (allow trailing spaces)
  const endRegex = new RegExp(`^${endMarker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*$`, "m");
  const endMatch = remaining.match(endRegex);

  if (endMatch && endMatch.index !== undefined) {
    // Content up to closing fence
    const content = remaining.slice(0, endMatch.index);
    if (content.length > 0) {
      activeCodeBlock.content += content;
    }
    // Finish block (no extra delta at close)
    yield { type: "end", elementId: activeCodeBlock.id, finalContent: activeCodeBlock.content.trim() };
    state.activeBlocks = state.activeBlocks.filter((b) => b.id !== activeCodeBlock.id);
    state.processedIndex += content.length + endMatch[0].length;
    // Skip single newline after closing fence
    if (state.buffer[state.processedIndex] === "\n") {
      state.processedIndex++;
    }
    return;
  }

  // Streaming: emit per-line; if no newline, emit tail
  const nextNewline = remaining.indexOf("\n");
  if (nextNewline > 0) {
    const chunk = remaining.slice(0, nextNewline + 1);
    activeCodeBlock.content += chunk;
    state.processedIndex += chunk.length;
    yield { type: "delta", elementId: activeCodeBlock.id, content: chunk };
    return;
  }
  if (remaining.length > 0) {
    activeCodeBlock.content += remaining;
    state.processedIndex += remaining.length;
    yield { type: "delta", elementId: activeCodeBlock.id, content: remaining };
  }
}
