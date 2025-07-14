import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';

// Read Graph Handler
class ReadGraphHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      return await this.knowledgeGraphManager.readGraph();
    }, 'Failed to read graph');
  }
}

// Get Stats Handler
class GetStatsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      return await this.knowledgeGraphManager.getStats();
    }, 'Failed to get stats');
  }
}

// Clear Memory Handler
class ClearMemoryHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      await this.knowledgeGraphManager.clearMemory();
      return { success: true, message: "Memory cleared successfully" };
    }, 'Failed to clear memory');
  }
}

// Export the handler functions using the factory
export async function readGraph(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(ReadGraphHandler, context);
}

export async function getStats(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(GetStatsHandler, context);
}

export async function clearMemory(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(ClearMemoryHandler, context);
}
