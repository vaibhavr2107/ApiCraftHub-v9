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
export function createLogger(namespace: string) {
  // Set debug to true to see more detailed logs
  process.env.DEBUG = 'true';

  return {
    debug: (message: string, ...args: any[]) => {
      if (process.env.DEBUG === 'true') {
        console.debug(`[${namespace}] DEBUG: ${message}`, ...args);
      }
    },
    info: (message: string, ...args: any[]) => {
      console.log(`[${namespace}] INFO: ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${namespace}] WARN: ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`[${namespace}] ERROR: ${message}`, ...args);
    },
    logObject: (label: string, obj: any) => {
      if (process.env.DEBUG === 'true') {
        console.debug(`[${namespace}] DEBUG: ${label}:`);
        console.debug(JSON.stringify(obj, null, 2).substring(0, 1000) + (JSON.stringify(obj).length > 1000 ? '...' : ''));
      }
    }
  };
}