import { HARMONY_CHANNELS, HARMONY_TOKENS, FUNCTION_NAMESPACE } from "../constants";
import type { HarmonyParsedToolCall, HarmonyParserFrame, HarmonyStopReason, ParsedHarmonyMessage } from "./types";

const TOKEN_PREFIX = "<|";
const TOKEN_SUFFIX = "|>";

const ParserStage: {
  DEFAULT: "default";
  AWAITING_ROLE: "awaiting_role";
  AWAITING_CHANNEL: "awaiting_channel";
  AWAITING_CONSTRAIN: "awaiting_constrain";
  COLLECTING_CONTENT: "collecting_content";
  AWAITING_STOP_RECIPIENT: "awaiting_stop_recipient";
} = {
  DEFAULT: "default",
  AWAITING_ROLE: "awaiting_role",
  AWAITING_CHANNEL: "awaiting_channel",
  AWAITING_CONSTRAIN: "awaiting_constrain",
  COLLECTING_CONTENT: "collecting_content",
  AWAITING_STOP_RECIPIENT: "awaiting_stop_recipient",
};

export type ParserStageKey =
  | "default"
  | "awaiting_role"
  | "awaiting_channel"
  | "awaiting_constrain"
  | "collecting_content"
  | "awaiting_stop_recipient";

type CurrentMessage = {
  role?: string;
  channel?: ParsedHarmonyMessage["channel"];
  recipient?: string;
  constrainType?: string;
  contentParts: string[];
};

type ParserState = {
  buffer: string;
  stage: ParserStageKey;
  currentRole?: string;
  currentMessage?: CurrentMessage;
  pendingStop?: HarmonyStopReason;
  toolCallCounter: number;
  tokensSeen: boolean;
  plainBuffer: string[];
  plainModeLocked: boolean;
};

export class HarmonyParseError extends Error {
  constructor(message: string, readonly detail?: Record<string, unknown>) {
    super(message);
    this.name = "HarmonyParseError";
  }
}

export type HarmonyStreamParser = {
  push: (chunk: string) => HarmonyParserFrame[];
  flush: () => HarmonyParserFrame[];
};

