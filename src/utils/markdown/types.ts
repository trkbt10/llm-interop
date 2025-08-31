/**
 * @file Type definitions for the generic streaming markdown parser
 */

export type MarkdownElementType =
  | "text"
  | "code"
  | "header"
  | "list"
  | "quote"
  | "table"
  | "thead"
  | "tbody"
  | "row"
  | "col"
  | "tfoot"
  | "math"
  | "link"
  | "emphasis"
  | "strong"
  | "strikethrough"
  | "horizontal_rule"
  | "custom";

export type MarkdownElementMetadata = {
  // Code blocks
  language?: string;
  // Headers and lists
  level?: number;
  // Lists
  ordered?: boolean;
  // Links
  url?: string;
  title?: string;
  // Custom metadata
  [key: string]: unknown;
};

export type MarkdownParseEvent = BeginEvent | DeltaEvent | EndEvent | AnnotationEvent;

export type BeginEvent = {
  type: "begin";
  elementType: MarkdownElementType;
  elementId: string;
  metadata?: MarkdownElementMetadata;
};

export type DeltaEvent = {
  type: "delta";
  elementId: string;
  content: string;
};

export type EndEvent = {
  type: "end";
  elementId: string;
  finalContent: string;
};

export type AnnotationEvent = {
  type: "annotation";
  elementId: string;
  annotation: LinkAnnotation | CustomAnnotation;
};

export type LinkAnnotation = {
  type: "url_citation";
  url: string;
  title: string;
  start_index: number;
  end_index: number;
};

export type CustomAnnotation = {
  type: string;
  [key: string]: unknown;
};

export type ParsingState = {
  elementType: MarkdownElementType;
  elementId: string;
  startMarker: string;
  endMarker: string;
  buffer: string;
  metadata?: MarkdownElementMetadata;
  processed: boolean;
};

export type ProcessedRange = {
  start: number;
  end: number;
  elementId: string;
};

export type UnprocessedSegment = {
  start: number;
  end: number;
  text: string;
};

export type MarkdownParserConfig = {
  // Elements to parse (if not specified, all elements are parsed)
  enabledElements?: Set<MarkdownElementType>;

  // Custom element matchers
  customMatchers?: MarkdownElementMatcher[];

  // Parser behavior options
  preserveWhitespace?: boolean;
  splitParagraphs?: boolean;
  maxBufferSize?: number;
  // Max size for incremental delta chunks (non-code blocks)
  // 1 = per-character (default), 12 = coalesce up to 12 chars, etc.
  maxDeltaChunkSize?: number;
  // Table output mode: treat tables as plain text (default) or structured nested elements
  tableOutputMode?: "text" | "structured";

  // ID generation
  idPrefix?: string;
  idGenerator?: (type: MarkdownElementType) => string;
};

export type MarkdownElementMatcher = {
  type: MarkdownElementType | string;
  regex: RegExp;
  priority?: number;
  extractMetadata?: (match: RegExpMatchArray) => MarkdownElementMetadata;
  extractContent?: (match: RegExpMatchArray) => string;
};

export type MarkdownParserPlugin = {
  name: string;

  // Called before standard parsing
  preProcess?: (buffer: string) => string;

  // Called after standard parsing
  postProcess?: (events: MarkdownParseEvent[]) => MarkdownParseEvent[];

  // Custom element detection
  detectElements?: (buffer: string) => DetectedElement[];
};

export type DetectedElement = {
  type: MarkdownElementType | string;
  start: number;
  end: number;
  content: string;
  metadata?: MarkdownElementMetadata;
};
