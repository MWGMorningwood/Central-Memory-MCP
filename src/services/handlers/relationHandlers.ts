import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';

// Create Relations Handler
class CreateRelationsHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ relations?: string }>();
      const relations = this.parseJsonArg(args.relations, 'relations');
      this.validateArrayArg(relations, 'relations');

      // Add user context to relations
      const enhancedRelations = relations.map((rel: any) => ({
        ...rel,
        createdBy: rel.createdBy || this.userId,
        strength: rel.strength !== undefined ? rel.strength : (rel.strength === 0 ? 0 : 0.8),
      }));

      return await this.knowledgeGraphManager.createRelations(enhancedRelations);
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

      return await this.knowledgeGraphManager.searchRelations({
        from: args.from,
        to: args.to,
        relationType: args.relationType
      });
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

      return await this.knowledgeGraphManager.searchRelationsByUser({
        userId: args.userId || this.userId,
        relationType: args.relationType
      });
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
