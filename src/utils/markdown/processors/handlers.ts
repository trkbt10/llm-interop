/**
 * @file Handlers for detected blocks and double-newline closures
 */
import type { MarkdownParseEvent, MarkdownElementType } from "../types";
import type { ParserState } from "../parser-state";
import { parseTable } from "../table-detector";
import { findAllInlineEmphasis } from "../emphasis-detector";

// Detected block structure (loose shape compatible with detector output)
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
 */
export async function* handleDetectedBlock(
  state: ParserState,
  detected: DetectedBlock,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Structured table output: emit nested structure then finish
  if (detected.type === "table" && state.config.tableOutputMode === "structured") {
    const tableText = state.buffer.slice(state.processedIndex, state.processedIndex + detected.matchLength);
    const parsed = parseTable(tableText);
    if (parsed) {
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

      yield { type: "end", elementId: id, finalContent: tableText.trim() };
      state.processedIndex += detected.matchLength;
      return;
    }
  }

  // Text table output: emit whole table immediately
  if (detected.type === "table" && state.config.tableOutputMode === "text") {
    const tableText = state.buffer.slice(state.processedIndex, state.processedIndex + detected.matchLength);
    if (tableText) {
      yield { type: "delta", elementId: id, content: tableText };
    }
    yield { type: "end", elementId: id, finalContent: tableText.trim() };
    state.processedIndex += detected.matchLength;
    return;
  }

  // Single-line elements (headers, horizontal rules): emit and finish
  if (detected.content !== undefined) {
    yield { type: "delta", elementId: id, content: detected.content };
    yield { type: "end", elementId: id, finalContent: detected.content };
    state.processedIndex += detected.matchLength;
    return;
  }

  // Multi-line block: activate
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

/**
 * Handles double newline sequences that close markdown blocks.
 */
export async function* handleDoubleNewline(
  state: ParserState,
): AsyncGenerator<MarkdownParseEvent, void, unknown> {
  const blocksToClose = state.activeBlocks.filter((b) => b.endMarker === undefined);

  for (const block of blocksToClose) {
    // For quote/list blocks, include the terminating newline as part of content
    if ((block.type === "quote" || block.type === "list") && !block.content.endsWith("\n")) {
      block.content += "\n";
    }
    const transformed = state.transformBlockContent(block);
    const already = block.lastEmittedLength ?? 0;
    let remainder = transformed.slice(already);
    // For plain text paragraphs, don't emit trailing newline to align with trimmed finalContent
    if (block.type === "text" && remainder.endsWith("\n")) {
      remainder = remainder.slice(0, -1);
    }
    if (remainder.length > 0) {
      const maxSize = Math.max(1, state.config.maxDeltaChunkSize ?? 1);
      type Seg =
        | { kind: "plain"; text: string }
        | { kind: "emph"; style: "strong" | "emphasis" | "strikethrough" | "code"; text: string };
      const matches = findAllInlineEmphasis(remainder, 0);

      const createSegments = (text: string, emphasisMatches: typeof matches): Seg[] => {
        const segments: Seg[] = [];
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
            let flushed = 0;
            while (flushed < text.length) {
              const rest = text.slice(flushed);
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
                  // At close time, flush whatever remains even if shorter than maxSize
                  out = rest.length <= maxSize ? rest : rest.slice(0, maxSize);
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
            if (style === "strong") return "strong" as const;
            if (style === "emphasis") return "emphasis" as const;
            if (style === "strikethrough") return "strikethrough" as const;
            return "code" as const;
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
    yield { type: "end", elementId: block.id, finalContent: state.processBlockContent(block) };
  }

  state.activeBlocks = state.activeBlocks.filter((b) => b.endMarker !== undefined);
  state.processedIndex += 2;
}

