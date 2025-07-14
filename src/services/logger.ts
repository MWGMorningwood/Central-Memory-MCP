import { InvocationContext } from '@azure/functions';

export class Logger {
  private context?: InvocationContext;

  constructor(context?: InvocationContext) {
    this.context = context;
  }

  info(message: string, meta?: any): void {
    const logMessage = `[INFO] ${new Date().toISOString()} - ${message}`;
    if (this.context) {
      this.context.log(logMessage, meta || '');
    } else {
      console.log(logMessage, meta || '');
    }
  }

  error(message: string, error?: any): void {
    const logMessage = `[ERROR] ${new Date().toISOString()} - ${message}`;
    if (this.context) {
      this.context.error(logMessage, error || '');
    } else {
      console.error(logMessage, error || '');
    }
  }

  warn(message: string, meta?: any): void {
    const logMessage = `[WARN] ${new Date().toISOString()} - ${message}`;
    if (this.context) {
      this.context.warn(logMessage, meta || '');
    } else {
      console.warn(logMessage, meta || '');
    }
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      const logMessage = `[DEBUG] ${new Date().toISOString()} - ${message}`;
      if (this.context) {
        this.context.debug(logMessage, meta || '');
      } else {
        console.debug(logMessage, meta || '');
      }
    }
  }
}
