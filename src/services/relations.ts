import { InvocationContext } from '@azure/functions';
import { Relation, KnowledgeGraph } from '../types/index.js';
import { PersistenceService } from './persistenceService.js';
import { Logger } from './logger.js';
import { getWorkspaceId, getUserId } from './utils/mcpUtils.js';

// =============================================================================
// RELATION UTILITIES
// =============================================================================

/**
 * Create new relations with validation and deduplication
 */
export function createRelationsInGraph(
  graph: KnowledgeGraph,
  relations: Omit<Relation, 'createdAt'>[]
): {
  newRelations: Relation[];
  updatedGraph: KnowledgeGraph;
} {
  const now = new Date().toISOString();
  
  const newRelations = relations
    .filter(r => !graph.relations.some(existing => 
      existing.from === r.from && 
      existing.to === r.to && 
      existing.relationType === r.relationType
    ))
    .map(r => ({
      ...r,
      createdAt: now,
      updatedAt: now,
      strength: r.strength || 0.8
    }));

  const updatedGraph = {
    ...graph,
    relations: [...graph.relations, ...newRelations]
  };

  return { newRelations, updatedGraph };
}

/**
 * Search relations by criteria
 */
export function searchRelationsInGraph(
  relations: Relation[],
  query: { from?: string; to?: string; relationType?: string }
): Relation[] {
  return relations.filter(relation => {
    const matchesFrom = !query.from || relation.from.toLowerCase().includes(query.from.toLowerCase());
    const matchesTo = !query.to || relation.to.toLowerCase().includes(query.to.toLowerCase());
    const matchesType = !query.relationType || relation.relationType.toLowerCase().includes(query.relationType.toLowerCase());
    return matchesFrom && matchesTo && matchesType;
  });
}

/**
 * Search relations by user who created them
 */
export function searchRelationsByUserInGraph(
  relations: Relation[],
  userId: string,
  relationType?: string
): Relation[] {
  return relations.filter(relation => {
    const matchesUser = relation.createdBy === userId;
    const matchesType = !relationType || relation.relationType.toLowerCase().includes(relationType.toLowerCase());
    return matchesUser && matchesType;
  });
}

/**
 * Update relation strength
 */
export function updateRelationStrength(
  graph: KnowledgeGraph,
  from: string,
  to: string,
  relationType: string,
  strength: number
): { updatedRelation: Relation; updatedGraph: KnowledgeGraph } {
  const relation = graph.relations.find(r => 
    r.from === from && r.to === to && r.relationType === relationType
  );
  
  if (!relation) {
    throw new Error(`Relation from '${from}' to '${to}' with type '${relationType}' not found`);
  }

  relation.strength = Math.max(0, Math.min(1, strength)); // Clamp between 0 and 1
  relation.updatedAt = new Date().toISOString();

  return {
    updatedRelation: relation,
    updatedGraph: { entities: graph.entities, relations: graph.relations }
  };
}

/**
 * Delete a relation
 */
export function deleteRelationFromGraph(
  graph: KnowledgeGraph,
  from: string,
  to: string,
  relationType: string
): { deleted: boolean; updatedGraph: KnowledgeGraph } {
  const relationIndex = graph.relations.findIndex(r => 
    r.from === from && r.to === to && r.relationType === relationType
  );
  
  if (relationIndex === -1) {
    throw new Error(`Relation from '${from}' to '${to}' with type '${relationType}' not found`);
  }

  const updatedRelations = [...graph.relations];
  updatedRelations.splice(relationIndex, 1);

  return {
    deleted: true,
    updatedGraph: { entities: graph.entities, relations: updatedRelations }
  };
}

/**
 * Get all relations for a specific entity
 */
export function getEntityRelations(
  relations: Relation[],
  entityName: string
): { incoming: Relation[]; outgoing: Relation[] } {
  const incoming = relations.filter(r => r.to === entityName);
  const outgoing = relations.filter(r => r.from === entityName);
  
  return { incoming, outgoing };
}

/**
 * Find strongly connected relations (above a threshold)
 */
export function findStrongRelations(
  relations: Relation[],
  threshold: number = 0.8
): Relation[] {
  return relations.filter(r => (r.strength || 0.8) >= threshold);
}

// =============================================================================
// RELATION HANDLER FUNCTIONS
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

/**
 * Helper function to enhance relations with user context
 */
function enhanceRelationsWithUser(relations: any[], userId: string): any[] {
  return relations.map(relation => ({
    ...relation,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

/**
 * Helper function to execute graph operations with error handling
 */
async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<string> {
  try {
    const result = await operation();
    return JSON.stringify(result);
  } catch (error) {
    const logger = new Logger();
    logger.error(errorMessage, error);
    throw error;
  }
}

/**
 * Helper function to execute graph operations with automatic save
 */
async function executeGraphOperation<T>(
  persistenceService: PersistenceService,
  operation: (graph: KnowledgeGraph) => T,
  saveCondition?: (result: T) => boolean
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  const result = operation(graph);
  
  // Check if result has updatedGraph and should be saved
  if (
    result && 
    typeof result === 'object' && 
    'updatedGraph' in result &&
    (!saveCondition || saveCondition(result))
  ) {
    await persistenceService.saveGraph((result as any).updatedGraph);
  }
  
  return result;
}

/**
 * Helper function to execute read-only graph operations
 */
async function executeReadOnlyGraphOperation<T>(
  persistenceService: PersistenceService,
  operation: (graph: KnowledgeGraph) => T
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  return operation(graph);
}

// =============================================================================
// EXPORTED HANDLER FUNCTIONS
// =============================================================================

/**
 * Create multiple new relations between entities in the knowledge graph
 */
export async function createRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ relations?: string; workspaceId?: string }>(context);
    const relations = parseJsonArg(args.relations, 'relations');
    validateArrayArg(relations, 'relations');
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const persistenceService = await PersistenceService.createForWorkspace(workspaceId, logger);
    
    // Enhance relations with user context
    const enhancedRelations = enhanceRelationsWithUser(relations, userId);
    
    // Execute graph operation
    const result = await executeGraphOperation(
      persistenceService,
      (graph) => createRelationsInGraph(graph, enhancedRelations),
      (result) => result.newRelations.length > 0
    );
    
    return result.newRelations;
  }, 'Failed to create relations');
}

/**
 * Search for relations by entity names or type
 */
export async function searchRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ from?: string; to?: string; relationType?: string; workspaceId?: string }>(context);
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const persistenceService = await PersistenceService.createForWorkspace(workspaceId, logger);
    
    const results = await executeReadOnlyGraphOperation(
      persistenceService,
      (graph) => searchRelationsInGraph(graph.relations, {
        from: args.from,
        to: args.to,
        relationType: args.relationType
      })
    );
    
    return results;
  }, 'Failed to search relations');
}

/**
 * Search for relations created by a specific user
 */
export async function searchRelationsByUser(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ userId?: string; relationType?: string; workspaceId?: string }>(context);
    const workspaceId = getWorkspaceId(context);
    const userId = args.userId || getUserId(context);
    
    const logger = new Logger(context);
    const persistenceService = await PersistenceService.createForWorkspace(workspaceId, logger);
    
    const results = await executeReadOnlyGraphOperation(
      persistenceService,
      (graph) => searchRelationsByUserInGraph(graph.relations, userId, args.relationType)
    );
    
    return results;
  }, 'Failed to search relations by user');
}
