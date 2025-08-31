/** @file Unit tests for listModels */
import { listModels } from "./list-models";
import type { OpenAICompatibleClient } from "../openai-client-types";

describe("openai-to-gemini-v1beta listModels", () => {
  it("maps OpenAI models to v1beta models", async () => {
    const client: OpenAICompatibleClient = {
      models: {
        list: async () => ({
          data: [
            { id: "gemini-1.5-pro", object: "model", created: 0, owned_by: "google" },
            { id: "gpt-4o", object: "model", created: 0, owned_by: "openai" },
          ],
        }),
      },
      responses: { create: async () => { throw new Error("not used") } },
      chat: { completions: { create: async () => { throw new Error("not used") } } },
    };

    const res = await listModels(client);
    expect(res.models[0].name).toBe("models/gemini-1.5-pro");
    expect(res.models[1].displayName).toBe("gpt-4o");
  });
});
