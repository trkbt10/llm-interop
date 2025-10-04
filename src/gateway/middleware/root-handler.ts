/**
 * @file Root endpoint handler for gateway surfaces.
 */

type RouteInfo = {
  /** Route path */
  path: string;
  /** HTTP methods supported */
  methods: string[];
  /** Description of the endpoint */
  description: string;
};

type RootResponse = {
  /** Gateway surface name */
  surface: string;
  /** Version information */
  version: string;
  /** Available routes */
  routes: RouteInfo[];
  /** Documentation URL */
  documentation?: string;
};

/**
 * Creates a root endpoint handler that returns API information.
 */
export function createRootHandler(surface: string, routes: RouteInfo[], documentation?: string) {
  return function handleRoot(request: Request): Response | null {
    const url = new URL(request.url);

    // Only handle GET requests to root path
    if (url.pathname !== "/" || request.method !== "GET") {
      return null;
    }

    const response: RootResponse = {
      surface,
      version: "v1",
      routes,
    };

    if (documentation) {
      response.documentation = documentation;
    }

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };
}

/**
 * OpenAI surface routes.
 */
export const OPENAI_ROUTES: RouteInfo[] = [
  {
    path: "/v1/chat/completions",
    methods: ["POST"],
    description: "Create a chat completion",
  },
  {
    path: "/v1/responses",
    methods: ["POST"],
    description: "Create a response (OpenAI Responses API)",
  },
];

/**
 * Anthropic surface routes.
 */
export const ANTHROPIC_ROUTES: RouteInfo[] = [
  {
    path: "/v1/messages",
    methods: ["POST"],
    description: "Create a message",
  },
  {
    path: "/v1/messages/count_tokens",
    methods: ["POST"],
    description: "Count tokens in a message",
  },
];

/**
 * Gemini surface routes.
 */
export const GEMINI_ROUTES: RouteInfo[] = [
  {
    path: "/v1/models/{model}:generateContent",
    methods: ["POST"],
    description: "Generate content",
  },
  {
    path: "/v1/models/{model}:streamGenerateContent",
    methods: ["POST"],
    description: "Stream generate content",
  },
  {
    path: "/v1/models/{model}:countTokens",
    methods: ["POST"],
    description: "Count tokens",
  },
  {
    path: "/v1/models/{model}:embedContent",
    methods: ["POST"],
    description: "Embed content",
  },
  {
    path: "/v1/models/{model}:batchEmbedContents",
    methods: ["POST"],
    description: "Batch embed contents",
  },
];
