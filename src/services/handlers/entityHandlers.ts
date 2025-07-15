import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';
import { EntityUtils, GraphOperationUtils, UserContextUtils } from '../utils/index.js';

// Create Entities Handler
class CreateEntitiesHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ entities?: string }>();
      const entities = this.parseJsonArg(args.entities, 'entities');
      this.validateArrayArg(entities, 'entities');

      // DRY: Use utility for user context enhancement
      const enhancedEntities = UserContextUtils.enhanceEntitiesWithUser(entities, this.userId);

      // DRY: Use utility for common graph operations
      const result = await GraphOperationUtils.executeGraphOperation(
        this.persistenceService,
        (graph) => EntityUtils.createEntities(graph, enhancedEntities, this.userId),
        (result) => result.newEntities.length > 0
      );
      
      return result.newEntities;
    }, 'Failed to create entities');
  }
}

// Search Entities Handler
class SearchEntitiesHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        name?: string; 
        entityType?: string; 
        fuzzyMatch?: string; 
      }>();

      // DRY: Use utility for read-only graph operations
      const results = await GraphOperationUtils.executeReadOnlyGraphOperation(
        this.persistenceService,
        (graph) => EntityUtils.searchEntities(graph.entities, {
          name: args.name,
          entityType: args.entityType
        })
      );
      
      return results;
    }, 'Failed to search entities');
  }
}

// Add Observation Handler
class AddObservationHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        entityName?: string; 
        observation?: string; 
      }>();

      if (!args.entityName || !args.observation) {
        throw new Error('Both entityName and observation are required');
      }

      const graph = await this.persistenceService.loadGraph();
      const result = EntityUtils.updateEntity(graph, args.entityName, [args.observation], this.userId);
      
      if (result.updatedEntity) {
        await this.persistenceService.saveGraph(result.updatedGraph);
      }
      
      return result.updatedEntity;
    }, 'Failed to add observation');
  }
}

// Update Entity Handler
class UpdateEntityHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ 
        entityName?: string; 
        newObservations?: string; 
        metadata?: string; 
      }>();

      if (!args.entityName) {
        throw new Error('entityName is required');
      }

      const newObservations = args.newObservations ? this.parseJsonArg(args.newObservations, 'newObservations') : [];
      const metadata = args.metadata ? this.parseJsonArg(args.metadata, 'metadata') : undefined;

      const graph = await this.persistenceService.loadGraph();
      const result = EntityUtils.updateEntity(graph, args.entityName, newObservations, this.userId, metadata);
      
      if (result.updatedEntity) {
        await this.persistenceService.saveGraph(result.updatedGraph);
      }
      
      return result.updatedEntity;
    }, 'Failed to update entity');
  }
}

// Delete Entity Handler
class DeleteEntityHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ entityName?: string }>();

      if (!args.entityName) {
        throw new Error('entityName is required');
      }

      const graph = await this.persistenceService.loadGraph();
      const result = EntityUtils.deleteEntity(graph, args.entityName);
      
      if (result.deleted) {
        await this.persistenceService.saveGraph(result.updatedGraph);
      }
      
      return { success: result.deleted, entityName: args.entityName };
    }, 'Failed to delete entity');
  }
}

// Export the handler functions using the factory
export async function createEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(CreateEntitiesHandler, context);
}

export async function searchEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(SearchEntitiesHandler, context);
}

export async function addObservation(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(AddObservationHandler, context);
}

export async function updateEntity(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(UpdateEntityHandler, context);
}

export async function deleteEntity(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return await executeMcpHandler(DeleteEntityHandler, context);
}
