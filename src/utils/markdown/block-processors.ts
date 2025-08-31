/**
 * @file Block processing functions for streaming markdown parser
 * Handles the logic for processing different block types
 */

import type { MarkdownParseEvent, MarkdownElementType } from "./types";
import type { ParserState, BlockState } from "./parser-state";
import { detectBlock, detectLink, detectDoubleNewline, detectQuoteContinuation } from "./block-detectors";
import { parseTable } from "./table-detector";
import { findAllInlineEmphasis } from "./emphasis-detector";

/**
 * Process active code block, looking for end marker or accumulating content
 */
export async function* processCodeBlock(
  state: ParserState,
  activeCodeBlock: BlockState,
): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  const remaining = state.buffer.slice(state.processedIndex);
  const endMatch = remaining.match(/^```\s*$/m);

  if (endMatch && endMatch.index !== undefined) {
    // Extract content up to end marker
    const content = remaining.slice(0, endMatch.index);
    activeCodeBlock.content += content;

    // Emit final content
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

/**
 * Process text when no code block is active, detecting new blocks or links
 */
export async function* processNonCodeBlock(state: ParserState): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  const remaining = state.buffer.slice(state.processedIndex);
  const isLineStart = state.processedIndex === 0 || state.buffer[state.processedIndex - 1] === "\n";
  const hasActive = state.activeBlocks.length > 0;

  // Try to detect a new block at line start
  const detected = isLineStart ? detectBlock(remaining) : undefined;
  if (detected) {
    // If we're already inside a paragraph-style block (quote/list),
    // treat subsequent markers as continuation rather than opening new blocks.
    const shouldSkipQuoteMarker =
      detected.type === "quote" ? state.activeBlocks.some((b) => b.type === "quote") : false;
    const shouldSkipListMarker = detected.type === "list" ? state.activeBlocks.some((b) => b.type === "list") : false;

    if (shouldSkipQuoteMarker || shouldSkipListMarker) {
      // Consume the marker without emitting a new begin event.
      state.processedIndex += detected.matchLength;
      return;
    }

    // If a generic text paragraph is active, close it before starting a new block
    if (hasActive) {
      const textBlocks = state.activeBlocks.filter((b) => b.type === "text");
      for (const block of textBlocks) {
        // Flush any remaining transformed content as finalContent
        yield {
          type: "end",
          elementId: block.id,
          finalContent: state.processBlockContent(block),
        };
      }
      // Remove closed text blocks from active list
      state.activeBlocks = state.activeBlocks.filter((b) => b.type !== "text");
    }

    yield* handleDetectedBlock(state, detected, remaining);
    return;
  }

  // Check for links (inline annotations)
  const linkMatch = detectLink(remaining);
  if (linkMatch) {
    yield {
      type: "annotation",
      elementId: "text",
      annotation: {
        type: "url_citation",
        title: linkMatch.title,
        url: linkMatch.url,
        start_index: state.processedIndex + linkMatch.startIndex,
        end_index: state.processedIndex + linkMatch.endIndex,
      },
    };
    state.processedIndex += linkMatch.fullMatch.length;
    return;
  }

  // Handle blocks that end with \n\n
  if (detectDoubleNewline(remaining)) {
    yield* handleDoubleNewline(state);
    return;
  }

  // If no text block is active and we have content, start a generic text block (paragraph)
  if (!hasActive && remaining.length > 0 && remaining[0] !== "\n") {
    const id = state.generateId();
    // Emit begin for text paragraph
    yield {
      type: "begin",
      elementType: "text",
      elementId: id,
    };

    state.activeBlocks.push({
      id,
      type: "text",
      content: "",
      startMarker: "",
      endMarker: undefined,
      contentStartIndex: state.processedIndex,
      lastEmittedLength: 0,
    });
    return;
  }

  // Accumulate content for active blocks
  if (state.activeBlocks.length > 0) {
    yield* accumulateBlockContent(state, remaining);
    return;
  }

  // No active blocks, skip character (but only if there's content to process)
  if (remaining.length > 0) {
    state.processedIndex++;
  }
}

// Detected block structure
export type DetectedBlock = {
  type: string;
  metadata?: Record<string, unknown>;
  content?: string;
  matchLength: number;
  startMarker?: string;
  endMarker?: string;
};

/**
 * Handles detected markdown blocks and generates appropriate events.
 *
 * @param state - Current parser state
 * @param detected - Detected markdown block
 * @param _remaining - Remaining content (reserved for future use)
 * @yields Markdown parse events
 */
export async function* handleDetectedBlock(
  state: ParserState,
  detected: DetectedBlock,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Remaining parameter kept for future use in block processing
  _remaining: string,
): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  const id = state.generateId();

  // Emit begin event
  yield {
    type: "begin",
    elementType: detected.type as MarkdownElementType,
    elementId: id,
    metadata: detected.metadata,
  };

  // Structured table output: expand into thead/tbody/row/col nested events and finish immediately
  if (detected.type === "table" && state.config.tableOutputMode === "structured") {
    const tableText = state.buffer.slice(state.processedIndex, state.processedIndex + detected.matchLength);
    const parsed = parseTable(tableText);
    if (parsed) {
      // Emit nested thead
      const theadId = state.generateId();
      yield { type: "begin", elementType: "thead" as MarkdownElementType, elementId: theadId };
      const headRowId = state.generateId();
      yield { type: "begin", elementType: "row" as MarkdownElementType, elementId: headRowId, metadata: { index: 0 } };
      for (const [i, cell] of parsed.headers.entries()) {
        const colId = state.generateId();
        yield {
          type: "begin",
          elementType: "col" as MarkdownElementType,
          elementId: colId,
          metadata: { index: i, alignment: parsed.alignments[i] },
        };
        if (cell) {
          yield { type: "delta", elementId: colId, content: cell };
        }
        yield { type: "end", elementId: colId, finalContent: cell };
      }
      yield { type: "end", elementId: headRowId, finalContent: parsed.headers.join(" | ") };
      yield { type: "end", elementId: theadId, finalContent: parsed.headers.join(" | ") };

      // Emit tbody
      const tbodyId = state.generateId();
      yield { type: "begin", elementType: "tbody" as MarkdownElementType, elementId: tbodyId };
      for (const [ri, row] of parsed.rows.entries()) {
        const rowId = state.generateId();
        yield { type: "begin", elementType: "row" as MarkdownElementType, elementId: rowId, metadata: { index: ri } };
        for (const [i, cell] of row.entries()) {
          const colId = state.generateId();
          yield {
            type: "begin",
            elementType: "col" as MarkdownElementType,
            elementId: colId,
            metadata: { index: i, alignment: parsed.alignments[i] },
          };
          if (cell) {
            yield { type: "delta", elementId: colId, content: cell };
          }
          yield { type: "end", elementId: colId, finalContent: cell };
        }
        yield { type: "end", elementId: rowId, finalContent: row.join(" | ") };
      }
      yield { type: "end", elementId: tbodyId, finalContent: parsed.rows.map((r) => r.join(" | ")).join("\n") };

      // Close table
      yield { type: "end", elementId: id, finalContent: tableText.trim() };
      state.processedIndex += detected.matchLength;
      return;
    }
  }

  // For single-line elements (headers, horizontal rules), emit content and end immediately
  if (detected.content !== undefined) {
    yield {
      type: "delta",
      elementId: id,
      content: detected.content,
    };

    yield {
      type: "end",
      elementId: id,
      finalContent: detected.content,
    };

    state.processedIndex += detected.matchLength;
    return;
  }
  {
    // Multi-line block, add to active blocks
    state.activeBlocks.push({
      id,
      type: detected.type as MarkdownElementType,
      content: "",
      metadata: detected.metadata,
      startMarker: detected.startMarker ? detected.startMarker : "",
      endMarker: detected.endMarker,
      contentStartIndex: state.processedIndex + detected.matchLength,
      lastEmittedLength: 0,
    });

    state.processedIndex += detected.matchLength;
  }
}

/**
 * Handles double newline sequences that close markdown blocks.
 *
 * @param state - Current parser state
 * @yields Markdown parse events for closing blocks
 */
export async function* handleDoubleNewline(state: ParserState): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  // Close all blocks that end with \n\n
  const blocksToClose = state.activeBlocks.filter((b) => b.endMarker === undefined);

  for (const block of blocksToClose) {
    // Flush any remaining buffered piece before closing, with inline emphasis handling
    const transformed = state.transformBlockContent(block);
    const already = block.lastEmittedLength ?? 0;
    const remainder = transformed.slice(already);
    if (remainder.length > 0) {
      const maxSize = Math.max(1, state.config.maxDeltaChunkSize ?? 1);
      type Seg =
        | { kind: "plain"; text: string }
        | { kind: "emph"; style: "strong" | "emphasis" | "strikethrough" | "code"; text: string };
      const matches = findAllInlineEmphasis(remainder, 0);

      const createSegments = (text: string, emphasisMatches: typeof matches): Seg[] => {
        const segments: Seg[] = [];
        // eslint-disable-next-line no-restricted-syntax -- needed for iterative position tracking in loop
        let pos = 0;

        for (const m of emphasisMatches) {
          if (m.startIndex > pos) {
            segments.push({ kind: "plain", text: text.slice(pos, m.startIndex) });
          }
          segments.push({
            kind: "emph",
            style: m.type,
            text: text.slice(m.startIndex + m.marker.length, m.endIndex - m.marker.length),
          });
          pos = m.endIndex;
        }
        if (pos < text.length) {
          segments.push({ kind: "plain", text: text.slice(pos) });
        }
        return segments;
      };

      const segments = createSegments(remainder, matches);
      for (const seg of segments) {
        if (seg.kind === "plain") {
          const processTextSegment = (text: string): string[] => {
            const chunks: string[] = [];
            // eslint-disable-next-line no-restricted-syntax -- needed for iterative text processing position tracking
            let flushed = 0;

            while (flushed < text.length) {
              const rest = text.slice(flushed);
              // eslint-disable-next-line no-restricted-syntax -- needed for building output string iteratively
              let out = "";
              if (rest[0] === "\n") {
                const m = rest.match(/^\n+/);
                out = m ? m[0] : "\n";
              } else if (rest[0] === " ") {
                const m = rest.match(/^ +/);
                out = m ? m[0] : " ";
              } else {
                const nextDelim = rest.search(/[ \n]/);
                if (nextDelim === -1) {
                  if (rest.length < maxSize) {
                    break;
                  }
                  out = rest.slice(0, maxSize);
                } else {
                  const candidate = rest.slice(0, nextDelim);
                  out = candidate.length >= maxSize ? candidate.slice(0, maxSize) : candidate;
                }
              }
              if (!out) {
                break;
              }
              chunks.push(out);
              flushed += out.length;
            }
            return chunks;
          };

          const chunks = processTextSegment(seg.text);
          for (const chunk of chunks) {
            yield { type: "delta", elementId: block.id, content: chunk };
          }
        } else {
          const id = state.generateId();
          const getElementType = (style: string) => {
            if (style === "strong") {
              return "strong";
            }
            if (style === "emphasis") {
              return "emphasis";
            }
            if (style === "strikethrough") {
              return "strikethrough";
            }
            return "code";
          };
          const elementType = getElementType(seg.style);
          yield { type: "begin", elementType, elementId: id };
          if (seg.text.length > 0) {
            yield { type: "delta", elementId: id, content: seg.text };
          }
          yield { type: "end", elementId: id, finalContent: seg.text };
        }
      }
      block.lastEmittedLength = transformed.length;
    }
    yield {
      type: "end",
      elementId: block.id,
      finalContent: state.processBlockContent(block),
    };
  }

  state.activeBlocks = state.activeBlocks.filter((b) => b.endMarker !== undefined);
  state.processedIndex += 2;
}

/**
 * Accumulates content for active markdown blocks.
 *
 * @param state - Current parser state
 * @param remaining - Remaining text to process
 * @yields Markdown parse events
 */
export async function* accumulateBlockContent(
  state: ParserState,
  remaining: string,
): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  // For quote blocks, check if line still starts with >
  const quoteBlocks = state.activeBlocks.filter((b) => b.type === "quote");
  if (quoteBlocks.length > 0 && remaining[0] === "\n") {
    if (!detectQuoteContinuation(remaining)) {
      // Next line doesn't start with >, flush remainder and close quote blocks
      for (const block of quoteBlocks) {
        const transformed = state.transformBlockContent(block);
        const already = block.lastEmittedLength ?? 0;
        const remainder = transformed.slice(already);
        if (remainder.length > 0) {
          yield {
            type: "delta",
            elementId: block.id,
            content: remainder,
          };
          block.lastEmittedLength = transformed.length;
        }
        yield {
          type: "end",
          elementId: block.id,
          finalContent: state.processBlockContent(block),
        };
      }
      state.activeBlocks = state.activeBlocks.filter((b) => b.type !== "quote");
    }
  }

  // Accumulate one character
  const char = remaining[0];
  for (const block of state.activeBlocks) {
    block.content += char;
  }

  // Emit deltas for incremental content using word/space-aware chunking (non-code blocks)
  for (const block of state.activeBlocks) {
    if (block.type === "code") {
      continue;
    }
    const transformed = state.transformBlockContent(block);
    const already = block.lastEmittedLength ?? 0;
    const piece = transformed.slice(already);
    if (piece.length === 0) {
      continue;
    }

    type Seg =
      | { kind: "plain"; text: string }
      | { kind: "emph"; style: "strong" | "emphasis" | "strikethrough" | "code"; text: string };
    const matches = findAllInlineEmphasis(piece, 0);

    const createSegments = (text: string, emphasisMatches: typeof matches): Seg[] => {
      const segments: Seg[] = [];
      // eslint-disable-next-line no-restricted-syntax -- needed for iterative position tracking in loop
      let pos = 0;

      for (const m of emphasisMatches) {
        if (m.startIndex > pos) {
          segments.push({ kind: "plain", text: text.slice(pos, m.startIndex) });
        }
        const content = text.slice(m.startIndex + m.marker.length, m.endIndex - m.marker.length);
        segments.push({ kind: "emph", style: m.type, text: content });
        pos = m.endIndex;
      }
      if (pos < text.length) {
        segments.push({ kind: "plain", text: text.slice(pos) });
      }
      return segments;
    };

    const segments = createSegments(piece, matches);
    const maxSize = Math.max(1, state.config.maxDeltaChunkSize ?? 1);

    const processSegments = (
      segs: Seg[],
      blockId: string,
      startConsumed: number,
    ): { chunks: MarkdownParseEvent[]; totalConsumed: number } => {
      const chunks: MarkdownParseEvent[] = [];
      // eslint-disable-next-line no-restricted-syntax -- needed for tracking consumed position across iterations
      let consumed = startConsumed;

      for (const seg of segs) {
        if (seg.kind === "plain") {
          const processTextSegment = (text: string): { chunks: string[]; flushed: number } => {
            const textChunks: string[] = [];
            // eslint-disable-next-line no-restricted-syntax -- needed for iterative text processing position tracking
            let flushed = 0;

            while (flushed < text.length) {
              const rest = text.slice(flushed);
              // eslint-disable-next-line no-restricted-syntax -- needed for building output string iteratively
              let out = "";

              if (rest[0] === "\n") {
                const m = rest.match(/^\n+/);
                out = m ? m[0] : "\n";
              } else if (rest[0] === " ") {
                const m = rest.match(/^ +/);
                out = m ? m[0] : " ";
              } else {
                const nextDelim = rest.search(/[ \n]/);
                if (nextDelim === -1) {
                  if (rest.length < maxSize) {
                    break;
                  }
                  out = rest.slice(0, maxSize);
                } else {
                  const candidate = rest.slice(0, nextDelim);
                  out = candidate.length >= maxSize ? candidate.slice(0, maxSize) : candidate;
                }
              }
              if (!out) {
                break;
              }
              textChunks.push(out);
              flushed += out.length;
            }
            return { chunks: textChunks, flushed };
          };

          const result = processTextSegment(seg.text);
          for (const chunk of result.chunks) {
            chunks.push({ type: "delta", elementId: blockId, content: chunk });
          }
          consumed += result.flushed;
        } else {
          const id = state.generateId();
          const getElementType = (style: string) => {
            if (style === "strong") {
              return "strong";
            }
            if (style === "emphasis") {
              return "emphasis";
            }
            if (style === "strikethrough") {
              return "strikethrough";
            }
            return "code";
          };
          const elementType = getElementType(seg.style);

          chunks.push({ type: "begin", elementType, elementId: id });
          if (seg.text.length > 0) {
            chunks.push({ type: "delta", elementId: id, content: seg.text });
          }
          chunks.push({ type: "end", elementId: id, finalContent: seg.text });
          consumed += seg.text.length;
        }
      }
      return { chunks, totalConsumed: consumed };
    };

    const result = processSegments(segments, block.id, already);

    for (const chunk of result.chunks) {
      yield chunk;
    }

    block.lastEmittedLength = result.totalConsumed;
  }

  state.processedIndex++;
}
