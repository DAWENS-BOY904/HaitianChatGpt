/**
 * Comprehensive Error Handling and Logging System
 * Replaces silent error suppression with proper error tracking and recovery
 */

// ============================================================================
// ERROR TYPES AND INTERFACES
// ============================================================================

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
  url?: string;
  userAgent?: string;
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
    code?: string;
  };
  metadata?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffMs: number;
    backoffMultiplier: number;
  };
  fallback?: {
    enabled: boolean;
    value: any;
  };
  userMessage?: string;
  alertUser?: boolean;
}

// ============================================================================
// ERROR LOGGER
// ============================================================================

class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private remoteEndpoint?: string;
  private batchSize = 10;
  private batchTimer?: NodeJS.Timeout;

  constructor(remoteEndpoint?: string) {
    this.remoteEndpoint = remoteEndpoint;
  }

  /**
   * Log an error with full context
   */
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
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        tags: context.tags,
      },
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      } : undefined,
      metadata,
    };

    this.logs.push(logEntry);

    // Keep logs array from growing too large
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to console
    this.logToConsole(logEntry);

    // Send to remote endpoint if configured
    if (this.remoteEndpoint) {
      this.queueRemoteLog(logEntry);
    }

    // Handle critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.handleCriticalError(logEntry);
    }
  }

  /**
   * Log to console with appropriate styling
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] ${entry.context.context}`;
    const style = this.getConsoleStyle(entry.level);

    if (entry.error) {
      console.error(`%c${prefix}: ${entry.message}`, style, entry.error);
    } else {
      console[entry.level === ErrorSeverity.INFO ? 'log' : entry.level === ErrorSeverity.WARNING ? 'warn' : 'error'](
        `%c${prefix}: ${entry.message}`,
        style,
        entry.metadata
      );
    }
  }

  /**
   * Get console styling for different severity levels
   */
  private getConsoleStyle(severity: ErrorSeverity): string {
    const styles: Record<ErrorSeverity, string> = {
      [ErrorSeverity.INFO]: 'color: #0066cc; font-weight: bold;',
      [ErrorSeverity.WARNING]: 'color: #ff9900; font-weight: bold;',
      [ErrorSeverity.ERROR]: 'color: #cc0000; font-weight: bold;',
      [ErrorSeverity.CRITICAL]: 'color: #ffffff; background-color: #cc0000; font-weight: bold; padding: 5px;',
    };
    return styles[severity];
  }

  /**
   * Queue log for remote transmission
   */
  private queueRemoteLog(entry: LogEntry): void {
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.flushRemoteLogs(), 5000);
    }
  }

  /**
   * Send batched logs to remote endpoint
   */
  private async flushRemoteLogs(): Promise<void> {
    if (this.logs.length === 0) return;

    const logsToSend = this.logs.splice(0, this.batchSize);

    try {
      await fetch(this.remoteEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
      // Re-add logs to queue for retry
      this.logs.unshift(...logsToSend);
    }

    if (this.logs.length > 0) {
      this.batchTimer = setTimeout(() => this.flushRemoteLogs(), 5000);
    } else {
      this.batchTimer = undefined;
    }
  }

  /**
   * Handle critical errors
   */
  private handleCriticalError(entry: LogEntry): void {
    // Send alert to monitoring service
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(`Critical Error: ${entry.message}\n\nPlease refresh the page or contact support.`);
    }
  }

  /**
   * Get all logs (for debugging)
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
}

// ============================================================================
// GLOBAL ERROR LOGGER INSTANCE
// ============================================================================

export const errorLogger = new ErrorLogger(
  typeof process !== 'undefined' && process.env.ERROR_LOGGING_ENDPOINT
    ? process.env.ERROR_LOGGING_ENDPOINT
    : undefined
);

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Wrap an async function with error handling and retry logic
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  strategy: ErrorRecoveryStrategy = {},
  metadata?: Record<string, any>
): Promise<T> {
  const maxAttempts = strategy.retry?.maxAttempts ?? 1;
  const backoffMs = strategy.retry?.backoffMs ?? 1000;
  const backoffMultiplier = strategy.retry?.backoffMultiplier ?? 2;

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
        if (strategy.fallback?.enabled) {
          return strategy.fallback.value;
        }
        throw error;
      }

      // Wait before retrying with exponential backoff
      const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`${context}: All retry attempts failed`);
}

/**
 * Wrap a sync function with error handling
 */
