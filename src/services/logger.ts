import { InvocationContext } from '@azure/functions';

export class Logger {
  private context?: InvocationContext;

  constructor(context?: InvocationContext) {
    this.context = context;
  }

  /**
   * DRY: Centralized logging method to eliminate repetitive patterns
   */
  private logInternal(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', message: string, meta?: any): void {
    const logMessage = `[${level}] ${new Date().toISOString()} - ${message}`;
    const metaData = meta || '';
    
    if (this.context) {
      switch (level) {
        case 'INFO':
          this.context.log(logMessage, metaData);
          break;
        case 'ERROR':
          this.context.error(logMessage, metaData);
          break;
        case 'WARN':
          this.context.warn(logMessage, metaData);
          break;
        case 'DEBUG':
          this.context.debug(logMessage, metaData);
          break;
      }
    } else {
      const consoleMethod = level === 'INFO' ? console.log : 
                          level === 'ERROR' ? console.error :
                          level === 'WARN' ? console.warn : console.debug;
      consoleMethod(logMessage, metaData);
    }
  }

  info(message: string, meta?: any): void {
    this.logInternal('INFO', message, meta);
  }

  error(message: string, error?: any): void {
    this.logInternal('ERROR', message, error);
  }

  warn(message: string, meta?: any): void {
    this.logInternal('WARN', message, meta);
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.logInternal('DEBUG', message, meta);
    }
  }
}
