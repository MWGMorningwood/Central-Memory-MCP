import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';

/**
 * DRY factory function for handler exports
 * Eliminates repetitive export function declarations
 */
export function createHandlerExport<T extends BaseMcpHandler>(
  HandlerClass: new (context: InvocationContext) => T
): (toolArguments: unknown, context: InvocationContext) => Promise<string> {
  return async function(_toolArguments: unknown, context: InvocationContext): Promise<string> {
    return await executeMcpHandler(HandlerClass, context);
  };
}

/**
 * DRY utility to create multiple handler exports at once
 * Further reduces boilerplate in handler files
 */
export function createHandlerExports<T extends Record<string, new (context: InvocationContext) => BaseMcpHandler>>(
  handlerClasses: T
): {
  [K in keyof T]: (toolArguments: unknown, context: InvocationContext) => Promise<string>;
} {
  const exports = {} as any;
  
  for (const [key, HandlerClass] of Object.entries(handlerClasses)) {
    exports[key] = createHandlerExport(HandlerClass);
  }
  
  return exports;
}
