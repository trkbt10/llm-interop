/**
 * @file Runtime validators for Gemini v1beta response-like shapes using forgiving checks.
 * Produce rich error diagnostics to screen whether types or data are at fault.
 */

type Issue = { path: string; message: string };

function isObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  return true;
}

function push(issues: Issue[], path: string, msg: string) {
  issues.push({ path, message: msg });
}

/** Checks if a part has a string text field. */
export function isTextPart(v: unknown): v is { text: string } {
  if (!isObject(v)) {
    return false;
  }
  return typeof (v as { text?: unknown }).text === "string";
}

/** Checks if a part is a functionCall with a name. */
export function isFunctionCallPart(v: unknown): v is { functionCall: { name: string; args?: unknown } } {
  if (!isObject(v)) {
    return false;
  }
  const maybe = (v as { functionCall?: unknown }).functionCall;
  if (!isObject(maybe)) {
    return false;
  }
  return typeof (maybe as { name?: unknown }).name === "string";
}

/** Checks if a part is a functionResponse with a name. */
export function isFunctionResponsePart(v: unknown): v is { functionResponse: { name: string; response?: unknown } } {
  if (!isObject(v)) {
    return false;
  }
  const maybe = (v as { functionResponse?: unknown }).functionResponse;
  if (!isObject(maybe)) {
    return false;
  }
  return typeof (maybe as { name?: unknown }).name === "string";
}

/**
 * Checks if a value is a supported Gemini part (text | functionCall | functionResponse).
 */
export function isGeminiPart(v: unknown): v is { text?: string; functionCall?: unknown; functionResponse?: unknown } {
  if (isTextPart(v)) {
    return true;
  }
  if (isFunctionCallPart(v)) {
    return true;
  }
  if (isFunctionResponsePart(v)) {
    return true;
  }
  return false;
}

/** Validate content shape: { parts: [part...] , role? } */
export function validateGeminiContent(v: unknown, path = "content"): Issue[] {
  const issues: Issue[] = [];
  if (!isObject(v)) {
    push(issues, path, "not an object");
    return issues;
  }
  if (!Array.isArray(v.parts)) {
    push(issues, `${path}.parts`, "missing parts[] array");
    return issues;
  }
  v.parts.forEach((p, i) => {
    if (!isGeminiPart(p)) {
      push(issues, `${path}.parts[${i}]`, "not a supported part (text|functionCall|functionResponse)");
    }
  });
  if (v.role !== undefined && typeof v.role !== "string") {
    push(issues, `${path}.role`, "role must be string if present");
  }
  return issues;
}

/** Validate a GenerateContentResponse-like object. */
export function validateGeminiResponseLike(v: unknown, path = "$"): Issue[] {
  const issues: Issue[] = [];
  if (!isObject(v)) {
    push(issues, path, "not an object");
    return issues;
  }
  // Accept Google error envelope objects for fixture screening
  if ("error" in (v as Record<string, unknown>)) {
    return issues;
  }
  const cands = (v as Record<string, unknown>).candidates;
  if (!Array.isArray(cands)) {
    push(issues, `${path}.candidates`, "missing candidates[]");
    return issues;
  }
  cands.forEach((c, i) => {
    if (!isObject(c)) {
      push(issues, `${path}.candidates[${i}]`, "candidate not an object");
      return;
    }
    const content = (c as Record<string, unknown>).content;
    if (content !== undefined) {
      issues.push(...validateGeminiContent(content, `${path}.candidates[${i}].content`));
    }
    const finish = (c as Record<string, unknown>).finishReason;
    if (finish !== undefined && typeof finish !== "string") {
      push(issues, `${path}.candidates[${i}].finishReason`, "finishReason must be string if present");
    }
  });
  // usageMetadata and other fields are optional; basic numeric checks
  const usage = (v as Record<string, unknown>).usageMetadata;
  if (usage !== undefined) {
    if (!isObject(usage)) {
      push(issues, `${path}.usageMetadata`, "must be object if present");
    } else {
      ["promptTokenCount", "candidatesTokenCount", "totalTokenCount"].forEach((k) => {
        const val = (usage as Record<string, unknown>)[k];
        if (val !== undefined && typeof val !== "number") {
          push(issues, `${path}.usageMetadata.${k}`, "must be number if present");
        }
      });
    }
  }
  return issues;
}

/** Human-readable summary of issues for diagnostics */
export function summarizeIssues(file: string, line: number | null, issues: Issue[]): string {
  const head = `${file}${line !== null ? `:${line}` : ""}`;
  return `${head}:\n` + issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n");
}
