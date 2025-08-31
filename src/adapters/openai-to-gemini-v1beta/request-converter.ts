/**
 * @file Convert OpenAI Responses params → Gemini v1beta GenerateContent request.
 */
import type {
  ResponseCreateParams,
  ResponseInput,
  ResponseInputItem,
} from "openai/resources/responses/responses";
import type {
  GenerateContentRequest,
  GeminiContent as ClientGeminiContent,
  GeminiPart as ClientGeminiPart,
} from "../../providers/gemini/client/fetch-client";
import {
  isInputText,
  isInputImage,
  isResponseInputMessage,
  isResponseInputFunctionCallOutput,
  isResponseInputFunctionToolCall,
  isResponseInputCustomToolCall,
  isResponseInputCustomToolCallOutput,
  isResponseInputImageGenerationCall,
  isResponseInputCodeInterpreterToolCall,
  isResponseInputComputerToolCall,
  isResponseInputFileSearchToolCall,
  isResponseInputLocalShellCall,
  isResponseInputLocalShellCallOutput,
  isResponseInputMcpCall,
  isResponseInputMcpApprovalRequest,
  isResponseInputMcpApprovalResponse,
  isResponseInputMcpListTools,
  isResponseInputItemReference,
} from "../../providers/openai/responses-guards";
import { isObject } from "../../utils/type-guards";

// Helpers for message content conversion
function dataUrlToInlineData(url: string): { mimeType: string; data: string } | undefined {
  if (!url.startsWith("data:")) {
    return undefined;
  }
  const comma = url.indexOf(",");
  if (comma < 0) {
    return undefined;
  }
  const header = url.slice(5, comma); // after 'data:'
  const payload = url.slice(comma + 1);
  const semi = header.indexOf(";");
  const mime = semi >= 0 ? header.slice(0, semi) : header;
  const mimeType = mime ? mime : "application/octet-stream";
  return { mimeType, data: payload };
}

function convertMessageContentToGeminiParts(content: unknown): ClientGeminiPart[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const parts: ClientGeminiPart[] = [];
  for (const item of content) {
    if (isInputText(item)) {
      parts.push({ text: item.text });
      continue;
    }
    if (isInputImage(item)) {
      // Prefer inlineData if data URL; otherwise fileData
      const iu = item.image_url;
      if (typeof iu === "string") {
        const inline = dataUrlToInlineData(iu);
        parts.push(inline ? { inlineData: inline } : { fileData: { fileUri: iu } });
        continue;
      }
      if (isObject(iu)) {
        const urlVal = iu["url"];
        if (typeof urlVal === "string") {
          const inline = dataUrlToInlineData(urlVal);
          parts.push(inline ? { inlineData: inline } : { fileData: { fileUri: urlVal } });
        }
        continue;
      }
      continue;
    }
  }
  return parts;
}

