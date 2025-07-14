import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';

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

      return await this.knowledgeGraphManager.getTemporalEvents({
        startTime: args.startTime,
        endTime: args.endTime,
        entityName: args.entityName,
        relationType: args.relationType,
        userId: this.userId
      });
    }, 'Failed to get temporal events');
  }
}

// Detect Duplicate Entities Handler
class DetectDuplicateEntitiesHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ threshold?: string }>();
      const threshold = args.threshold ? parseFloat(args.threshold) : 0.8;

      return await this.knowledgeGraphManager.detectDuplicateEntities(threshold);
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

      return await this.knowledgeGraphManager.mergeEntities(
        args.targetEntityName,
        sourceEntityNames,
        mergeStrategy,
        this.userId
      );
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

      return await this.knowledgeGraphManager.executeBatchOperations(operations);
    }, 'Failed to execute batch operations');
  }
}

// Get User Stats Handler
class GetUserStatsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ userId?: string }>();
      const userId = args.userId || this.userId;

      return await this.knowledgeGraphManager.getUserStats(userId);
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
