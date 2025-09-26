import { InvocationContext } from '@azure/functions';
import { Entity, KnowledgeGraph } from '../types/index.js';
import { StorageService } from './storageService.js';
import { Logger } from './logger.js';
import {
  getMcpArgs,
  validateArrayArg,
  executeGraphOperation,
  executeGraphOperationWithReplacement,
  executeWithErrorHandling,
  getWorkspaceId,
  getUserId,
  enhanceEntitiesWithUser
} from './utils.js';

type CreateEntitiesResult = {
  entities: Entity[];
  created: string[];
  updated: string[];
  message: string;
};

type ObservationResult = {
  entity: Entity;
  created: boolean;
  message: string;
};

type DeleteEntityResult = {
  success: boolean;
  message: string;
};

/**
 * Create multiple new entities in the centralized knowledge graph
 */
export async function createEntities(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<CreateEntitiesResult> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entities?: any; workspaceId?: string }>(context);
    
    // Debug logging
    context.log('DEBUG - createEntities raw args:', JSON.stringify(args, null, 2));
    context.log('DEBUG - createEntities entities param:', args.entities);
    context.log('DEBUG - createEntities entities type:', typeof args.entities);
    
    if (!args.entities) {
      throw new Error('entities parameter is required. Please provide an entity object or an array of entity objects, each with name, entityType, and observations fields. Example: [{"name": "Alice", "entityType": "Person", "observations": ["Software engineer"]}]');
    }
    
    // Handle both string (JSON) and object inputs
    let entitiesData: any;
    if (typeof args.entities === 'string') {
      entitiesData = JSON.parse(args.entities);
    } else {
      entitiesData = args.entities;
    }
    
    const entities = Array.isArray(entitiesData) ? entitiesData : [entitiesData];
    validateArrayArg(entities, 'entities');
    
    // Validate entity structure with helpful error messages
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity.name || typeof entity.name !== 'string') {
        throw new Error(`Entity ${i + 1} must have a 'name' field (string). Example: {"name": "Alice", "entityType": "Person", "observations": ["Software engineer"]}`);
      }
      if (!entity.entityType || typeof entity.entityType !== 'string') {
        throw new Error(`Entity ${i + 1} must have an 'entityType' field (string). Example: {"name": "Alice", "entityType": "Person", "observations": ["Software engineer"]}`);
      }
      if (!entity.observations) {
        // Auto-create empty observations array if missing
        entity.observations = [];
        context.log(`Auto-created empty observations array for entity '${entity.name}'`);
      } else if (!Array.isArray(entity.observations)) {
        throw new Error(`Entity ${i + 1} 'observations' must be an array of strings. Example: {"name": "Alice", "entityType": "Person", "observations": ["Software engineer", "Works on React"]}`);
      } else if (!entity.observations.every((obs: any) => typeof obs === 'string')) {
        throw new Error(`Entity ${i + 1} 'observations' must only contain strings. Example: {"name": "Alice", "entityType": "Person", "observations": ["Software engineer", "Works on React"]}`);
      }
    }
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    // Enhance entities with user context
    const enhancedEntities = enhanceEntitiesWithUser(entities, userId);
    
    // Execute graph operation
    const result = await executeGraphOperation(
      storageService,
      (graph) => {
        const newEntities: Entity[] = [];
        const updatedEntities = [...graph.entities];
        const entitiesCreated: string[] = [];
        const entitiesUpdated: string[] = [];

        for (const entityData of enhancedEntities) {
          // Check if entity already exists
          const existingEntity = updatedEntities.find(e => e.name === entityData.name);
          
          if (existingEntity) {
            // Update existing entity with new observations
            const oldObservationCount = existingEntity.observations.length;
            existingEntity.observations = [...new Set([...existingEntity.observations, ...entityData.observations])];
            existingEntity.updatedAt = new Date().toISOString();
            newEntities.push(existingEntity);
            
            if (existingEntity.observations.length > oldObservationCount) {
              entitiesUpdated.push(existingEntity.name);
              context.log(`Updated existing entity '${existingEntity.name}' with new observations`);
            }
          } else {
            // Create new entity
            const newEntity: Entity = {
              name: entityData.name,
              entityType: entityData.entityType,
              observations: entityData.observations,
              createdBy: userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            updatedEntities.push(newEntity);
            newEntities.push(newEntity);
            entitiesCreated.push(newEntity.name);
            context.log(`Created new entity '${newEntity.name}' with type '${newEntity.entityType}'`);
          }
        }

        return {
          newEntities,
          entitiesCreated,
          entitiesUpdated,
          updatedGraph: { entities: updatedEntities, relations: graph.relations }
        };
      },
      (result) => result.newEntities.length > 0
    );
    
    const response: CreateEntitiesResult = {
      entities: result.newEntities,
      created: result.entitiesCreated,
      updated: result.entitiesUpdated,
      message: `Processed ${result.newEntities.length} entities: ${result.entitiesCreated.length} created, ${result.entitiesUpdated.length} updated`
    };
    
    return response;
  }, 'Failed to create entities');
}

