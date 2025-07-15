import { InvocationContext } from '@azure/functions';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import { Logger } from '../logger.js';
import { getWorkspaceId, getUserId } from '../utils/mcpUtils.js';

/**
 * Base class for MCP tool handlers
 * Eliminates repetitive setup code across all handlers
 */
export abstract class BaseMcpHandler {
  protected workspaceId: string;
  protected userId: string;
  protected logger: Logger;
  protected knowledgeGraphManager!: KnowledgeGraphManager; // Initialized in initialize()
  protected context: InvocationContext;

  constructor(context: InvocationContext) {
    this.context = context;
    this.workspaceId = getWorkspaceId(context);
    this.userId = getUserId(context);
    this.logger = new Logger(context);
  }

  /**
   * Initialize the knowledge graph manager
   */
  protected async initialize(): Promise<void> {
    this.knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(this.workspaceId, this.logger);
  }

  /**
   * Get MCP tool arguments with type safety
   */
  protected getMcpArgs<T = any>(): T {
    return this.context.triggerMetadata?.mcptoolargs as T;
  }

  /**
   * Parse JSON argument safely
   */
  protected parseJsonArg(arg: string | undefined, fieldName: string): any {
    if (!arg) {
      throw new Error(`No ${fieldName} provided`);
    }
    
    try {
      return JSON.parse(arg);
    } catch (error) {
      throw new Error(`Invalid JSON in ${fieldName}: ${error}`);
    }
  }

  /**
   * Validate array argument
   */
  protected validateArrayArg(data: any, fieldName: string): any[] {
    if (!Array.isArray(data)) {
      throw new Error(`${fieldName} must be an array`);
    }
    return data;
  }

  /**
   * Standard success response
   */
  protected successResponse(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Standard error response
   */
  protected errorResponse(message: string, details?: any): string {
    return JSON.stringify({ error: message, details }, null, 2);
  }

  /**
   * Execute handler with standard error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<string> {
    try {
      await this.initialize();
      const result = await operation();
      return this.successResponse(result);
    } catch (error) {
      this.context.error(errorMessage, error);
      return this.errorResponse(errorMessage, error);
    }
  }

  /**
   * Abstract method that subclasses must implement
   */
  abstract execute(): Promise<string>;
}

/**
 * Factory function to create and execute MCP handlers
 */
export async function executeMcpHandler<T extends BaseMcpHandler>(
  HandlerClass: new (context: InvocationContext) => T,
  context: InvocationContext
): Promise<string> {
  const handler = new HandlerClass(context);
  return await handler.execute();
}
