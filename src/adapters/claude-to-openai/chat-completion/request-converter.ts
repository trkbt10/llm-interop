/**
 * @file Converts OpenAI Chat Completion requests to Claude API format
 * Handles the transformation of OpenAI-compatible chat completion parameters into Anthropic
 * Claude message creation parameters, including message format conversion, tool definitions,
 * and parameter mapping to enable Claude provider compatibility.
 */
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type {
  MessageCreateParams as ClaudeMessageCreateParams,
  Tool as ClaudeTool,
} from "@anthropic-ai/sdk/resources/messages";
import { isOpenAIChatFunctionTool, isOpenAIChatTextPart } from "../../../providers/openai/chat-guards";
// Model mapping is handled by higher-level resolver; use provided model as-is here.
import { normalizeJSONSchemaForOpenAI } from "../schema-normalizer";
import { toClaudeToolUseIdFromOpenAI } from "../../conversation/id-conversion";

const mapModel = (model: string): string => model;

function createInputSchema(params: unknown): ClaudeTool["input_schema"] {
  if (!params || typeof params !== "object") {
    return {
      type: "object" as const,
      properties: null,
      required: null,
    };
  }

  // Normalize the schema to ensure compatibility
  const normalized = normalizeJSONSchemaForOpenAI(params as Record<string, unknown>);

  // Convert JSONSchemaProperty to Claude's InputSchema format
  if ("type" in normalized && normalized.type === "object") {
    return {
      type: "object" as const,
      properties: normalized.properties ? normalized.properties : null,
      required: normalized.required ? normalized.required : null,
    };
  }

  // Wrap in object schema format
  const wrapped = normalizeJSONSchemaForOpenAI({
    type: "object",
    properties:
      typeof normalized.properties === "object" && normalized.properties !== null ? normalized.properties : {},
    required: normalized.required,
  });

  return {
    type: "object" as const,
    properties: wrapped.properties ? wrapped.properties : null,
    required: wrapped.required ? wrapped.required : null,
  };
}

function convertTools(tools?: ChatCompletionTool[]): ClaudeTool[] | undefined {
  if (!tools) {
    return undefined;
  }

  const convertedTools = tools.filter(isOpenAIChatFunctionTool).map((t) => ({
    name: t.function.name,
    description: t.function.description ? t.function.description : "",
    input_schema: createInputSchema(t.function.parameters),
  }));

  return convertedTools.length ? convertedTools : undefined;
}

function convertToolChoice(
  toolChoice: ChatCompletionCreateParams["tool_choice"],
): ClaudeMessageCreateParams["tool_choice"] | undefined {
  if (!toolChoice) {
    return undefined;
  }
  if (toolChoice === "none") {
    return { type: "none" };
  }
  if (toolChoice === "required" || toolChoice === "auto") {
    return { type: "any" };
  }
  if (typeof toolChoice === "object" && toolChoice.type === "function") {
    return { type: "tool", name: toolChoice.function.name };
  }
  return undefined;
}

function openAIChatContentToPlainText(content: ChatCompletionMessageParam["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((p) => (isOpenAIChatTextPart(p) ? p.text : ""))
      .filter(Boolean)
      .join("");
  }
  return "";
}

function convertMessages(msgs: ChatCompletionMessageParam[]): ClaudeMessageCreateParams["messages"] {
  const out: ClaudeMessageCreateParams["messages"] = [];
  for (const m of msgs) {
    if (m.role === "system") {
      // system is handled at top-level in chatCompletionToClaudeLocal
      continue;
    }
    if (m.role === "user") {
      const contentText = openAIChatContentToPlainText(m.content);
      out.push({ role: m.role, content: contentText });
    } else if (m.role === "assistant") {
      const contentText = openAIChatContentToPlainText(m.content);
      // Handle assistant messages with tool calls
      if ("tool_calls" in m && m.tool_calls) {
        if (m.tool_calls.length > 0) {
          const content: Array<
            { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }
          > = [];

          // Add text content if present
          if (contentText) {
            content.push({ type: "text", text: contentText });
          }

          // Convert tool calls to Claude format
          for (const toolCall of m.tool_calls) {
            if (toolCall.type === "function") {
              const claudeToolUseId = toClaudeToolUseIdFromOpenAI(toolCall.id);
              content.push({
                type: "tool_use",
                id: claudeToolUseId,
                name: toolCall.function.name,
                input: JSON.parse(toolCall.function.arguments ? toolCall.function.arguments : "{}"),
              });
            }
          }

          out.push({ role: "assistant", content });
        } else {
          out.push({ role: "assistant", content: contentText });
        }
      } else {
        // Regular assistant message without tool calls
        out.push({ role: "assistant", content: contentText });
      }
    } else if (m.role === "tool") {
      // Convert OpenAI tool result to Claude tool_result format
      const toolCallId = toClaudeToolUseIdFromOpenAI(m.tool_call_id);
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolCallId,
            content: m.content ? String(m.content) : "",
          },
        ],
      });
    }
  }
  // Prepend a system message into system field via caller; we return messages without system entries
  return out;
}

/**
 * Transforms OpenAI Chat Completion requests into Claude-compatible message creation parameters.
 * Bridges the API gap between OpenAI's chat completion format and Anthropic Claude's message format,
 * enabling users to leverage Claude's capabilities through OpenAI-style interface patterns.
 * Handles system message extraction, tool conversion, and parameter mapping to ensure
 * seamless provider interoperability.
 *
 * @param request - OpenAI Chat Completion request containing messages, model, and optional tools
 * @returns Claude MessageCreateParams with converted messages, tools, and provider-specific settings
 */
export function chatCompletionToClaudeLocal(request: ChatCompletionCreateParams): ClaudeMessageCreateParams {
  const model = mapModel(typeof request.model === "string" ? request.model : String(request.model));
  const messages = convertMessages(request.messages);
  const systemTexts = (request.messages ? request.messages : [])
    .filter((m) => m.role === "system")
    .map((m) => openAIChatContentToPlainText(m.content))
    .filter(Boolean);

  const claudeReq: ClaudeMessageCreateParams = {
    model,
    messages,
    max_tokens: typeof request.max_tokens === "number" ? request.max_tokens : 4096,
    stream: !!request.stream,
  };

  if (systemTexts.length) {
    claudeReq.system = systemTexts.join("\n\n");
  }
  const tools = convertTools(request.tools);
  if (tools) {
    claudeReq.tools = tools;
  }
  const choice = convertToolChoice(request.tool_choice);
  if (choice) {
    claudeReq.tool_choice = choice;
  }
  // Temperature and top_p disabled for all models
  // if (request.temperature != null) claudeReq.temperature = request.temperature ?? undefined;
  // if (request.top_p != null) claudeReq.top_p = request.top_p ?? undefined;
  if (request.stop) {
    const stop = request.stop;
    claudeReq.stop_sequences = Array.isArray(stop) ? stop : [String(stop)];
  }

  return claudeReq;
}
