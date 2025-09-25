import { InvocationContext } from '@azure/functions';
import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { StorageService } from './storageService.js';
import { Logger } from './logger.js';
import { 
  getWorkspaceId,
  getUserId,
  BatchUtils,
  executeGraphOperation,
  executeReadOnlyGraphOperation,
  executeWithErrorHandling
} from './utils.js';
import { calculateEntitySimilarity, mergeEntitiesInGraph, detectDuplicateEntities as detectDuplicateEntitiesInGraph } from './entities.js';

// =============================================================================
// STATISTICS UTILITIES
// =============================================================================

/**
 * Generate overall statistics for a knowledge graph
 */
export function generateGraphStats(
  graph: KnowledgeGraph,
  workspaceId: string
): {
  totalEntities: number;
  totalRelations: number;
  entityTypes: Record<string, number>;
  relationTypes: Record<string, number>;
  averageObservationsPerEntity: number;
  workspaceId: string;
} {
  const entityTypes: Record<string, number> = {};
  const relationTypes: Record<string, number> = {};
  
  // Count entity types
  graph.entities.forEach(entity => {
    entityTypes[entity.entityType] = (entityTypes[entity.entityType] || 0) + 1;
  });
  
  // Count relation types
  graph.relations.forEach(relation => {
    relationTypes[relation.relationType] = (relationTypes[relation.relationType] || 0) + 1;
  });
  
  // Calculate average observations per entity
  const totalObservations = graph.entities.reduce((sum, entity) => sum + entity.observations.length, 0);
  const averageObservationsPerEntity = graph.entities.length > 0 ? totalObservations / graph.entities.length : 0;
  
  return {
    totalEntities: graph.entities.length,
    totalRelations: graph.relations.length,
    entityTypes,
    relationTypes,
    averageObservationsPerEntity,
    workspaceId
  };
}

/**
 * Generate user-specific statistics
 */
export function generateUserStats(
  graph: KnowledgeGraph,
  userId: string
): {
  entitiesCreated: number;
  relationsCreated: number;
  recentActivity: {
    entities: Entity[];
    relations: Relation[];
  };
  topEntityTypes: Record<string, number>;
  topRelationTypes: Record<string, number>;
} {
  const userEntities = graph.entities.filter(e => e.createdBy === userId);
  const userRelations = graph.relations.filter(r => r.createdBy === userId);
  
  // Get recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentEntities = userEntities.filter(e => 
    e.createdAt && new Date(e.createdAt) > thirtyDaysAgo
  );
  const recentRelations = userRelations.filter(r => 
    r.createdAt && new Date(r.createdAt) > thirtyDaysAgo
  );
  
  // Count entity types
  const topEntityTypes: Record<string, number> = {};
  userEntities.forEach(entity => {
    topEntityTypes[entity.entityType] = (topEntityTypes[entity.entityType] || 0) + 1;
  });
  
  // Count relation types
  const topRelationTypes: Record<string, number> = {};
  userRelations.forEach(relation => {
    topRelationTypes[relation.relationType] = (topRelationTypes[relation.relationType] || 0) + 1;
  });
  
  return {
    entitiesCreated: userEntities.length,
    relationsCreated: userRelations.length,
    recentActivity: {
      entities: recentEntities,
      relations: recentRelations
    },
    topEntityTypes,
    topRelationTypes
  };
}

/**
 * Filter temporal events by criteria
 */
export function filterTemporalEvents(
  entities: (Entity & { actionType: 'created' | 'updated' })[],
  relations: (Relation & { actionType: 'created' | 'updated' })[],
  filter: {
    entityName?: string;
    relationType?: string;
    userId?: string;
  }
): {
  entities: (Entity & { actionType: 'created' | 'updated' })[];
  relations: (Relation & { actionType: 'created' | 'updated' })[];
} {
  const filteredEntities = entities.filter(entity => {
    const matchesName = !filter.entityName || entity.name.toLowerCase().includes(filter.entityName.toLowerCase());
    const matchesUser = !filter.userId || entity.createdBy === filter.userId;
    return matchesName && matchesUser;
  });
  
  const filteredRelations = relations.filter(relation => {
    const matchesType = !filter.relationType || relation.relationType.toLowerCase().includes(filter.relationType.toLowerCase());
    const matchesUser = !filter.userId || relation.createdBy === filter.userId;
    return matchesType && matchesUser;
  });
  
  return {
    entities: filteredEntities,
    relations: filteredRelations
  };
}

/**
 * Analyze graph connectivity and find isolated entities
 */
