/**
 * @file Converts Claude message requests to OpenAI Responses API format
 * Provides bidirectional conversion between Claude message parameters and OpenAI Responses API
 * parameters, enabling Claude provider integration with the OpenAI Responses API while maintaining
 * tool calling capabilities and proper message formatting.
 */
import type {
  MessageCreateParams as ClaudeMessageCreateParams,
  Tool as ClaudeTool,
  ToolUnion,
} from "@anthropic-ai/sdk/resources/messages";
import type {
  ResponseCreateParams,
  Tool as OpenAITool,
  FunctionTool,
  ResponseInputItem,
  ToolChoiceOptions,
  ToolChoiceFunction,
} from "openai/resources/responses/responses";
import type { ToolChoice as ClaudeToolChoice } from "@anthropic-ai/sdk/resources/messages";
import type { ResponsesModel as OpenAIResponseModel } from "openai/resources/shared";
import { convertClaudeMessage } from "../input-converters";
import { normalizeJSONSchemaForOpenAI, type JSONSchemaProperty } from "../schema-normalizer";
import { isClaudeCustomTool } from "../../../providers/claude/guards";

/**
 * Converts Claude message creation parameters into OpenAI Response API request format.
 * Transforms Claude's message-based request structure into OpenAI's Response API format,
 * handling message conversion, tool mapping, and parameter transformation. Essential for
 * enabling Claude workflows to leverage OpenAI Response API processing infrastructure
 * while preserving Claude's tool calling and system message capabilities.
 *
 * @param req - Claude MessageCreateParams containing messages, tools, and settings
 * @param model - OpenAI model identifier for the converted request
 * @returns OpenAI Response API parameters with converted messages and mapped tools
 */
export function claudeToResponsesLocal(
  req: ClaudeMessageCreateParams,
  model: OpenAIResponseModel,
): ResponseCreateParams {
  const inputItems: ResponseInputItem[] = [];

  for (const m of req.messages) {
    const parts = convertClaudeMessage(m);
    inputItems.push(...parts);
  }

  const toolsResult = getConvertedTools(req.tools);
  const tools = toolsResult;

  const body: ResponseCreateParams = {
    model: model,
    input: inputItems,
    instructions: typeof req.system === "string" ? req.system : undefined,
    stream: !!req.stream,
  };
  if (tools !== null && tools !== undefined && tools.length > 0) {
    body.tools = tools;
  }
  // Map tool choice (Claude -> OpenAI Responses)
  if (req.tool_choice) {
    const mapped = mapClaudeToolChoiceToResponses(req.tool_choice);
    if (mapped) {
      body.tool_choice = mapped;
    }
  }
  if (typeof req.max_tokens === "number") {
    body.max_output_tokens = req.max_tokens;
  }
  // Temperature and top_p disabled for all models
  // if (typeof req.temperature === 'number') body.temperature = req.temperature;
  // if (typeof req.top_p === 'number') body.top_p = req.top_p;
  return body;
}

function mapClaudeToolsToResponses(tools?: ClaudeTool[]): OpenAITool[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) {
    return undefined;
  }
  const out: OpenAITool[] = [];
  for (const t of tools) {
    const hasInputSchema = t.input_schema !== null && t.input_schema !== undefined;
    const defaultSchema = { type: "object" as const, properties: null, required: null } as const;
    const params = hasInputSchema ? t.input_schema : defaultSchema;
    // Convert Claude's InputSchema to JSONSchemaProperty format for normalization
    const jsonSchemaType = getJsonSchemaType(params);
    const jsonSchemaProperties = getJsonSchemaProperties(params);
    const jsonSchemaRequired = getJsonSchemaRequired(params);

    const jsonSchemaParams: JSONSchemaProperty = {
      type: jsonSchemaType,
      properties: jsonSchemaProperties,
      required: jsonSchemaRequired,
    };
    // Normalize the schema to ensure it meets OpenAI's requirements
    const normalizedParams = normalizeJSONSchemaForOpenAI(jsonSchemaParams);
    const fn: FunctionTool = {
      type: "function",
      name: t.name,
      description: t.description !== null && t.description !== undefined ? t.description : null,
      parameters: normalizedParams,
      strict: true,
    };
    out.push(fn);
  }
  return out;
}

function mapClaudeToolChoiceToResponses(choice: ClaudeToolChoice): ToolChoiceOptions | ToolChoiceFunction | undefined {
  switch (choice.type) {
    case "auto":
      return "auto";
    case "none":
      return "none";
    case "any":
      // Force the model to call at least one tool
      return "required";
    case "tool":
      return { type: "function", name: choice.name };
    default:
      return undefined;
  }
}

function getConvertedTools(tools: ToolUnion[] | undefined): OpenAITool[] | undefined {
  if (!Array.isArray(tools)) {
    return undefined;
  }
  const filtered = tools.filter(isClaudeCustomTool);
  const mapped = mapClaudeToolsToResponses(filtered);
  if (mapped && mapped.length > 0) {
    return mapped;
  }
  return undefined;
}

function getJsonSchemaType(params: unknown): string {
  if (typeof params === "object" && params !== null && "type" in params) {
    const typeValue = (params as { type?: unknown }).type;
    if (typeof typeValue === "string") {
      return typeValue;
    }
  }
  return "object";
}

function getJsonSchemaProperties(params: unknown): Record<string, JSONSchemaProperty> {
  if (typeof params === "object" && params !== null && "properties" in params) {
    const propertiesValue = (params as { properties?: unknown }).properties;
    if (typeof propertiesValue === "object" && propertiesValue !== null) {
      return propertiesValue as Record<string, JSONSchemaProperty>;
    }
  }
  return {};
}

function getJsonSchemaRequired(params: unknown): string[] | undefined {
  if (typeof params === "object" && params !== null && "required" in params) {
    const requiredValue = (params as { required?: unknown }).required;
    if (Array.isArray(requiredValue)) {
      return requiredValue as string[];
    }
  }
  return undefined;
}
