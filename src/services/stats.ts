import { InvocationContext } from '@azure/functions';
import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { StorageService } from './storageService.js';
import { Logger } from './logger.js';
import { 
  getWorkspaceId,
  executeReadOnlyGraphOperation,
  executeWithErrorHandling
} from './utils.js';

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

// =============================================================================
// STATS HANDLER FUNCTIONS
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

