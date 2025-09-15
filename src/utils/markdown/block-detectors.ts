/**
 * @file Block detection functions for markdown parsing
 * Each function returns detected block info or undefined (no-op when not detected)
 */

import type { MarkdownElementType, MarkdownElementMetadata } from "./types";
import { detectTable as detectTableHelper } from "./table-detector";

export type DetectedBlock = {
  type: MarkdownElementType;
  metadata?: MarkdownElementMetadata;
  startMarker: string;
  endMarker?: string; // undefined = ends with \n\n or context-dependent
  matchLength: number;
  content?: string; // For immediate content (like headers)
};

/**
 * Detect fenced code block (```)
 */
export function detectCodeBlock(text: string): DetectedBlock | undefined {
  // Support 3 or more backticks; capture exact fence to require matching close fence
  const match = text.match(/^(```+)([^\n]*)\n?/);
  if (!match || match.index !== 0) {
    return undefined;
  }

  const fence = match[1];
  const langSpec = match[2].trim();
  const language = langSpec ? langSpec.split(/\s+/)[0] : "text";

  return {
    type: "code",
    metadata: { language },
    startMarker: match[0],
    endMarker: fence,
    matchLength: match[0].length,
  };
}

/**
 * Detect ATX-style headers (# ## ### etc.)
 */
export function detectHeader(text: string): DetectedBlock | undefined {
  const match = text.match(/^(#{1,6})\s+(.+?)(?:\n|$)/);
  if (!match || match.index !== 0) {
    return undefined;
  }

  return {
    type: "header",
    metadata: { level: match[1].length },
    startMarker: match[0],
    matchLength: match[0].length,
    content: match[2],
  };
}

/**
 * Detect blockquote (> text)
 */
export function detectQuote(text: string): DetectedBlock | undefined {
  const match = text.match(/^>\s*/);
  if (!match || match.index !== 0) {
    return undefined;
  }

  return {
    type: "quote",
    startMarker: ">",
    endMarker: undefined, // ends with \n\n
    matchLength: match[0].length,
  };
}

/**
 * Detect ordered or unordered list items
 */
export function detectList(text: string): DetectedBlock | undefined {
  // Unordered list
  const unorderedMatch = text.match(/^(\s*)[-*+]\s+/);
  if (unorderedMatch && unorderedMatch.index === 0) {
    const indent = unorderedMatch[1].length;
    const level = Math.floor(indent / 2) + 1;

    return {
      type: "list",
      metadata: { ordered: false, level },
      startMarker: unorderedMatch[0],
      endMarker: undefined,
      matchLength: unorderedMatch[0].length,
    };
  }

  // Ordered list
  const orderedMatch = text.match(/^(\s*)(\d+)\.\s+/);
  if (orderedMatch && orderedMatch.index === 0) {
    const indent = orderedMatch[1].length;
    const level = Math.floor(indent / 2) + 1;

    return {
      type: "list",
      metadata: { ordered: true, level },
      startMarker: orderedMatch[0],
      endMarker: undefined,
      matchLength: orderedMatch[0].length,
    };
  }

  return undefined;
}

/**
 * Detect horizontal rule (--- or ___ or ***)
 */
export function detectHorizontalRule(text: string): DetectedBlock | undefined {
  const match = text.match(/^(---+|___+|\*\*\*+)\s*(?:\n|$)/);
  if (!match || match.index !== 0) {
    return undefined;
  }

  return {
    type: "horizontal_rule",
    startMarker: match[0],
    matchLength: match[0].length,
    content: match[1],
  };
}

/**
 * Detect LaTeX math blocks ($$ or $)
 */
export function detectMath(text: string): DetectedBlock | undefined {
  // Block math
  const blockMatch = text.match(/^\$\$\n?/);
  if (blockMatch && blockMatch.index === 0) {
    return {
      type: "math",
      metadata: { inline: false },
      startMarker: blockMatch[0],
      endMarker: "$$",
      matchLength: blockMatch[0].length,
    };
  }

  // Inline math
  const inlineMatch = text.match(/^\$/);
  if (inlineMatch && inlineMatch.index === 0) {
    return {
      type: "math",
      metadata: { inline: true },
      startMarker: "$",
      endMarker: "$",
      matchLength: 1,
    };
  }

  return undefined;
}

export type LinkMatch = {
  fullMatch: string;
  title: string;
  url: string;
  startIndex: number;
  endIndex: number;
};

/**
 * Detect markdown link [text](url)
 */
export function detectLink(text: string): LinkMatch | undefined {
  const match = text.match(/^\[([^\]]+)\]\(([^)]+)\)/);
  if (!match || match.index !== 0) {
    return undefined;
  }

  return {
    fullMatch: match[0],
    title: match[1],
    url: match[2],
    startIndex: 0,
    endIndex: match[0].length,
  };
}

/**
 * Detect GitHub-flavored markdown table
 */
export function detectTable(text: string): DetectedBlock | undefined {
  const tableMatch = detectTableHelper(text, 0);
  if (!tableMatch) {
    return undefined;
  }

  // For tables, we need to find the complete table to determine the end marker
  const lines = text.split("\n");
  // eslint-disable-next-line no-restricted-syntax -- loop counter for table line parsing performance
  let tableLines = 2; // header + separator

  // Count body rows
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim() || !lines[i].trim().startsWith("|")) {
      break;
    }
    tableLines++;
  }

  const matchLength = lines.slice(0, tableLines).join("\n").length;

  return {
    type: "table",
    metadata: { alignments: tableMatch.alignments },
    startMarker: tableMatch.headerLine,
    endMarker: undefined, // Tables end with a non-table line
    matchLength,
  };
}

/**
 * Detect paragraph separator (double newline)
 */
export function detectDoubleNewline(text: string): boolean {
  return text.startsWith("\n\n");
}

/**
 * Detect if quote block continues on next line
 */
export function detectQuoteContinuation(text: string): boolean {
  const match = text.match(/^\n(>)?/);
  return match ? !!match[1] : false;
}

/**
 * Aggregate detector for all block types
 * Returns the first matching block type or undefined
 */
export function detectBlock(text: string): DetectedBlock | undefined {
  // Order matters - check more specific patterns first
  const detectors = [
    detectCodeBlock,
    detectTable,
    detectMath,
    detectHeader,
    detectHorizontalRule,
    detectList,
    detectQuote,
  ];

  for (const detector of detectors) {
    const result = detector(text);
    if (result) {
      return result;
    }
  }

  return undefined;
}
