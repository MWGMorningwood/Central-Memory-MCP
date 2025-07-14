import { InvocationContext } from '@azure/functions';
import { BaseMcpHandler, executeMcpHandler } from './baseMcpHandler.js';

// Create Entities Handler
class CreateEntitiesHandler extends BaseMcpHandler {
  async execute(): Promise<string> {
    return this.executeWithErrorHandling(async () => {
      const args = this.getMcpArgs<{ entities?: string }>();
      const entities = this.parseJsonArg(args.entities, 'entities');
      this.validateArrayArg(entities, 'entities');

      // Add user context to entities
      const enhancedEntities = entities.map((entity: any) => ({
        ...entity,
        createdBy: entity.createdBy || this.userId,
      }));

      return await this.knowledgeGraphManager.createEntities(enhancedEntities, this.userId);
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

      return await this.knowledgeGraphManager.searchEntities({
        name: args.name,
        entityType: args.entityType
      });
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

      return await this.knowledgeGraphManager.addObservation(args.entityName, args.observation);
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

      return await this.knowledgeGraphManager.updateEntity(
        args.entityName,
        newObservations,
        this.userId,
        metadata
      );
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

      const result = await this.knowledgeGraphManager.deleteEntity(args.entityName);
      return { success: result, entityName: args.entityName };
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
