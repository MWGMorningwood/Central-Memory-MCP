import { InvocationContext } from '@azure/functions';
import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { Logger } from './logger.js';
import { StorageService } from './storageService.js';

// =============================================================================
// CENTRALIZED MCP HELPER FUNCTIONS
// =============================================================================

/**
 * Extract MCP arguments from context with proper typing
 */
export function getMcpArgs<T>(context: InvocationContext): T {
  const args = context.triggerMetadata?.mcptoolargs;
  if (!args || typeof args !== 'object') {
    throw new Error('No MCP tool arguments found in context');
  }
  return args as T;
}

/**
 * Parse JSON argument with validation
 */
export function parseJsonArg(arg: any, argName: string): any {
  if (!arg) {
    throw new Error(`Parameter '${argName}' is required`);
  }
  
  if (typeof arg === 'string') {
    try {
      return JSON.parse(arg);
    } catch (error) {
      throw new Error(`Invalid JSON for parameter '${argName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  return arg;
}

/**
 * Validate array argument
 */
export function validateArrayArg(arg: any, argName: string): void {
  if (!Array.isArray(arg)) {
    throw new Error(`Parameter '${argName}' must be an array`);
  }
}

/**
 * Execute operation with standardized error handling
 */
export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext?: string
): Promise<string> {
  try {
    const result = await operation();
    return JSON.stringify(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const contextualError = errorContext ? `${errorContext}: ${errorMessage}` : errorMessage;
    throw new Error(contextualError);
  }
}

/**
 * Execute graph operation with persistence
 */
export async function executeGraphOperation<T>(
  persistenceService: StorageService,
  operation: (graph: KnowledgeGraph) => T,
  shouldSave?: (result: T) => boolean
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  const result = operation(graph);
  
  // Check if result has updatedGraph and should be saved
  if (result && typeof result === 'object' && 'updatedGraph' in result) {
    if (!shouldSave || shouldSave(result)) {
      await persistenceService.saveGraph((result as any).updatedGraph);
    }
  }
  
  return result;
}

/**
 * Execute graph operation with full replacement (handles deletions)
 */
export async function executeGraphOperationWithReplacement<T>(
  persistenceService: StorageService,
  operation: (graph: KnowledgeGraph) => T,
  shouldSave?: (result: T) => boolean
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  const result = operation(graph);
  
  // Check if result has updatedGraph and should be saved
  if (result && typeof result === 'object' && 'updatedGraph' in result) {
    if (!shouldSave || shouldSave(result)) {
      // For delete operations, we need to replace the entire graph
      const updatedGraph = (result as any).updatedGraph;
      
      // Find entities to delete
      const entitiesToDelete = graph.entities.filter(current => 
        !updatedGraph.entities.some((updated: any) => updated.name === current.name)
      );
      
      // Find relations to delete
      const relationsToDelete = graph.relations.filter(current => 
        !updatedGraph.relations.some((updated: any) => 
          updated.from === current.from && 
          updated.to === current.to && 
          updated.relationType === current.relationType
        )
      );
      
      // Delete obsolete entries
      await Promise.all([
        ...entitiesToDelete.map(entity => persistenceService.deleteEntity(entity.name)),
        ...relationsToDelete.map(relation => 
          persistenceService.deleteRelation(relation.from, relation.to, relation.relationType)
        )
      ]);
      
      // Upsert new/updated entries
      await persistenceService.saveGraph(updatedGraph);
    }
  }
  
  return result;
}

// =============================================================================
// MCP UTILITY FUNCTIONS
// =============================================================================

export function createMcpResponse(result: any, error?: string): any {
  if (error) {
    return {
      isError: true,
      error: error
    };
  }
  return {
    isError: false,
    result: result
  };
}

export function validateWorkspaceId(workspaceId: string): boolean {
  return Boolean(workspaceId && workspaceId.trim().length > 0);
}

export function validateEntityName(entityName: string): boolean {
  return Boolean(entityName && entityName.trim().length > 0);
}

export function validateRelationType(relationType: string): boolean {
  return Boolean(relationType && relationType.trim().length > 0);
}

// Graph operation utilities
export async function executeReadOnlyGraphOperation<T>(
  persistenceService: StorageService,
  operation: (graph: KnowledgeGraph) => T
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  return operation(graph);
}

// User context utilities
export function getUserContext(context: InvocationContext): { userId: string } {
  // For now, return a default user ID
  // In a real implementation, this would extract from authentication context
  return { userId: 'default-user' };
}

export function enrichEntityWithUserContext(entity: Entity, context: InvocationContext): Entity {
  const userContext = getUserContext(context);
  return {
    ...entity,
    createdBy: userContext.userId,
    updatedAt: new Date().toISOString()
  };
}

export function enrichRelationWithUserContext(relation: Relation, context: InvocationContext): Relation {
  const userContext = getUserContext(context);
  return {
    ...relation,
    createdBy: userContext.userId,
    createdAt: new Date().toISOString()
  };
}

// Entity transformation utilities
export function transformEntityForOutput(entity: Entity): any {
  return {
    name: entity.name,
    entityType: entity.entityType,
    observations: entity.observations,
    metadata: entity.metadata,
    createdBy: entity.createdBy,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
}

export function transformRelationForOutput(relation: Relation): any {
  return {
    from: relation.from,
    to: relation.to,
    relationType: relation.relationType,
    strength: relation.strength,
    createdBy: relation.createdBy,
    createdAt: relation.createdAt
  };
}

// Array transformation utilities
export function transformEntitiesForOutput(entities: Entity[]): any[] {
  return entities.map(transformEntityForOutput);
}

export function transformRelationsForOutput(relations: Relation[]): any[] {
  return relations.map(transformRelationForOutput);
}

// Parsing utilities
export function parseJsonArray(jsonString: string): any[] {
  try {
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    throw new Error(`Invalid JSON array: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parseJsonObject(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON object: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Logging utilities
export function logOperationStart(operation: string, workspaceId: string, context: InvocationContext): void {
  const userContext = getUserContext(context);
  const logger = new Logger(context);
  logger.info(`Starting ${operation} for workspace ${workspaceId} by user ${userContext.userId}`);
}

export function logOperationEnd(operation: string, workspaceId: string, context: InvocationContext): void {
  const userContext = getUserContext(context);
  const logger = new Logger(context);
  logger.info(`Completed ${operation} for workspace ${workspaceId} by user ${userContext.userId}`);
}

export function logError(operation: string, error: Error, context: InvocationContext): void {
  const userContext = getUserContext(context);
  const logger = new Logger(context);
  logger.error(`Error in ${operation} for user ${userContext.userId}:`, error);
}

// MCP tool property utilities
export function createMcpToolProperties(
  description: string,
  required: string[] = [],
  optional: Record<string, any> = {}
): any {
  const properties: any = {
    workspaceId: {
      type: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")'
    },
    ...optional
  };

  const requiredFields = ['workspaceId', ...required];

  return {
    type: 'object',
    properties,
    required: requiredFields
  };
}

export function createEntityProperties(): any {
  return {
    entityName: {
      type: 'string',
      description: 'Name of the entity'
    },
    entityType: {
      type: 'string',
      description: 'Type of the entity'
    },
    observations: {
      type: 'string',
      description: 'JSON string array of observations'
    },
    metadata: {
      type: 'string',
      description: 'JSON string object of metadata'
    }
  };
}

export function createRelationProperties(): any {
  return {
    from: {
      type: 'string',
      description: 'Source entity name'
    },
    to: {
      type: 'string',
      description: 'Target entity name'
    },
    relationType: {
      type: 'string',
      description: 'Type of relationship'
    },
    strength: {
      type: 'number',
      description: 'Relationship strength (0.0 to 1.0)'
    }
  };
}

// Time utilities
export function parseTimeString(timeString: string): Date {
  const date = new Date(timeString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid time format: ${timeString}`);
  }
  return date;
}

export function formatTimeString(date: Date): string {
  return date.toISOString();
}

// Validation utilities
export function validateThreshold(threshold: string): number {
  const parsed = parseFloat(threshold);
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    throw new Error('Threshold must be a number between 0.0 and 1.0');
  }
  return parsed;
}

export function validateMergeStrategy(strategy: string): string {
  const validStrategies = ['combine', 'replace'];
  if (!validStrategies.includes(strategy)) {
    throw new Error(`Invalid merge strategy: ${strategy}. Must be one of: ${validStrategies.join(', ')}`);
  }
  return strategy;
}

export function validateEntityNames(entityNames: string[]): void {
  if (!Array.isArray(entityNames) || entityNames.length === 0) {
    throw new Error('Entity names must be a non-empty array');
  }
  
  for (const name of entityNames) {
    if (!validateEntityName(name)) {
      throw new Error(`Invalid entity name: ${name}`);
    }
  }
}

// Search utilities
export function createSearchFilter(
  name?: string,
  entityType?: string,
  from?: string,
  to?: string,
  relationType?: string
): any {
  const filter: any = {};
  
  if (name) filter.name = name;
  if (entityType) filter.entityType = entityType;
  if (from) filter.from = from;
  if (to) filter.to = to;
  if (relationType) filter.relationType = relationType;
  
  return filter;
}

export function applySearchFilter<T>(items: T[], filter: any): T[] {
  return items.filter(item => {
    for (const [key, value] of Object.entries(filter)) {
      if (value && item && typeof item === 'object' && key in item) {
        const itemValue = (item as any)[key];
        if (itemValue && typeof itemValue === 'string' && typeof value === 'string') {
          if (!itemValue.toLowerCase().includes(value.toLowerCase())) {
            return false;
          }
        }
      }
    }
    return true;
  });
}

// =============================================================================
// WORKSPACE AND USER UTILITIES
// =============================================================================

/**
 * Get workspace ID from context
 */
export function getWorkspaceId(context: InvocationContext): string {
  // Extract from MCP arguments or use default
  const args = getMcpArgs(context);
  return (args as any)?.workspaceId || 'default';
}

/**
 * Get user ID from context
 */
export function getUserId(context: InvocationContext): string {
  return getUserContext(context).userId;
}

/**
 * Enhance entities with user context
 */
export function enhanceEntitiesWithUser(entities: any[], userId: string): any[] {
  return entities.map(entity => {
    // Validate entity structure before enhancing
    validateEntity(entity);
    
    return {
      ...entity,
      createdBy: userId,
      updatedAt: new Date().toISOString(),
      createdAt: entity.createdAt || new Date().toISOString()
    };
  });
}

// =============================================================================
// BATCH OPERATION UTILITIES
// =============================================================================

export class BatchUtils {
  static async executeBatchOperations(graph: KnowledgeGraph, operations: any[]): Promise<any> {
    const results = [];
    
    for (const operation of operations) {
      try {
        let result;
        
        switch (operation.type) {
          case 'create_entity':
            const newEntity = operation.entity;
            if (!graph.entities.find(e => e.name === newEntity.name)) {
              graph.entities.push(newEntity);
              result = { success: true, entity: newEntity };
            } else {
              result = { success: false, error: 'Entity already exists' };
            }
            break;
            
          case 'create_relation':
            const newRelation = operation.relation;
            graph.relations.push(newRelation);
            result = { success: true, relation: newRelation };
            break;
            
          case 'update_entity':
            const entityIndex = graph.entities.findIndex(e => e.name === operation.entityName);
            if (entityIndex !== -1) {
              graph.entities[entityIndex] = {
                ...graph.entities[entityIndex],
                ...operation.updates
              };
              result = { success: true, entity: graph.entities[entityIndex] };
            } else {
              result = { success: false, error: 'Entity not found' };
            }
            break;
            
          case 'delete_entity':
            const entityToDeleteIndex = graph.entities.findIndex(e => e.name === operation.entityName);
            if (entityToDeleteIndex !== -1) {
              graph.entities.splice(entityToDeleteIndex, 1);
              // Also remove related relations
              graph.relations = graph.relations.filter(
                rel => rel.from !== operation.entityName && rel.to !== operation.entityName
              );
              result = { success: true };
            } else {
              result = { success: false, error: 'Entity not found' };
            }
            break;
            
          default:
            result = { success: false, error: `Unknown operation type: ${operation.type}` };
        }
        
        results.push(result);
      } catch (error) {
        results.push({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    return {
      results,
      updatedGraph: graph
    };
  }
}

/**
 * Validate entity structure
 */
export function validateEntity(entity: any): void {
  if (!entity || typeof entity !== 'object') {
    throw new Error('Entity must be an object');
  }
  
  if (!entity.name || typeof entity.name !== 'string') {
    throw new Error('Entity must have a name (string)');
  }
  
  if (!entity.entityType || typeof entity.entityType !== 'string') {
    throw new Error('Entity must have an entityType (string)');
  }
  
  if (!entity.observations || !Array.isArray(entity.observations)) {
    throw new Error('Entity must have observations (array)');
  }
}