function parseArgs(value: unknown): Record<string, unknown> | undefined {
  if (isObject(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isObject(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function fnCall(name: string, args?: Record<string, unknown>): ClientGeminiPart {
  if (args && Object.keys(args).length > 0) {
    return { functionCall: { name, args } };
  }
  return { functionCall: { name } };
}

/** Convert OpenAI Responses params into a Gemini GenerateContent request body. */
export function responsesToGeminiRequest(
  params: ResponseCreateParams,
  resolveToolName?: (callId: string) => string | undefined,
): GenerateContentRequest {
  const contents: ClientGeminiContent[] = [];

  // instructions -> user text (Gemini v1beta has systemInstruction, but we keep it simple/user)
  const sys = (params as { instructions?: string }).instructions;
  if (typeof sys === "string" && sys.length > 0) {
    contents.push({ role: "user", parts: [{ text: sys }] });
  }

  const input = (params as { input?: unknown }).input as ResponseInput | string | undefined;
  if (typeof input === "string") {
    contents.push({ role: "user", parts: [{ text: input }] });
  } else if (Array.isArray(input)) {
    for (const item of input as ResponseInputItem[]) {
      if (!item || typeof item !== "object") {
        continue;
      }
      if (isResponseInputMessage(item)) {
        const role = item.role === "user" ? "user" : "model";
        const converted = convertMessageContentToGeminiParts(item.content);
        if (converted.length > 0) {
          contents.push({ role, parts: converted });
        }
        continue;
      }
      if (isResponseInputFunctionCallOutput(item)) {
        const name = resolveToolName ? resolveToolName(item.call_id) : undefined;
        if (name) {
          contents.push({ role: "function", parts: [{ functionResponse: { name, response: item.output } }] });
        }
        continue;
      }
      if (isResponseInputFunctionToolCall(item)) {
        const args = parseArgs((item as { arguments?: unknown }).arguments);
        const part = fnCall((item as { name?: string }).name || "function", args);
        contents.push({ role: "user", parts: [part] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "custom_tool_call") {
        const args = parseArgs((item as { arguments?: unknown }).arguments);
        const name = (item as { name?: string }).name || "custom_tool";
        contents.push({ role: "user", parts: [fnCall(name, args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "custom_tool_call_output") {
        const name = (item as { name?: string }).name || "custom_tool";
        contents.push({ role: "function", parts: [{ functionResponse: { name, response: (item as { output?: unknown }).output } }] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "web_search_call") {
        const query = (item as { query?: unknown }).query;
        const args = typeof query === "string" ? { query } : undefined;
        contents.push({ role: "user", parts: [fnCall("web_search", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "image_generation_call") {
        const prompt = (item as { prompt?: unknown }).prompt;
        const args = typeof prompt === "string" ? { prompt } : undefined;
        contents.push({ role: "user", parts: [fnCall("generate_image", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "code_interpreter_call") {
        const code = (item as { code?: unknown }).code;
        const args = typeof code === "string" ? { code } : parseArgs(code);
        contents.push({ role: "user", parts: [fnCall("code_interpreter", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "computer_call") {
        const spec = isObject(item) ? (item as Record<string, unknown>) : undefined;
        const args = spec ? { ...spec } : undefined;
        contents.push({ role: "user", parts: [fnCall("computer_call", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "file_search_call") {
        const query = (item as { query?: unknown }).query;
        const args = typeof query === "string" ? { query } : undefined;
        contents.push({ role: "user", parts: [fnCall("file_search", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "local_shell_call") {
        const cmd = (item as { command?: unknown }).command;
        const args = typeof cmd === "string" ? { command: cmd } : undefined;
        contents.push({ role: "user", parts: [fnCall("local_shell", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "local_shell_call_output") {
        contents.push({ role: "function", parts: [{ functionResponse: { name: "local_shell", response: (item as { output?: unknown }).output } }] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "mcp_call") {
        const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
        contents.push({ role: "user", parts: [fnCall("mcp_call", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "mcp_approval_request") {
        const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
        contents.push({ role: "user", parts: [fnCall("mcp_approval_request", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "mcp_approval_response") {
        const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
        contents.push({ role: "user", parts: [fnCall("mcp_approval_response", args)] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "mcp_list_tools") {
        contents.push({ role: "user", parts: [fnCall("mcp_list_tools")] });
        continue;
      }
      if (("type" in item) && (item as { type?: unknown }).type === "item_reference") {
        const id = (item as { id?: unknown }).id;
        const refText = typeof id === "string" ? `[ref:${id}]` : "[ref]";
        contents.push({ role: "user", parts: [{ text: refText }] });
        continue;
      }
      try {
        const json = JSON.stringify(item);
        contents.push({ role: "user", parts: [{ text: json }] });
      } catch {
        // ignore
      }
    }
  } else if (isObject(input)) {
    const item = input as ResponseInputItem;
    if (isResponseInputMessage(item)) {
      const role = item.role === "user" ? "user" : "model";
      const converted = convertMessageContentToGeminiParts(item.content);
      if (converted.length > 0) {
        contents.push({ role, parts: converted });
      }
    } else if (isResponseInputFunctionCallOutput(item)) {
      const name = resolveToolName ? resolveToolName(item.call_id) : undefined;
      if (name) {
        contents.push({ role: "function", parts: [{ functionResponse: { name, response: item.output } }] });
      }
    } else if (isResponseInputFunctionToolCall(item)) {
      const args = parseArgs((item as { arguments?: unknown }).arguments);
      const part = fnCall((item as { name?: string }).name || "function", args);
      contents.push({ role: "user", parts: [part] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "custom_tool_call") {
      const args = parseArgs((item as { arguments?: unknown }).arguments);
      const name = (item as { name?: string }).name || "custom_tool";
      contents.push({ role: "user", parts: [fnCall(name, args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "custom_tool_call_output") {
      const name = (item as { name?: string }).name || "custom_tool";
      contents.push({ role: "function", parts: [{ functionResponse: { name, response: (item as { output?: unknown }).output } }] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "web_search_call") {
      const query = (item as { query?: unknown }).query;
      const args = typeof query === "string" ? { query } : undefined;
      contents.push({ role: "user", parts: [fnCall("web_search", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "image_generation_call") {
      const prompt = (item as { prompt?: unknown }).prompt;
      const args = typeof prompt === "string" ? { prompt } : undefined;
      contents.push({ role: "user", parts: [fnCall("generate_image", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "code_interpreter_call") {
      const code = (item as { code?: unknown }).code;
      const args = typeof code === "string" ? { code } : parseArgs(code);
      contents.push({ role: "user", parts: [fnCall("code_interpreter", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "computer_call") {
      const spec = isObject(item) ? (item as Record<string, unknown>) : undefined;
      const args = spec ? { ...spec } : undefined;
      contents.push({ role: "user", parts: [fnCall("computer_call", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "file_search_call") {
      const query = (item as { query?: unknown }).query;
      const args = typeof query === "string" ? { query } : undefined;
      contents.push({ role: "user", parts: [fnCall("file_search", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "local_shell_call") {
      const cmd = (item as { command?: unknown }).command;
      const args = typeof cmd === "string" ? { command: cmd } : undefined;
      contents.push({ role: "user", parts: [fnCall("local_shell", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "local_shell_call_output") {
      contents.push({ role: "function", parts: [{ functionResponse: { name: "local_shell", response: (item as { output?: unknown }).output } }] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "mcp_call") {
      const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
      contents.push({ role: "user", parts: [fnCall("mcp_call", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "mcp_approval_request") {
      const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
      contents.push({ role: "user", parts: [fnCall("mcp_approval_request", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "mcp_approval_response") {
      const args = isObject(item) ? { ...(item as Record<string, unknown>) } : undefined;
      contents.push({ role: "user", parts: [fnCall("mcp_approval_response", args)] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "mcp_list_tools") {
      contents.push({ role: "user", parts: [fnCall("mcp_list_tools")] });
    } else if (("type" in item) && (item as { type?: unknown }).type === "item_reference") {
      const id = (item as { id?: unknown }).id;
      const refText = typeof id === "string" ? `[ref:${id}]` : "[ref]";
      contents.push({ role: "user", parts: [{ text: refText }] });
    } else {
      try {
        const json = JSON.stringify(item);
        contents.push({ role: "user", parts: [{ text: json }] });
      } catch {
        // ignore
      }
    }
  }

  const body: GenerateContentRequest = { contents };
  const gen: NonNullable<GenerateContentRequest["generationConfig"]> = {};
  const p = params as { max_output_tokens?: number; temperature?: number; top_p?: number };
  if (typeof p.max_output_tokens === "number") { gen.maxOutputTokens = p.max_output_tokens; }
  if (typeof p.temperature === "number") { gen.temperature = p.temperature; }
  if (typeof p.top_p === "number") { gen.topP = p.top_p; }
  if (Object.keys(gen).length > 0) { body.generationConfig = gen; }
  return body;
}
