import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler } from './baseMcpHandler.js';
import { StatsUtils, GraphOperationUtils } from '../utils/index.js';
import { createHandlerExports } from './handlerFactory.js';

// Read Graph Handler
class ReadGraphHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      // DRY: Use utility for read-only graph operations
      const graph = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => graph
      );
      return graph;
    }, 'Failed to read graph');
  }
}

// Get Stats Handler
class GetStatsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      // DRY: Use utility for read-only graph operations
      const stats = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => StatsUtils.generateStats(graph, this.persistenceService.getWorkspaceId())
      );
      return stats;
    }, 'Failed to get stats');
  }
}

// Clear Memory Handler
class ClearMemoryHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      await this.persistenceService.clearMemory();
      return { success: true, message: "Memory cleared successfully" };
    }, 'Failed to clear memory');
  }
}

// DRY: Use factory function to create all exports at once
const { readGraph, getStats, clearMemory } = createHandlerExports({
  readGraph: ReadGraphHandler,
  getStats: GetStatsHandler,
  clearMemory: ClearMemoryHandler
});

export { readGraph, getStats, clearMemory };
