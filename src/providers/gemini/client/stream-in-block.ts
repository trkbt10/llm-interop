/**
 * @file Streaming response parser utilities for Gemini API
 * Provides streaming text processing utilities to parse Server-Sent Events (SSE) and
 * JSON Lines (JSONL) responses from Gemini API endpoints, handling both event-stream
 * and block-streaming response formats with proper JSON boundary detection.
 */

/**
 * Converts raw byte streams from Gemini API responses into decoded text chunks.
 * Handles the low-level task of reading binary stream data and converting it to text,
 * ensuring proper text decoding and streaming continuation. Essential for processing
 * Gemini API response streams in streaming scenarios.
 *
 * @param reader - ReadableStream of raw bytes from Gemini API response
 * @yields Decoded text chunks as they become available from the stream
 */
export async function* streamText(reader: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const dec = new TextDecoder();
  const r = reader.getReader();
  while (true) {
    const { value, done } = await r.read();
    if (done) {
      break;
    }
    if (value) {
      yield dec.decode(value, { stream: true });
    }
  }
}

/**
 * Parses Server-Sent Events (SSE) format from Gemini streaming responses.
 * Handles the complex task of parsing SSE protocol data, extracting data payloads
 * from event boundaries and filtering completion markers. Critical for processing
 * Gemini's SSE-formatted streaming responses correctly.
 *
 * @param chunks - Async iterable of raw text chunks containing SSE data
 * @yields Extracted data payloads from SSE events
 */
export async function* yieldSSEParts(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  const state = { buf: "" };

  for await (const textChunk of chunks) {
    state.buf += textChunk;

    const events = state.buf.split(/\r?\n\r?\n/);
    state.buf = events.pop() ?? "";

    for (const evt of events) {
      const dataLines = evt.split(/\r?\n/).filter((l) => l.startsWith("data:"));
      if (dataLines.length === 0) {
        continue;
      }
      const payload = dataLines.map((l) => l.slice(5).trimStart()).join("\n");
      if (payload === "[DONE]") {
        continue;
      }
      return yield payload;
    }

    if (state.buf.trim()) {
      return yield state.buf;
    }
  }
}

type JsonParserState = {
  seenArrayStart: boolean;
  depth: number;
  buf: string;
  inString: boolean;
  escape: boolean;
};

function createInitialState(): JsonParserState {
  return {
    seenArrayStart: false,
    depth: 0,
    buf: "",
    inString: false,
    escape: false,
  };
}

function processCharacter(
  state: JsonParserState,
  c: string,
): { state: JsonParserState; shouldYield: boolean; yieldValue?: string } {
  if (!state.seenArrayStart) {
    if (c === "[") {
      return { state: { ...state, seenArrayStart: true }, shouldYield: false };
    }
    return { state, shouldYield: false };
  }

  if (state.depth === 0) {
    if (c === "{") {
      return {
        state: { ...state, depth: 1, buf: "{", inString: false, escape: false },
        shouldYield: false,
      };
    }
    return { state, shouldYield: false };
  }

  const newBuf = state.buf + c;

  if (state.escape) {
    return { state: { ...state, buf: newBuf, escape: false }, shouldYield: false };
  }

  if (c === "\\") {
    if (state.inString) {
      return { state: { ...state, buf: newBuf, escape: true }, shouldYield: false };
    }
    return { state: { ...state, buf: newBuf }, shouldYield: false };
  }

  if (c === '"') {
    return { state: { ...state, buf: newBuf, inString: !state.inString }, shouldYield: false };
  }

  if (!state.inString) {
    if (c === "{") {
      return { state: { ...state, buf: newBuf, depth: state.depth + 1 }, shouldYield: false };
    }
    if (c === "}") {
      const newDepth = state.depth - 1;
      if (newDepth === 0) {
        return {
          state: { ...state, buf: "", depth: newDepth },
          shouldYield: true,
          yieldValue: newBuf,
        };
      }
      return { state: { ...state, buf: newBuf, depth: newDepth }, shouldYield: false };
    }
  }

  return { state: { ...state, buf: newBuf }, shouldYield: false };
}

/**
 * Extracts complete JSON objects from streaming Gemini responses with proper boundary detection.
 * Implements a stateful parser that tracks JSON object boundaries, string contexts, and nesting
 * depth to yield complete JSON objects from streaming text. Essential for processing Gemini's
 * JSON Lines streaming format where multiple JSON objects may be split across chunks.
 *
 * @param chunks - Async iterable of text chunks containing partial JSON objects
 * @yields Complete JSON object strings ready for parsing
 */
export async function* yieldInnerJsonBlocks(chunks: AsyncIterable<string>): AsyncGenerator<string> {
  const state = createInitialState();

  for await (const chunkText of chunks) {
    const chars = Array.from(chunkText);

    for (const c of chars) {
      const result = processCharacter(state, c);
      Object.assign(state, result.state);

      if (result.shouldYield && result.yieldValue) {
        yield result.yieldValue;
      }
    }
  }
}
