import { InvocationContext } from '@azure/functions';
import { Relation, KnowledgeGraph, Entity } from '../types/index.js';
import { StorageService } from './storageService.js';
import { Logger } from './logger.js';
import { getWorkspaceId, getUserId, executeGraphOperation, executeWithErrorHandling } from './utils.js';

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
export async function createRelations(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<{ relations: Relation[]; entitiesCreated: string[]; message: string }> {
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
        const existingEntityNames = new Set(graph.entities.map(entity => entity.name));
        const uniqueCreated = new Set<string>();
        const autoCreatedEntities: Entity[] = [];

        for (const relation of enhancedRelations) {
          if (!existingEntityNames.has(relation.from)) {
            const newEntity: Entity = {
              name: relation.from,
              entityType: 'Unknown',
              observations: [`Auto-created as part of relation to ${relation.to}`],
              createdBy: userId,
              createdAt: now,
              updatedAt: now
            };
            autoCreatedEntities.push(newEntity);
            existingEntityNames.add(relation.from);
            uniqueCreated.add(relation.from);
            context.log(`Auto-created entity '${relation.from}' as Unknown type`);
          }

          if (!existingEntityNames.has(relation.to)) {
            const newEntity: Entity = {
              name: relation.to,
              entityType: 'Unknown',
              observations: [`Auto-created as part of relation from ${relation.from}`],
              createdBy: userId,
              createdAt: now,
              updatedAt: now
            };
            autoCreatedEntities.push(newEntity);
            existingEntityNames.add(relation.to);
            uniqueCreated.add(relation.to);
            context.log(`Auto-created entity '${relation.to}' as Unknown type`);
          }
        }

        const existingRelations = new Set(
          graph.relations.map(rel => `${rel.from}::${rel.to}::${rel.relationType}`)
        );
        const newRelations = enhancedRelations
          .filter(r => {
            const key = `${r.from}::${r.to}::${r.relationType}`;
            if (existingRelations.has(key)) {
              return false;
            }
            existingRelations.add(key);
            return true;
          })
          .map(r => ({
            ...r,
            createdAt: now,
            updatedAt: now,
            strength: r.strength ?? 0.8
          }));

        const updatedGraph = {
          ...graph,
          entities: autoCreatedEntities.length > 0
            ? [...graph.entities, ...autoCreatedEntities]
            : graph.entities,
          relations: [...graph.relations, ...newRelations]
        };

        return {
          newRelations,
          entitiesCreated: Array.from(uniqueCreated),
          updatedGraph
        };
      },
      (result) => result.newRelations.length > 0 || result.entitiesCreated.length > 0
    );
    
    const response = {
      relations: result.newRelations,
      entitiesCreated: result.entitiesCreated,
      message: result.entitiesCreated.length > 0 
        ? `Created ${result.newRelations.length} relation(s) and auto-created ${result.entitiesCreated.length} missing entities: ${result.entitiesCreated.join(', ')}`
        : `Created ${result.newRelations.length} relation(s)`
    };
    
    return response;
  }, 'Failed to create relations');
}

/**
 * Search for relations by entity names or type
 */
export async function searchRelations(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<Relation[]> {
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