/**
 * Search for entities by name or type
 */
export async function searchEntities(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<Entity[]> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ name?: string; entityType?: string; workspaceId?: string }>(context);
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const graph = await storageService.loadGraph();
    
    // Search entities by name or type
    const results = graph.entities.filter(entity => {
      const nameMatch = !args.name || entity.name.toLowerCase().includes(args.name.toLowerCase());
      const typeMatch = !args.entityType || entity.entityType.toLowerCase().includes(args.entityType.toLowerCase());
      return nameMatch && typeMatch;
    });
    
    return results;
  }, 'Failed to search entities');
}

/**
 * Add a new observation to an existing entity, with auto-creation if entity doesn't exist
 */
export async function addObservation(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<ObservationResult> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entityName?: string; observation?: string; entityType?: string; workspaceId?: string }>(context);
    
    if (!args.entityName || !args.observation) {
      throw new Error('entityName and observation are required. Please provide both parameters.');
    }
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeGraphOperation(
      storageService,
      (graph) => {
        let entity = graph.entities.find(e => e.name === args.entityName);
        let entityCreated = false;
        
        if (!entity) {
          // Auto-create entity if it doesn't exist
          const entityType = args.entityType || 'Unknown';
          entity = {
            name: args.entityName!,
            entityType: entityType,
            observations: [],
            createdBy: userId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          graph.entities.push(entity);
          entityCreated = true;
          
          context.log(`Auto-created entity '${args.entityName}' with type '${entityType}'`);
        }

        // Add observation if not already present
        if (!entity.observations.includes(args.observation!)) {
          entity.observations.push(args.observation!);
          entity.updatedAt = new Date().toISOString();
        }

        return {
          updatedEntity: entity,
          entityCreated: entityCreated,
          updatedGraph: { entities: graph.entities, relations: graph.relations }
        };
      },
      () => true
    );
    
    const response: ObservationResult = {
      entity: result.updatedEntity,
      created: result.entityCreated,
      message: result.entityCreated 
        ? `Created new entity '${args.entityName}' and added observation` 
        : `Added observation to existing entity '${args.entityName}'`
    };
    
    return response;
  }, 'Failed to add observation');
}

/**
 * Delete an entity and all its relations
 */
export async function deleteEntity(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<DeleteEntityResult> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entityName?: string; workspaceId?: string }>(context);
    
    if (!args.entityName) {
      throw new Error('entityName is required');
    }
    
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    // Execute graph operation with replacement to handle deletions
    const result = await executeGraphOperationWithReplacement(
      storageService,
      (graph) => {
        const entityExists = graph.entities.some(e => e.name === args.entityName);
        
        if (!entityExists) {
          throw new Error(`Entity '${args.entityName}' not found`);
        }

        const updatedEntities = graph.entities.filter(e => e.name !== args.entityName);
        const updatedRelations = graph.relations.filter(r => 
          r.from !== args.entityName && r.to !== args.entityName
        );

        return {
          deleted: true,
          updatedGraph: { entities: updatedEntities, relations: updatedRelations }
        };
      },
      (result) => result.deleted
    );
    
    return { success: true, message: `Entity '${args.entityName}' deleted successfully` };
  }, 'Failed to delete entity');
}

/**
 * Update an existing entity with new observations or metadata
 */
export async function updateEntity(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<Entity> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entityName?: string; newObservations?: any; metadata?: any; workspaceId?: string }>(context);
    
    if (!args.entityName) {
      throw new Error('entityName is required');
    }
    
    // Handle both string (JSON) and object inputs for newObservations
    let newObservations: any[] = [];
    if (args.newObservations) {
      if (typeof args.newObservations === 'string') {
        const parsed = JSON.parse(args.newObservations);
        newObservations = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        newObservations = Array.isArray(args.newObservations) ? args.newObservations : [args.newObservations];
      }
    }
    
    // Handle both string (JSON) and object inputs for metadata
    let metadata: any = undefined;
    if (args.metadata) {
      if (typeof args.metadata === 'string') {
        metadata = JSON.parse(args.metadata);
      } else {
        metadata = args.metadata;
      }
    }
    
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeGraphOperation(
      storageService,
      (graph) => {
        const entity = graph.entities.find(e => e.name === args.entityName);
        if (!entity) {
          throw new Error(`Entity '${args.entityName}' not found`);
        }

        // Add new observations
        if (newObservations && newObservations.length > 0) {
          entity.observations = [...new Set([...entity.observations, ...newObservations])];
        }

        // Update metadata if provided
        if (metadata) {
          Object.assign(entity, metadata);
        }

        entity.updatedAt = new Date().toISOString();

        return {
          updatedEntity: entity,
          updatedGraph: { entities: graph.entities, relations: graph.relations }
        };
      },
      () => true
    );
    
    return result.updatedEntity;
  }, 'Failed to update entity');
}