export function withErrorHandlingSync<T>(
  fn: () => T,
  context: string,
  strategy: ErrorRecoveryStrategy = {},
  metadata?: Record<string, any>
): T {
  try {
    return fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    errorLogger.log(ErrorSeverity.ERROR, context, { context }, err, metadata);

    if (strategy.fallback?.enabled) {
      return strategy.fallback.value;
    }

    throw error;
  }
}

/**
 * Create a safe async function that never throws
 */
export function createSafeAsyncFunction<T>(
  fn: () => Promise<T>,
  context: string,
  defaultValue: T,
  metadata?: Record<string, any>
): () => Promise<T> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorLogger.log(ErrorSeverity.WARNING, `${context} (using default value)`, { context }, err, metadata);
      return defaultValue;
    }
  };
}

/**
 * Create a safe sync function that never throws
 */
export function createSafeSyncFunction<T>(
  fn: () => T,
  context: string,
  defaultValue: T,
  metadata?: Record<string, any>
): () => T {
  return () => {
    try {
      return fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errorLogger.log(ErrorSeverity.WARNING, `${context} (using default value)`, { context }, err, metadata);
      return defaultValue;
    }
  };
}

// ============================================================================
// API ERROR HANDLING
// ============================================================================

export interface APIErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: Record<string, any>;
}

export interface APISuccessResponse<T> {
  success: true;
  data: T;
}

/**
 * Standardized API response type
 */
export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;

/**
 * Make an API call with error handling and retry logic
 */
export async function makeAPICall<T>(
  url: string,
  options: RequestInit = {},
  context: string = 'API Call',
  maxRetries: number = 3
): Promise<APIResponse<T>> {
  const backoffMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - retry with backoff
          const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            continue;
          }
        }

        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        errorLogger.log(
          ErrorSeverity.ERROR,
          `${context} failed after ${maxRetries} attempts`,
          { context },
          err,
          { url, attempt }
        );

        return {
          success: false,
          error: err.message,
          code: 'API_ERROR',
          details: { url, attempts: maxRetries },
        };
      }

      errorLogger.log(
        ErrorSeverity.WARNING,
        `${context} attempt ${attempt}/${maxRetries}`,
        { context },
        err,
        { url, attempt }
      );

      // Exponential backoff
      const delay = backoffMs * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return {
    success: false,
    error: 'Unknown error',
    code: 'UNKNOWN_ERROR',
  };
}

// ============================================================================
// STREAMING ERROR HANDLING
// ============================================================================

/**
 * Handle streaming responses with proper error handling and cleanup
 */
export async function handleStreamingResponse(
  response: Response,
  onChunk: (chunk: string) => void,
  context: string = 'Streaming'
): Promise<void> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await Promise.race([
        reader.read(),
        new Promise<{ done: boolean; value?: Uint8Array }>((_, reject) =>
          setTimeout(() => reject(new Error('Streaming timeout')), 60000)
        ),
      ]);

      if (done) break;

      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              onChunk(line);
            } catch (error) {
              errorLogger.log(
                ErrorSeverity.WARNING,
                `${context}: Error processing chunk`,
                { context },
                error instanceof Error ? error : new Error(String(error))
              );
            }
          }
        }

        buffer = lines[lines.length - 1];
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      onChunk(buffer);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorLogger.log(ErrorSeverity.ERROR, `${context}: Streaming failed`, { context }, err);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// GLOBAL ERROR HANDLERS
// ============================================================================

/**
 * Set up global error handlers for uncaught errors
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof window !== 'undefined') {
    // Handle uncaught errors
    window.addEventListener('error', (event: ErrorEvent) => {
      errorLogger.log(
        ErrorSeverity.CRITICAL,
        'Uncaught error',
        { context: 'global' },
        event.error,
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      errorLogger.log(
        ErrorSeverity.CRITICAL,
        'Unhandled promise rejection',
        { context: 'global' },
        error
      );
    });
  }
}

// ============================================================================
// EDGE FUNCTION RESPONSE STANDARDIZATION
// ============================================================================

/**
 * Standardized response for edge functions
 */
export function createEdgeFunctionResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  code?: string,
  status: number = success ? 200 : 400
): Response {
  return new Response(
    JSON.stringify({
      success,
      data,
      error,
      code,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Wrap edge function logic with error handling
 */
export async function withEdgeFunctionErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<Response> {
  try {
    const result = await fn();
    return createEdgeFunctionResponse(true, result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[${context}] Error:`, err);

    return createEdgeFunctionResponse(
      false,
      undefined,
      err.message,
      (error as any)?.code || 'INTERNAL_ERROR',
      500
    );
  }
}