export function analyzeGraphConnectivity(
  graph: KnowledgeGraph
): {
  connectedEntities: string[];
  isolatedEntities: string[];
  averageConnections: number;
  mostConnectedEntities: { entity: string; connections: number }[];
} {
  const entityConnections = new Map<string, number>();
  
  // Initialize all entities with 0 connections
  graph.entities.forEach(entity => {
    entityConnections.set(entity.name, 0);
  });
  
  // Count connections for each entity
  graph.relations.forEach(relation => {
    entityConnections.set(relation.from, (entityConnections.get(relation.from) || 0) + 1);
    entityConnections.set(relation.to, (entityConnections.get(relation.to) || 0) + 1);
  });
  
  const connectedEntities: string[] = [];
  const isolatedEntities: string[] = [];
  let totalConnections = 0;
  
  entityConnections.forEach((connections, entity) => {
    if (connections > 0) {
      connectedEntities.push(entity);
    } else {
      isolatedEntities.push(entity);
    }
    totalConnections += connections;
  });
  
  const averageConnections = graph.entities.length > 0 ? totalConnections / graph.entities.length : 0;
  
  // Find most connected entities
  const mostConnectedEntities = Array.from(entityConnections.entries())
    .map(([entity, connections]) => ({ entity, connections }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 10);
  
  return {
    connectedEntities,
    isolatedEntities,
    averageConnections,
    mostConnectedEntities
  };
}

// =============================================================================
// STATS HANDLER FUNCTIONS
// =============================================================================

/**
 * Helper function to get MCP arguments with error handling
 */
function getMcpArgs<T>(context: InvocationContext): T {
  const args = context.triggerMetadata?.mcptoolargs;
  if (!args || typeof args !== 'object') {
    throw new Error('Invalid MCP arguments');
  }
  return args as T;
}

/**
 * Helper function to parse JSON arguments
 */
function parseJsonArg(arg: any, argName: string): any {
  if (!arg) {
    throw new Error(`${argName} is required`);
  }
  
  if (typeof arg === 'string') {
    try {
      return JSON.parse(arg);
    } catch (error) {
      throw new Error(`Invalid JSON in ${argName}: ${error}`);
    }
  }
  
  return arg;
}

/**
 * Helper function to validate array arguments
 */
function validateArrayArg(arg: any, argName: string): void {
  if (!Array.isArray(arg)) {
    throw new Error(`${argName} must be an array`);
  }
}

// =============================================================================
// EXPORTED HANDLER FUNCTIONS
// =============================================================================

/**
 * Read the entire centralized knowledge graph
 */
export async function readGraph(_toolArguments: unknown, context: InvocationContext): Promise<KnowledgeGraph> {
  return executeWithErrorHandling(async () => {
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const graph = await executeReadOnlyGraphOperation(
      storageService,
      (graph) => graph
    );
    
    return graph;
  }, 'Failed to read graph');
}

/**
 * Get statistics about the centralized knowledge graph
 */
export async function getStats(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<ReturnType<typeof generateGraphStats>> {
  return executeWithErrorHandling(async () => {
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const stats = await executeReadOnlyGraphOperation(
      storageService,
      (graph) => generateGraphStats(graph, workspaceId)
    );
    
    return stats;
  }, 'Failed to get stats');
}

/**
 * Clear all memory data for a workspace
 */
export async function clearMemory(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<{ success: boolean; message: string }> {
  return executeWithErrorHandling(async () => {
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    await storageService.clearMemory();
    
    return { success: true, message: "Memory cleared successfully" };
  }, 'Failed to clear memory');
}

/**
 * Get temporal events - find what happened when in the memory system
 */
export async function getTemporalEvents(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<{
  entities: (Entity & { actionType: 'created' | 'updated' })[];
  relations: (Relation & { actionType: 'created' | 'updated' })[];
  timeRange: { start: string; end: string };
}> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ 
      startTime?: string; 
      endTime?: string; 
      entityName?: string; 
      relationType?: string; 
      workspaceId?: string; 
    }>(context);
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const start = args.startTime || '1970-01-01T00:00:00.000Z';
    const end = args.endTime || new Date().toISOString();
    
    const { entities, relations } = await storageService.getTemporalEvents(start, end);
    const filtered = filterTemporalEvents(entities, relations, { 
      entityName: args.entityName, 
      relationType: args.relationType, 
      userId: userId 
    });

    return { entities: filtered.entities, relations: filtered.relations, timeRange: { start, end } };
  }, 'Failed to get temporal events');
}

/**
 * Detect and identify potential duplicate entities in the knowledge graph
 */
