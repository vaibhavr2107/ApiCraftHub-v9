
import { log as viteLog } from '../vite';

/**
 * Logger utility for consistent logging across the application
 */
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log an informational message
   */
  info(message: string): void {
    viteLog(`[${this.context}] INFO: ${message}`);
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    viteLog(`[${this.context}] WARN: ${message}`, this.context);
  }

  /**
   * Log an error message with optional error object
   */
  error(message: string, error?: any): void {
    const errorMsg = error ? `${message} - ${error instanceof Error ? error.message : JSON.stringify(error)}` : message;
    viteLog(`[${this.context}] ERROR: ${errorMsg}`, this.context);
    
    // Log stack trace if available
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string): void {
    if (process.env.NODE_ENV !== 'production') {
      viteLog(`[${this.context}] DEBUG: ${message}`, this.context);
    }
  }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
