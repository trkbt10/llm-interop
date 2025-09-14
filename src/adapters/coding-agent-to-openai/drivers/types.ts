/**
 * @file Driver interfaces for coding-agent adapter
 */

export type CodingAgentKind = "claude-code" | "codex-cli" | "gemini-cli" | (string & {});

export type AgentSessionPaths = {
  rootDir: string;
  inputPath: string;
  outputPath: string; // text stream written by the driver
  resultPath?: string; // optional structured result (driver-defined)
};

export type ProcessHandle = {
  /** Optional metadata or process id */
  pid?: number;
};

export type CodingAgentDriver = {
  /**
   * Start execution by writing prompt to session.inputPath, and producing outputs to session.outputPath.
   */
  start(prompt: string, session: AgentSessionPaths): Promise<ProcessHandle>;
  /**
   * Stop the execution if supported (best-effort).
   */
  stop?(handle: ProcessHandle): Promise<void>;
  /**
   * Optionally parse a structured result if the driver emits one.
   */
  parseResult?(stdoutOrFile: string): {
    text: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
};