export async function detectDuplicateEntities(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<ReturnType<typeof detectDuplicateEntitiesInGraph>> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ threshold?: string; workspaceId?: string }>(context);
    const threshold = args.threshold ? parseFloat(args.threshold) : 0.8;
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeReadOnlyGraphOperation(
      storageService,
      (graph) => detectDuplicateEntitiesInGraph(graph, threshold)
    );
    
    return result;
  }, 'Failed to detect duplicate entities');
}

/**
 * Merge duplicate entities into a single target entity
 */
export async function mergeEntities(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<Entity> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ 
      targetEntityName?: string; 
      sourceEntityNames?: any; 
      mergeStrategy?: string; 
      workspaceId?: string; 
    }>(context);

    // DEBUG LOGGING
    context.log('DEBUG - mergeEntities raw args:', JSON.stringify(args, null, 2));
    context.log('DEBUG - mergeEntities sourceEntityNames param:', args.sourceEntityNames);
    context.log('DEBUG - mergeEntities sourceEntityNames type:', typeof args.sourceEntityNames);

    if (!args.targetEntityName) {
      throw new Error('targetEntityName is required');
    }

    // Handle both string (JSON) and object inputs
    let sourceEntityNames: string[] = [];
    if (args.sourceEntityNames) {
      if (typeof args.sourceEntityNames === 'string') {
        const parsed = JSON.parse(args.sourceEntityNames);
        // Handle the case where it's an object with a sourceEntityNames array property
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sourceEntityNames)) {
          sourceEntityNames = parsed.sourceEntityNames;
        } else {
          sourceEntityNames = Array.isArray(parsed) ? parsed : [parsed];
        }
      } else if (typeof args.sourceEntityNames === 'object') {
        // Handle the case where it's an object with a sourceEntityNames array property
        if (Array.isArray(args.sourceEntityNames.sourceEntityNames)) {
          sourceEntityNames = args.sourceEntityNames.sourceEntityNames;
        } else {
          sourceEntityNames = Array.isArray(args.sourceEntityNames) ? args.sourceEntityNames : [args.sourceEntityNames];
        }
      }
    }
    validateArrayArg(sourceEntityNames, 'sourceEntityNames');

    const mergeStrategy = (args.mergeStrategy as 'combine' | 'replace') || 'combine';
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeGraphOperation(
      storageService,
      (graph) => mergeEntitiesInGraph(graph, args.targetEntityName!, sourceEntityNames, mergeStrategy),
      () => true
    );
    
    return result.mergedEntity;
  }, 'Failed to merge entities');
}

/**
 * Execute multiple operations in a single batch for performance
 */
export async function executeBatchOperations(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<{ successful: number; failed: number; errors: string[]; results: any[] }> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ operations?: any; workspaceId?: string }>(context);
    
    // Handle both string (JSON) and object inputs
    let operations: any[] = [];
    if (args.operations) {
      if (typeof args.operations === 'string') {
        const parsed = JSON.parse(args.operations);
        // Handle the case where it's an object with an operations array property
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.operations)) {
          operations = parsed.operations;
        } else {
          operations = Array.isArray(parsed) ? parsed : [parsed];
        }
      } else if (typeof args.operations === 'object') {
        // Handle the case where it's an object with an operations array property
        if (Array.isArray(args.operations.operations)) {
          operations = args.operations.operations;
        } else {
          operations = Array.isArray(args.operations) ? args.operations : [args.operations];
        }
      }
    }
    validateArrayArg(operations, 'operations');
    
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    // Note: BatchUtils.executeBatchOperations is async, so we handle the load/save pattern manually
    const graph = await storageService.loadGraph();
    const result = await BatchUtils.executeBatchOperations(graph, operations);
    
    if (result.updatedGraph) {
      await storageService.saveGraph(result.updatedGraph);
    }
    
    const batchResults = result.results ?? [];
    const successful = batchResults.filter((entry: any) => entry?.success).length;
    const failed = batchResults.length - successful;
    const errors = batchResults
      .filter((entry: any) => !entry?.success && entry?.error)
      .map((entry: any) => entry.error);

    return { successful, failed, errors, results: batchResults };
  }, 'Failed to execute batch operations');
}

/**
 * Get statistics about the memory usage and entity/relationship counts for a specific user
 */
export async function getUserStats(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<ReturnType<typeof generateUserStats>> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ userId?: string; workspaceId?: string }>(context);
    const userId = args.userId || getUserId(context);
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const stats = await executeReadOnlyGraphOperation(
      storageService,
      (graph) => generateUserStats(graph, userId)
    );
    
    return stats;
  }, 'Failed to get user stats');
}
