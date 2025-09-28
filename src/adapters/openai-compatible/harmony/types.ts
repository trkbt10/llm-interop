/**
 * @file Type definitions and imports for Harmony harmonizer.
 */

import type {
  Tool as ResponsesTool,
  FunctionTool as ResponsesFunctionTool,
  ResponseCreateParamsBase as ResponsesCreateParamsBase,
  ResponseInputMessageContentList as ResponsesInputMessageContentList,
  ResponseOutputRefusal as ResponsesOutputRefusal,
  ResponseOutputText as ResponsesOutputText,
  ResponseTextConfig,
  ToolChoiceOptions,
  ToolChoiceAllowed,
  ToolChoiceFunction,
  ToolChoiceTypes,
  ToolChoiceMcp,
  ToolChoiceCustom,
} from "openai/resources/responses/responses";
import type { Reasoning as ResponsesReasoning } from "openai/resources/shared";

export type ToolChoice =
  | ToolChoiceOptions
  | ToolChoiceAllowed
  | ToolChoiceFunction
  | ToolChoiceCustom
  | ToolChoiceTypes
  | ToolChoiceMcp;

export type Tool = ResponsesTool;
export type FunctionTool = ResponsesFunctionTool;
export type ResponseCreateParamsBase = ResponsesCreateParamsBase;
export type ResponseOutputText = ResponsesOutputText;
export type ResponseOutputRefusal = ResponsesOutputRefusal;
export type ResponseInputMessageContentList = ResponsesInputMessageContentList;
export type Reasoning = ResponsesReasoning;

// Import constants
import type {
  HarmonyChannel as HarmonyChannelType,
  HarmonyRole as HarmonyRoleType,
  ReasoningLevel,
  BuiltinTool,
} from "./constants";

export type HarmonyToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

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
  reasoning?: string;
  tool_calls?: HarmonyToolCall[];
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
