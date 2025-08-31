/**
 * @file Type definitions and imports for Harmony harmonizer.
 */

import type {
  ResponseCreateParamsBase,
  Tool,
  ResponseInput,
  ResponseInputItem,
  ResponseTextConfig,
  FunctionTool,
  FileSearchTool,
  WebSearchTool,
  ComputerTool,
  CustomTool,
  ToolChoiceOptions,
  ToolChoiceAllowed as OpenAIToolChoiceAllowed,
  ToolChoiceFunction as OpenAIToolChoiceFunction,
  ToolChoiceTypes,
  ToolChoiceMcp,
  ToolChoiceCustom as OpenAIToolChoiceCustom,
} from "openai/resources/responses/responses";

import type { Reasoning } from "openai/resources/shared";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Re-export for convenience
export type {
  ResponseCreateParamsBase,
  Tool,
  ResponseInput,
  ResponseInputItem,
  ResponseTextConfig,
  FunctionTool,
  FileSearchTool,
  WebSearchTool,
  ComputerTool,
  CustomTool,
  Reasoning,
  ChatCompletionMessageParam,
  ToolChoiceOptions,
  ToolChoiceTypes,
  ToolChoiceMcp,
};

// Tool choice types - extend OpenAI types
export type ToolChoiceAllowed = OpenAIToolChoiceAllowed;
export type ToolChoiceFunction = OpenAIToolChoiceFunction;
export type ToolChoiceCustom = OpenAIToolChoiceCustom;

export type ToolChoice =
  | ToolChoiceOptions
  | ToolChoiceAllowed
  | ToolChoiceFunction
  | ToolChoiceCustom
  | ToolChoiceTypes
  | ToolChoiceMcp;

// Import constants
import type {
  HarmonyChannel as HarmonyChannelType,
  HarmonyRole as HarmonyRoleType,
  ReasoningLevel,
  BuiltinTool,
} from "./constants";

// Harmony-specific types
export type HarmonySystemConfig = {
  reasoning?: ReasoningLevel;
  knowledgeCutoff?: string;
  currentDate?: string;
  hasTools?: boolean;
  builtinTools?: BuiltinTool[];
};

export type HarmonyDeveloperConfig = {
  instructions?: string;
  tools?: Tool[];
  responseFormat?: ResponseTextConfig;
  toolChoice?: ToolChoice;
};

export type HarmonyMessage = {
  role: HarmonyRoleType;
  channel?: HarmonyChannelType;
  recipient?: string;
  content: string;
  constrainType?: string;
};

export type HarmonyToolMessage = {
  role: "tool";
  toolName: string;
} & HarmonyMessage;

// Chat completion params mapping
export type ExtractedChatParams = {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stream_options?: {
    include_usage?: boolean;
    [key: string]: unknown;
  };
  // Other OpenAI ChatCompletion compatible params
};
