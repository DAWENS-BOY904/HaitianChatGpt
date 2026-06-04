/**
 * Error Handling Module for HaitianChatGpt
 * Simplified version for React Native
 */

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface ErrorContext {
  context: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  tags?: Record<string, string>;
}

export interface LogEntry {
  level: ErrorSeverity;
  message: string;
  context: ErrorContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 500;

  log(
    severity: ErrorSeverity,
    message: string,
    context: Partial<ErrorContext>,
    error?: Error,
    metadata?: Record<string, any>
  ): void {
    const logEntry: LogEntry = {
      level: severity,
      message,
      context: {
        context: context.context || 'unknown',
        userId: context.userId,
        sessionId: context.sessionId,
        timestamp: new Date().toISOString(),
        tags: context.tags,
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      metadata,
    };

    this.logs.push(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console
    const prefix = `[${severity.toUpperCase()}] ${context.context}`;
    if (error) {
      console.error(prefix, error.message, metadata);
    } else {
      console.log(prefix, message, metadata);
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const errorLogger = new ErrorLogger();

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  options: {
    retry?: { enabled: boolean; maxAttempts: number; backoffMs: number };
    fallback?: { enabled: boolean; value: any };
    userMessage?: string;
  } = {},
  metadata?: Record<string, any>
): Promise<T> {
  const maxAttempts = options.retry?.maxAttempts ?? 1;
  const backoffMs = options.retry?.backoffMs ?? 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      const err = error instanceof Error ? error : new Error(String(error));

      errorLogger.log(
        isLastAttempt ? ErrorSeverity.ERROR : ErrorSeverity.WARNING,
        `${context} (attempt ${attempt}/${maxAttempts})`,
        { context },
        err,
        { ...metadata, attempt }
      );

      if (isLastAttempt) {
        if (options.fallback?.enabled) {
          return options.fallback.value;
        }
        throw error;
      }

      const delay = backoffMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`${context}: All retry attempts failed`);
}
