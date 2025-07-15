import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';
import { StatsUtils, EntityUtils, BatchUtils, GraphOperationUtils } from '../utils/index.js';

// Get Temporal Events Handler
class GetTemporalEventsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        startTime?: string; 
        endTime?: string; 
        entityName?: string; 
        relationType?: string; 
      }>();

      const start = args.startTime || '1970-01-01T00:00:00.000Z';
      const end = args.endTime || new Date().toISOString();
      
      const { entities, relations } = await this.persistenceService.getTemporalEvents(start, end);
      const filtered = StatsUtils.filterTemporalEvents(entities, relations, { 
        entityName: args.entityName, 
        relationType: args.relationType, 
        userId: this.userId 
      });

      return { entities: filtered.entities, relations: filtered.relations, timeRange: { start, end } };
    }, 'Failed to get temporal events');
  }
}

// Detect Duplicate Entities Handler
class DetectDuplicateEntitiesHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ threshold?: string }>();
      const threshold = args.threshold ? parseFloat(args.threshold) : 0.8;

      // DRY: Use utility for read-only graph operations
      const result = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => EntityUtils.detectDuplicates(graph, threshold)
      );
      
      return result;
    }, 'Failed to detect duplicate entities');
  }
}

// Merge Entities Handler
class MergeEntitiesHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        targetEntityName?: string; 
        sourceEntityNames?: string; 
        mergeStrategy?: string; 
      }>();

      if (!args.targetEntityName) {
        throw new Error('targetEntityName is required');
      }

      const sourceEntityNames = args.sourceEntityNames ? this.parseJsonArg(args.sourceEntityNames, 'sourceEntityNames') : [];
      this.validateArrayArg(sourceEntityNames, 'sourceEntityNames');

      const mergeStrategy = (args.mergeStrategy as 'combine' | 'replace') || 'combine';

      // DRY: Use utility for graph operations with automatic save
      const result = await GraphOperationUtils.executeGraphOperation(
        this.persistenceService,
        (graph) => EntityUtils.mergeEntities(graph, args.targetEntityName!, sourceEntityNames, mergeStrategy),
        () => true // Always save after merge
      );
      
      return result.mergedEntity;
    }, 'Failed to merge entities');
  }
}

// Execute Batch Operations Handler
class ExecuteBatchOperationsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ operations?: string }>();
      const operations = this.parseJsonArg(args.operations, 'operations');
      this.validateArrayArg(operations, 'operations');

      // Note: BatchUtils.executeBatchOperations is async, so we can't use GraphOperationUtils.executeGraphOperation
      // which expects synchronous operations. We handle the load/save pattern manually here.
      const graph = await this.persistenceService.loadGraph();
      const result = await BatchUtils.executeBatchOperations(graph, operations);
      
      if (result.updatedGraph) {
        await this.persistenceService.saveGraph(result.updatedGraph);
      }
      
      return { successful: result.successful, failed: result.failed, errors: result.errors, results: result.results };
    }, 'Failed to execute batch operations');
  }
}

// Get User Stats Handler
class GetUserStatsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ userId?: string }>();
      const userId = args.userId || this.userId;

      // DRY: Use utility for read-only graph operations
      const stats = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => StatsUtils.generateUserStats(graph, userId)
      );
      
      return stats;
    }, 'Failed to get user stats');
  }
}

// Export the handler functions using the factory
export async function getTemporalEvents(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(GetTemporalEventsHandler, context);
}

export async function detectDuplicateEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(DetectDuplicateEntitiesHandler, context);
}

export async function mergeEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(MergeEntitiesHandler, context);
}

export async function executeBatchOperations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(ExecuteBatchOperationsHandler, context);
}

export async function getUserStats(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(GetUserStatsHandler, context);
}
