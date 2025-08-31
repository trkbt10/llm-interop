/**
 * @file Network integration tests for Gemini to OpenAI streaming.
 * Requires GEMINI_API_KEY environment variable.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { GeminiFetchClient } from "../../providers/gemini/client/fetch-client";
import { geminiToOpenAIStream } from "./chat-completion/openai-stream-adapter";
import { requireApiKeys, conditionalNetworkTest } from "../../test-utils/network-test-guard";

type ChunkSummary = {
  texts: number;
  hasFunctionCall: boolean;
  functionName?: string;
};

async function logJSON(file: string, data: unknown) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function envModel(): string | null {
  const googleModel = process.env.GOOGLE_AI_TEST_MODEL;
  const geminiModel = process.env.GEMINI_TEST_MODEL;
  const m = googleModel ? googleModel : geminiModel ? geminiModel : null;
  return m ? m.replace(/^models\//, "") : null;
}

describe("Gemini stream integration (diagnostics)", () => {
  // Fail fast if API keys are missing
  beforeAll(() => {
    requireApiKeys(["GEMINI_API_KEY"]);
  });

  const apiKey = process.env.GEMINI_API_KEY!;
  const envModelResult = envModel();
  const model = envModelResult ? envModelResult : "gemini-pro";
  const maybe = conditionalNetworkTest({
    GEMINI_API_KEY: apiKey,
    MODEL: model,
  });

  maybe("streams long text with delta (diagnostic)", async () => {
    const client = new GeminiFetchClient({ apiKey: apiKey! });
    const input = {
      contents: [
        {
          role: "user" as const,
          parts: [
            {
              text: "200語以上の長文で、人工知能の歴史を複数段落で詳しく要約してください。段落の間に空行を入れ、箇条書きを1つ含めてください。",
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 512 },
    };

    // Collect raw chunk summaries
    const raw: ChunkSummary[] = [];
    async function* gen() {
      for await (const ch of client.streamGenerateContent(model!, input)) {
        const parts = (ch.candidates?.[0]?.content?.parts ? ch.candidates[0].content.parts : []) as Array<{
          text?: string;
          functionCall?: { name?: string };
        }>;
        const hasFunctionCall = parts.some((p) => Boolean(p.functionCall));
        const functionName = parts.find((p) => p.functionCall)?.functionCall?.name;
        const summary: ChunkSummary = {
          texts: parts.filter((p) => typeof p.text === "string" && p.text.length > 0).length,
          hasFunctionCall,
          functionName,
        };
        raw.push(summary);
        yield ch;
      }
    }

    // Convert to OpenAI stream events
    const events: string[] = [];
    for await (const ev of geminiToOpenAIStream(gen())) {
      events.push(ev.type);
    }

    await logJSON("reports/openai-compat/gemini-stream-diag.json", {
      case: "long_text_delta",
      model,
      request: input,
      raw,
      events,
    });

    // Do not fail here; this is diagnostic. But assert created/completed stability.
    expect(events[0]).toBe("response.created");
    expect(events[events.length - 1]).toBe("response.completed");
  });

  maybe("streams tool functionCall events when forced (diagnostic)", async () => {
    const client = new GeminiFetchClient({ apiKey: apiKey! });
    const tools = [
      {
        functionDeclarations: [
          {
            name: "get_current_ceiling",
            description: "Get the current cloud ceiling in a given location",
            parameters: {
              type: "object",
              properties: { location: { type: "string" } },
              required: ["location"],
            },
          },
        ],
      },
    ];
    const input = {
      contents: [
        {
          role: "user" as const,
          parts: [
            {
              text: "必ずツール get_current_ceiling を location=San Francisco で呼び出してください。テキストで回答しないでください。",
            },
          ],
        },
      ],
    } as const;
    const body = {
      contents: input.contents.map((content) => ({
        role: content.role,
        parts: [...content.parts],
      })),
      tools,
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["get_current_ceiling"],
        },
      },
      generationConfig: { maxOutputTokens: 64 },
    };

    const raw: ChunkSummary[] = [];
    async function* gen() {
      for await (const ch of client.streamGenerateContent(model!, body)) {
        const parts = (ch.candidates?.[0]?.content?.parts ? ch.candidates[0].content.parts : []) as Array<{
          text?: string;
          functionCall?: { name?: string };
        }>;
        const hasFunctionCall = parts.some((p) => Boolean(p.functionCall));
        const functionName = parts.find((p) => p.functionCall)?.functionCall?.name;
        const summary: ChunkSummary = {
          texts: parts.filter((p) => typeof p.text === "string" && p.text.length > 0).length,
          hasFunctionCall,
          functionName,
        };
        raw.push(summary);
        yield ch;
      }
    }

    const events: string[] = [];
    for await (const ev of geminiToOpenAIStream(gen())) {
      events.push(ev.type);
    }

    await logJSON("reports/openai-compat/gemini-stream-diag.json", {
      case: "tool_call_stream",
      model,
      request: body,
      raw,
      events,
    });

    expect(events[0]).toBe("response.created");
    expect(events[events.length - 1]).toBe("response.completed");
  });
});