export const createHarmonyStreamParser = (): HarmonyStreamParser => {
  const state: ParserState = {
    buffer: "",
    stage: ParserStage.DEFAULT,
    toolCallCounter: 0,
    tokensSeen: false,
    plainBuffer: [],
    plainModeLocked: false,
  };

  const push = (chunk: string): HarmonyParserFrame[] => {
    if (!chunk) {
      return [];
    }

    state.buffer += chunk;
    const frames: HarmonyParserFrame[] = [];
    consumeBuffer(frames);
    return frames;
  };

  const flush = (): HarmonyParserFrame[] => {
    const frames: HarmonyParserFrame[] = [];
    if (state.buffer) {
      handleText(state.buffer, frames);
      state.buffer = "";
    }

    if (state.stage === ParserStage.AWAITING_STOP_RECIPIENT && state.pendingStop) {
      frames.push(...finalizeCurrentMessage(state.pendingStop));
    } else if (state.stage === ParserStage.COLLECTING_CONTENT && state.currentMessage) {
      frames.push(...finalizeCurrentMessage("end"));
    } else if (state.stage !== ParserStage.DEFAULT && state.stage !== ParserStage.AWAITING_ROLE) {
      throw new HarmonyParseError("Unexpected end of stream", { stage: state.stage });
    }

    if (!state.tokensSeen && state.plainBuffer.length > 0) {
      const content = normalizeContent(state.plainBuffer.join(""));
      if (content) {
        frames.push({
          type: "message",
          message: {
            channel: HARMONY_CHANNELS.FINAL,
            content,
            isToolCall: false,
            stopReason: "return",
          },
        });
      }
    }

    resetPlainMode();
    return frames;
  };

  const consumeBuffer = (frames: HarmonyParserFrame[]): void => {
    // eslint-disable-next-line no-constant-condition -- streaming parser iterates until buffer handled or awaiting more data
    while (true) {
      if (state.stage === ParserStage.AWAITING_STOP_RECIPIENT && state.buffer.startsWith(TOKEN_PREFIX)) {
        if (state.pendingStop) {
          frames.push(...finalizeCurrentMessage(state.pendingStop));
        }
      }

      const tokenStart = state.buffer.indexOf(TOKEN_PREFIX);
      if (tokenStart === -1) {
        if (state.buffer) {
          handleText(state.buffer, frames);
          state.buffer = "";
        }
        break;
      }

      if (tokenStart > 0) {
        const text = state.buffer.slice(0, tokenStart);
        handleText(text, frames);
        state.buffer = state.buffer.slice(tokenStart);
        continue;
      }

      const tokenEnd = state.buffer.indexOf(TOKEN_SUFFIX, TOKEN_PREFIX.length);
      if (tokenEnd === -1) {
        break;
      }

      const token = state.buffer.slice(0, tokenEnd + TOKEN_SUFFIX.length);
      handleToken(token, frames);
      state.buffer = state.buffer.slice(tokenEnd + TOKEN_SUFFIX.length);
    }
  };

  const handleToken = (token: string, frames: HarmonyParserFrame[]): void => {
    state.tokensSeen = true;
    state.plainModeLocked = true;

    if (state.stage === ParserStage.AWAITING_STOP_RECIPIENT && state.pendingStop) {
      frames.push(...finalizeCurrentMessage(state.pendingStop));
    }

    switch (token) {
      case HARMONY_TOKENS.START:
        state.stage = ParserStage.AWAITING_ROLE;
        break;
      case HARMONY_TOKENS.CHANNEL:
        ensureCurrentMessage();
        state.stage = ParserStage.AWAITING_CHANNEL;
        break;
      case HARMONY_TOKENS.CONSTRAIN:
        ensureCurrentMessage();
        state.stage = ParserStage.AWAITING_CONSTRAIN;
        break;
      case HARMONY_TOKENS.MESSAGE:
        ensureCurrentMessage();
        state.stage = ParserStage.COLLECTING_CONTENT;
        break;
      case HARMONY_TOKENS.END:
        frames.push(...finalizeCurrentMessage("end"));
        break;
      case HARMONY_TOKENS.CALL:
        state.pendingStop = "call";
        ensureCurrentMessage();
        state.stage = ParserStage.AWAITING_STOP_RECIPIENT;
        break;
      case HARMONY_TOKENS.RETURN:
        state.pendingStop = "return";
        ensureCurrentMessage();
        state.stage = ParserStage.AWAITING_STOP_RECIPIENT;
        break;
      default:
        throw new HarmonyParseError("Unknown harmony token", { token });
    }
  };

  const handleText = (raw: string, frames: HarmonyParserFrame[]): void => {
    if (!raw) {
      return;
    }

    switch (state.stage) {
      case ParserStage.AWAITING_ROLE: {
        const parsed = parseRoleHeader(raw);
        if (parsed.role) {
          state.currentRole = parsed.role;
        }
        state.stage = ParserStage.DEFAULT;
        break;
      }
      case ParserStage.AWAITING_CHANNEL: {
        const message = ensureCurrentMessage();
        const { channel, recipient } = parseChannelMetadata(raw);
        if (channel) {
          message.channel = channel;
        }
        if (recipient) {
          message.recipient = recipient;
        }
        state.stage = ParserStage.DEFAULT;
        break;
      }
      case ParserStage.AWAITING_CONSTRAIN: {
        const message = ensureCurrentMessage();
        const constrain = raw.trim();
        if (constrain) {
          message.constrainType = constrain;
        }
        state.stage = ParserStage.DEFAULT;
        break;
      }
      case ParserStage.COLLECTING_CONTENT: {
        const message = ensureCurrentMessage();
        message.contentParts.push(raw);
        break;
      }
      case ParserStage.AWAITING_STOP_RECIPIENT: {
        const trimmed = raw.trim();
        if (trimmed) {
          const message = ensureCurrentMessage();
          message.recipient = trimmed;
        }
        if (state.pendingStop) {
          frames.push(...finalizeCurrentMessage(state.pendingStop));
        }
        break;
      }
      default: {
        const trimmed = raw.trim();
        if (!trimmed) {
          break;
        }
        if (!state.tokensSeen && !state.plainModeLocked) {
          state.plainBuffer.push(raw);
          break;
        }
        throw new HarmonyParseError("Unexpected text outside harmony message", {
          stage: state.stage,
          text: trimmed.slice(0, 24),
        });
      }
    }
  };

  const ensureCurrentMessage = (): CurrentMessage => {
    if (!state.currentMessage) {
      state.currentMessage = {
        role: state.currentRole,
        contentParts: [],
      };
    }
    return state.currentMessage;
  };

  const finalizeCurrentMessage = (stopReason: HarmonyStopReason): HarmonyParserFrame[] => {
    if (!state.currentMessage) {
      state.pendingStop = undefined;
      state.stage = ParserStage.DEFAULT;
      return [];
    }

    const rawContent = state.currentMessage.contentParts.join("");
    const content = normalizeContent(rawContent);
    const channel = normalizeChannel(state.currentMessage.channel);
    const recipient = state.currentMessage.recipient?.trim() || undefined;

    const message: ParsedHarmonyMessage = {
      channel,
      content,
      recipient,
      constrainType: state.currentMessage.constrainType,
      isToolCall: stopReason === "call",
      stopReason,
      role: state.currentMessage.role || state.currentRole,
    };

    state.currentMessage = undefined;
    state.pendingStop = undefined;
    state.stage = ParserStage.DEFAULT;

    const frame: HarmonyParserFrame = { type: "message", message };
    if (message.isToolCall) {
      const toolCall = buildToolCall(message);
      if (toolCall) {
        frame.toolCall = toolCall;
      }
    }

    return [frame];
  };

  const buildToolCall = (message: ParsedHarmonyMessage): HarmonyParsedToolCall | undefined => {
    const recipient = message.recipient;
    const functionName = extractFunctionName(recipient);
    if (!functionName) {
      return undefined;
    }

    state.toolCallCounter += 1;
    return {
      id: `fc_${state.toolCallCounter.toString().padStart(4, "0")}`,
      name: functionName,
      arguments: message.content,
    };
  };

  const resetPlainMode = () => {
    state.plainBuffer = [];
    state.plainModeLocked = false;
  };

  return {
    push,
    flush,
  };
};

