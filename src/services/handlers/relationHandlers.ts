import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';
import { RelationUtils, GraphOperationUtils, UserContextUtils } from '../utils/index.js';

// Create Relations Handler
class CreateRelationsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ relations?: string }>();
      const relations = this.parseJsonArg(args.relations, 'relations');
      this.validateArrayArg(relations, 'relations');

      // DRY: Use utility for user context enhancement
      const enhancedRelations = UserContextUtils.enhanceRelationsWithUser(relations, this.userId);

      // DRY: Use utility for common graph operations
      const result = await GraphOperationUtils.executeGraphOperation(
        this.persistenceService,
        (graph) => RelationUtils.createRelations(graph, enhancedRelations),
        (result) => result.newRelations.length > 0
      );
      
      return result.newRelations;
    }, 'Failed to create relations');
  }
}

// Search Relations Handler
class SearchRelationsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        from?: string; 
        to?: string; 
        relationType?: string; 
      }>();

      // DRY: Use utility for read-only graph operations
      const results = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => RelationUtils.searchRelations(graph.relations, {
          from: args.from,
          to: args.to,
          relationType: args.relationType
        })
      );
      
      return results;
    }, 'Failed to search relations');
  }
}

// Search Relations By User Handler
class SearchRelationsByUserHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        userId?: string; 
        relationType?: string; 
      }>();

      // DRY: Use utility for read-only graph operations
      const results = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => RelationUtils.searchRelationsByUser(graph.relations, {
          userId: args.userId || this.userId,
          relationType: args.relationType
        })
      );
      
      return results;
    }, 'Failed to search relations by user');
  }
}

// Export the handler functions using the factory
export async function createRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(CreateRelationsHandler, context);
}

export async function searchRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(SearchRelationsHandler, context);
}

export async function searchRelationsByUser(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(SearchRelationsByUserHandler, context);
}
