/**
 * @file Table detection for markdown parsing
 * Handles GitHub-flavored markdown tables
 */

export type TableMatch = {
  type: "table";
  startIndex: number;
  headerLine: string;
  separatorLine: string;
  alignments: Array<"left" | "center" | "right" | undefined>;
};

/**
 * Parse table separator line to extract column alignments
 * |:---|:---:|---:|---|
 */
export function parseTableSeparator(line: string): Array<"left" | "center" | "right" | undefined> | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return undefined;
  }

  // Remove leading and trailing pipes
  const content = trimmed.slice(1, -1);
  const columns = content.split("|").map((col) => col.trim());

  const alignments: Array<"left" | "center" | "right" | undefined> = [];

  for (const col of columns) {
    // Check if it's a valid separator (only -, :, and spaces)
    if (!/^:?-+:?$/.test(col)) {
      return undefined;
    }

    const startsWithColon = col.startsWith(":");
    const endsWithColon = col.endsWith(":");

    if (startsWithColon && endsWithColon) {
      alignments.push("center");
      continue;
    }

    if (startsWithColon) {
      alignments.push("left");
      continue;
    }

    if (endsWithColon) {
      alignments.push("right");
      continue;
    }

    alignments.push(undefined);
  }

  return alignments.length > 0 ? alignments : undefined;
}

/**
 * Check if a line looks like a table row
 * | col1 | col2 | col3 |
 */
export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  if (!trimmed.endsWith("|")) {
    return false;
  }
  if (!trimmed.includes("|")) {
    return false;
  }
  return true;
}

/**
 * Count columns in a table row
 */
export function countTableColumns(line: string): number {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return 0;
  }

  // Remove leading and trailing pipes
  const content = trimmed.slice(1, -1);
  return content.split("|").length;
}

/**
 * Detect a table starting at the current position
 * Tables require:
 * 1. Header row
 * 2. Separator row with same column count
 * 3. Optional body rows
 */
export function detectTable(text: string, startIndex: number = 0): TableMatch | undefined {
  const lines = text.slice(startIndex).split("\n");

  if (lines.length < 2) {
    return undefined;
  }

  const firstLine = lines[0];
  const secondLine = lines[1];

  // Check if first line is a table row
  if (!isTableRow(firstLine)) {
    return undefined;
  }

  // Check if second line is a separator
  const alignments = parseTableSeparator(secondLine);
  if (!alignments) {
    return undefined;
  }

  // Verify column counts match
  const headerColumns = countTableColumns(firstLine);
  if (headerColumns !== alignments.length) {
    return undefined;
  }

  return {
    type: "table",
    startIndex,
    headerLine: firstLine,
    separatorLine: secondLine,
    alignments,
  };
}

/**
 * Parse a table row into cells
 */
export function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!isTableRow(trimmed)) {
    return [];
  }

  // Remove leading and trailing pipes
  const content = trimmed.slice(1, -1);

  // Split by pipe and trim each cell
  return content.split("|").map((cell) => cell.trim());
}

/**
 * Find the end of a table
 * Tables end when we encounter a non-table row
 */
export function findTableEnd(text: string, startIndex: number): number {
  const lines = text.slice(startIndex).split("\n");

  // Skip header and separator (we know they exist)
  const startLineIndex = lines.length >= 2 ? 2 : 0;

  // Find the index of the first non-table row
  const findFirstNonTableRowIndex = (startIdx: number): number => {
    for (const [idx, line] of lines.slice(startIdx).entries()) {
      if (!line.trim() || !isTableRow(line)) {
        return startIdx + idx;
      }
    }
    return lines.length;
  };

  const endLineIndex = findFirstNonTableRowIndex(startLineIndex);

  // Calculate the end position
  const endPos = lines.slice(0, endLineIndex).reduce((pos, line) => pos + line.length + 1, startIndex);

  return endPos - 1; // Remove last newline
}

/**
 * Parse a complete table into structured data
 */
export type ParsedTable = {
  headers: string[];
  alignments: Array<"left" | "center" | "right" | undefined>;
  rows: string[][];
};

/**
 * Parses markdown table text into structured table data with headers, alignments, and rows.
 * Processes complete markdown table text to extract tabular data structure, including
 * column headers, alignment specifications, and row data. Essential for converting
 * streaming markdown tables into structured data for rendering or processing.
 *
 * @param text - Complete markdown table text with headers, separator, and rows
 * @returns Parsed table structure with headers, alignments, and row data, or null if invalid
 */
export function parseTable(text: string): ParsedTable | undefined {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    return undefined;
  }

  const alignments = parseTableSeparator(lines[1]);
  if (!alignments) {
    return undefined;
  }

  const headers = parseTableRow(lines[0]);

  // Process body rows starting from index 2
  const rows = lines
    .slice(2)
    .map((line) => parseTableRow(line))
    .filter((cells) => cells.length > 0);

  return { headers, alignments, rows };
}
