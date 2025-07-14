import { InvocationContext } from '@azure/functions';

/**
 * Extracts workspace ID from MCP tool arguments
 */
export function getWorkspaceId(context: InvocationContext): string {
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as { workspaceId?: string };
  return mcptoolargs?.workspaceId || 'default';
}

/**
 * Extracts user ID from MCP tool arguments
 * Falls back to OS username if not provided
 */
export function getUserId(context: InvocationContext): string {
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as { userId?: string };
  return mcptoolargs?.userId || process.env.USERNAME || process.env.USER || 'anonymous';
}

/**
 * Safely parses JSON strings with error handling
 */
export function safeJsonParse<T>(jsonString: string | undefined, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Formats error responses consistently
 */
export function formatErrorResponse(message: string, error?: unknown): string {
  return JSON.stringify({ 
    error: message, 
    details: error instanceof Error ? error.message : error 
  }, null, 2);
}

/**
 * Formats success responses consistently
 */
export function formatSuccessResponse(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
