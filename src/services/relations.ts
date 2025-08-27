import { InvocationContext } from '@azure/functions';
import { Relation, KnowledgeGraph } from '../types/index.js';
import { StorageService } from './storageService.js';
import { Logger } from './logger.js';
import { getWorkspaceId, getUserId, executeGraphOperation } from './utils.js';

// =============================================================================
// RELATION UTILITIES
// =============================================================================

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
 * Helper function to execute read-only graph operations
 */
async function executeReadOnlyGraphOperation<T>(
  storageService: StorageService,
  operation: (graph: KnowledgeGraph) => T
): Promise<T> {
  const graph = await storageService.loadGraph();
  return operation(graph);
}

// =============================================================================
// EXPORTED HANDLER FUNCTIONS
// =============================================================================

/**
 * Create multiple new relations between entities in the knowledge graph
 * Automatically creates missing entities as "Unknown" type
 */
export async function createRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ relations?: any; workspaceId?: string }>(context);
    
    // DEBUG LOGGING
    context.log('DEBUG - createRelations raw args:', JSON.stringify(args, null, 2));
    context.log('DEBUG - createRelations relations param:', args.relations);
    context.log('DEBUG - createRelations relations type:', typeof args.relations);
    
    if (!args.relations) {
      throw new Error('relations parameter is required. Please provide a relation object with from, to, and relationType fields.');
    }
    
    // Handle both string (JSON) and object inputs
    let relationsData: any;
    if (typeof args.relations === 'string') {
      relationsData = JSON.parse(args.relations);
    } else {
      relationsData = args.relations;
    }
    
    const relations = Array.isArray(relationsData) ? relationsData : [relationsData];
    validateArrayArg(relations, 'relations');
    
    // Validate relation structure
    for (const relation of relations) {
      if (!relation.from || !relation.to || !relation.relationType) {
        throw new Error('Each relation must have from, to, and relationType fields. Example: {"from": "Alice", "to": "Project", "relationType": "worksOn"}');
      }
    }
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    // Enhance relations with user context
    const enhancedRelations = enhanceRelationsWithUser(relations, userId);
    
    // Execute graph operation
    const result = await executeGraphOperation(
      storageService,
      (graph) => {
        const now = new Date().toISOString();
        const entitiesCreated: string[] = [];
        
        // Auto-create missing entities
        for (const relation of enhancedRelations) {
          const fromExists = graph.entities.some(e => e.name === relation.from);
          const toExists = graph.entities.some(e => e.name === relation.to);
          
          if (!fromExists) {
            const newEntity = {
              name: relation.from,
              entityType: 'Unknown',
              observations: [`Auto-created as part of relation to ${relation.to}`],
              createdBy: userId,
              createdAt: now,
              updatedAt: now
            };
            graph.entities.push(newEntity);
            entitiesCreated.push(relation.from);
            context.log(`Auto-created entity '${relation.from}' as Unknown type`);
          }
          
          if (!toExists) {
            const newEntity = {
              name: relation.to,
              entityType: 'Unknown',
              observations: [`Auto-created as part of relation from ${relation.from}`],
              createdBy: userId,
              createdAt: now,
              updatedAt: now
            };
            graph.entities.push(newEntity);
            entitiesCreated.push(relation.to);
            context.log(`Auto-created entity '${relation.to}' as Unknown type`);
          }
        }
        
        const newRelations = enhancedRelations
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

        return { 
          newRelations, 
          entitiesCreated, 
          updatedGraph 
        };
      },
      (result) => result.newRelations.length > 0
    );
    
    const response = {
      relations: result.newRelations,
      entitiesCreated: result.entitiesCreated,
      message: result.entitiesCreated.length > 0 
        ? `Created ${result.newRelations.length} relation(s) and auto-created ${result.entitiesCreated.length} missing entit(ies): ${result.entitiesCreated.join(', ')}`
        : `Created ${result.newRelations.length} relation(s)`
    };
    
    return response;
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
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const results = await executeReadOnlyGraphOperation(
      storageService,
      (graph) => {
        return graph.relations.filter(relation => {
          const matchesFrom = !args.from || relation.from.toLowerCase().includes(args.from.toLowerCase());
          const matchesTo = !args.to || relation.to.toLowerCase().includes(args.to.toLowerCase());
          const matchesType = !args.relationType || relation.relationType.toLowerCase().includes(args.relationType.toLowerCase());
          return matchesFrom && matchesTo && matchesType;
        });
      }
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
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const results = await executeReadOnlyGraphOperation(
      storageService,
      (graph) => {
        return graph.relations.filter(relation => {
          const matchesUser = relation.createdBy === userId;
          const matchesType = !args.relationType || relation.relationType.toLowerCase().includes(args.relationType.toLowerCase());
          return matchesUser && matchesType;
        });
      }
    );
    
    return results;
  }, 'Failed to search relations by user');
}
