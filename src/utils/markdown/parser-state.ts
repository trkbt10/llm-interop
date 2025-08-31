/**
 * @file State management for the streaming markdown parser
 * Encapsulates parser state and provides utility methods
 */

import type { MarkdownElementType, MarkdownElementMetadata, MarkdownParserConfig } from "./types";
import { findAllInlineEmphasis } from "./emphasis-detector";

export type BlockState = {
  id: string;
  type: MarkdownElementType;
  content: string;
  metadata?: MarkdownElementMetadata;
  startMarker: string;
  endMarker?: string; // undefined = ends with \n\n
  contentStartIndex: number;
  // Length of transformed content already emitted via delta
  lastEmittedLength?: number;
};

export type ParserState = {
  buffer: string;
  processedIndex: number;
  activeBlocks: BlockState[];
  idCounter: number;
  config: MarkdownParserConfig;

  // Methods
  generateId(): string;
  processBlockContent(block: BlockState): string;
  transformBlockContent(block: BlockState): string;
  reset(): void;
};

/**
 * Creates parser state management for streaming markdown processing with configurable behavior.
 * Initializes stateful parser infrastructure for tracking markdown element boundaries,
 * managing content buffers, and providing utility methods for element processing.
 * Essential for maintaining context across streaming markdown chunks and enabling
 * progressive content parsing.
 *
 * @param config - Parser configuration options for customizing parsing behavior
 * @returns Parser state object with methods for content processing and state management
 */
export function createParserState(config: MarkdownParserConfig = {}): ParserState {
  const mergedConfig: MarkdownParserConfig = {
    preserveWhitespace: false,
    splitParagraphs: true,
    idPrefix: "md",
    maxBufferSize: 10000,
    maxDeltaChunkSize: 1,
    tableOutputMode: "text",
    ...config,
  };

  const state: ParserState = {
    buffer: "",
    processedIndex: 0,
    activeBlocks: [],
    idCounter: 0,
    config: mergedConfig,

    generateId(): string {
      return `${this.config.idPrefix}-${++this.idCounter}`;
    },

    processBlockContent(block: BlockState): string {
      const content = this.transformBlockContent(block);
      return this.config.preserveWhitespace ? content : content.trim();
    },

    transformBlockContent(block: BlockState): string {
      if (block.type === "quote") {
        return stripInlineEmphasis(processQuoteContent(block.content));
      }

      if (block.type === "list") {
        return stripInlineEmphasis(processListContent(block.content, block.metadata));
      }

      // Default: text, header, etc. Strip inline markers for nested output consistency
      return stripInlineEmphasis(block.content);
    },

    reset(): void {
      this.buffer = "";
      this.processedIndex = 0;
      this.activeBlocks = [];
      // Keep idCounter to ensure unique IDs across resets
    },
  };

  return state;
}

// Helper functions for content processing

/**
 * Processes quote content by removing quote markers.
 *
 * @param content - Quote content to process
 * @returns Processed content without quote markers
 */
export function processQuoteContent(content: string): string {
  return content
    .split("\n")
    .map((line) => line.replace(/^>\s*/, ""))
    .join("\n");
}

/**
 * Processes list content by handling list markers and indentation.
 *
 * @param content - List content to process
 * @param metadata - Optional metadata for list processing
 * @returns Processed list content
 */
export function processListContent(content: string, metadata?: MarkdownElementMetadata): string {
  if (!metadata) {
    return content;
  }

  const lines = content.split("\n");
  const processedLines: string[] = [];

  for (const line of lines) {
    // Remove list markers
    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      processedLines.push(unorderedMatch[2]);
      continue;
    }

    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      processedLines.push(orderedMatch[2]);
      continue;
    }

    // Keep line as-is if no list marker found
    processedLines.push(line);
  }

  return processedLines.join("\n");
}

// Factory function for creating block states

/**
 * Creates block state objects for tracking markdown element parsing progress.
 * Initializes structured state for individual markdown blocks (code, lists, headers)
 * with proper boundary markers and metadata. Essential for maintaining element
 * context during streaming parsing and enabling accurate content extraction.
 *
 * @param id - Unique identifier for the markdown block
 * @param type - Markdown element type (code, paragraph, list, etc.)
 * @param startMarker - String pattern that marks the beginning of the block
 * @param endMarker - String pattern that marks the end of the block (null for paragraph-style)
 * @param metadata - Additional element metadata (language, depth, etc.)
 * @param contentStartIndex - Buffer index where block content begins
 * @returns Block state object ready for content accumulation
 */
export function createBlockState(
  id: string,
  type: MarkdownElementType,
  startMarker: string,
  endMarker?: string,
  metadata?: MarkdownElementMetadata,
  contentStartIndex: number = 0,
): BlockState {
  return {
    id,
    type,
    content: "",
    metadata,
    startMarker,
    endMarker,
    contentStartIndex,
    lastEmittedLength: 0,
  };
}

// Remove inline emphasis markers while keeping inner text (for final/delta consistency)
function stripInlineEmphasis(content: string): string {
  if (!content) {
    return content;
  }
  const matches = findAllInlineEmphasis(content, 0);
  if (matches.length === 0) {
    return content;
  }

  const processMatches = (text: string, emphasisMatches: typeof matches): string => {
    const result = emphasisMatches.reduce(
      (acc, match) => {
        const { segments, pos } = acc;

        // Add text before the match if any
        if (match.startIndex > pos) {
          segments.push(text.slice(pos, match.startIndex));
        }

        // Add the content without markers
        segments.push(text.slice(match.startIndex + match.marker.length, match.endIndex - match.marker.length));

        return {
          segments,
          pos: match.endIndex,
        };
      },
      { segments: [] as string[], pos: 0 },
    );

    // Add remaining text after the last match
    if (result.pos < text.length) {
      result.segments.push(text.slice(result.pos));
    }

    return result.segments.join("");
  };

  return processMatches(content, matches);
}