const parseRoleHeader = (raw: string): { role?: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  const [role] = trimmed.split(/\s+/);
  if (!role) {
    return {};
  }

  return { role };
};

const parseChannelMetadata = (
  raw: string,
): { channel?: ParsedHarmonyMessage["channel"]; recipient?: string } => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  const tokens = trimmed.split(/\s+/);
  const channelCandidate = tokens.shift();

  const result: { channel?: ParsedHarmonyMessage["channel"]; recipient?: string } = {};
  if (channelCandidate) {
    result.channel = normalizeChannel(channelCandidate);
  }

  const rest = tokens.join(" ");
  const recipient = extractRecipient(rest);
  if (recipient) {
    result.recipient = recipient;
  }

  return result;
};

const extractRecipient = (raw: string): string | undefined => {
  if (!raw) {
    return undefined;
  }
  const match = raw.match(/to\s*=\s*([^\s]+)/i);
  if (!match) {
    return undefined;
  }
  return match[1];
};

const normalizeChannel = (value?: string): ParsedHarmonyMessage["channel"] => {
  const channel = (value ?? "").trim().toLowerCase();
  switch (channel) {
    case HARMONY_CHANNELS.ANALYSIS:
    case HARMONY_CHANNELS.COMMENTARY:
    case HARMONY_CHANNELS.FINAL:
      return channel;
    default:
      throw new HarmonyParseError("Unknown harmony channel", { channel: value });
  }
};

const normalizeContent = (raw: string): string => {
  if (!raw) {
    return "";
  }
  return raw.replace(/\r/g, "").trim();
};

const extractFunctionName = (recipient?: string): string | undefined => {
  if (!recipient) {
    return undefined;
  }
  const trimmed = recipient.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutNamespace = trimmed.startsWith(`${FUNCTION_NAMESPACE}.`)
    ? trimmed.slice(FUNCTION_NAMESPACE.length + 1)
    : trimmed;

  if (!withoutNamespace) {
    return undefined;
  }

  const parts = withoutNamespace.split(".");
  return parts[parts.length - 1] || undefined;
};

export const containsHarmonySyntax = (content: string): boolean => {
  return Object.values(HARMONY_TOKENS).some((token) => content.includes(token));
};

export const normalizeToolCalls = (
  toolCalls?: Array<{ id?: string; type?: string; function?: { name: string; arguments: string } }>,
): HarmonyParsedToolCall[] | undefined => {
  if (!toolCalls || toolCalls.length === 0) {
    return undefined;
  }

  return toolCalls.map((tc, index) => {
    if (tc?.type === "function" && tc.function) {
      return {
        id: tc.id ?? `fc_${(index + 1).toString().padStart(4, "0")}`,
        name: tc.function.name,
        arguments: tc.function.arguments,
      } satisfies HarmonyParsedToolCall;
    }

    const name = typeof tc?.function?.name === "string" ? tc.function!.name : "unknown";
    const args = typeof tc?.function?.arguments === "string" ? tc.function!.arguments : "{}";

    return {
      id: tc?.id ?? `fc_${(index + 1).toString().padStart(4, "0")}`,
      name,
      arguments: args,
    } satisfies HarmonyParsedToolCall;
  });
};
