/**
 * @file Logger interface and implementation for gateway routing
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
};

export type LoggerConfig = {
  enabled?: boolean;
  level?: LogLevel;
  prefix?: string;
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Creates a console logger instance with configurable log levels and formatting.
 *
 * @param config - Logger configuration options
 * @returns Logger instance that outputs to console
 */
export function createConsoleLogger(config: LoggerConfig = {}): Logger {
  const enabled = config.enabled ?? true;
  const level = config.level ?? "info";
  const prefix = config.prefix ?? "[Gateway]";

  const shouldLog = (logLevel: LogLevel): boolean => {
    if (!enabled) { return false; }
    return LOG_LEVELS[logLevel] >= LOG_LEVELS[level];
  };

  const formatMessage = (message: string): string => {
    return `${prefix} ${message}`;
  };

  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog("debug")) {
        console.debug(formatMessage(message), ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog("info")) {
        console.log(formatMessage(message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog("warn")) {
        console.warn(formatMessage(message), ...args);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog("error")) {
        console.error(formatMessage(message), ...args);
      }
    },
  };
}

/**
 * Creates a no-operation logger that discards all log messages.
 * Used when logging is disabled or for testing purposes.
 *
 * @returns Logger instance that discards all messages
 */
export function createNoOpLogger(): Logger {
  return {
    debug(): void {
      // No-op - intentionally empty
    },
    info(): void {
      // No-op - intentionally empty
    },
    warn(): void {
      // No-op - intentionally empty
    },
    error(): void {
      // No-op - intentionally empty
    },
  };
}

/**
 * Factory function to create an appropriate logger based on configuration.
 *
 * @param config - Optional logger configuration
 * @returns Logger instance (NoOp if disabled, Console otherwise)
 */
export function createLogger(config?: LoggerConfig): Logger {
  if (config?.enabled === false) {
    return createNoOpLogger();
  }
  return createConsoleLogger(config);
}