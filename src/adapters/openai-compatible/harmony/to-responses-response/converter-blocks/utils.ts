/**
 * @file Utility functions for converter
 */

export const splitIntoChunks = (text: string, chunkSize: number): string[] => {
  if (!text) {
    return [];
  }

  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

export const normalizeOutputText = (text: string): string => {
  if (!text) {
    return "";
  }
  return text.replace(/\r/g, "").trim();
};