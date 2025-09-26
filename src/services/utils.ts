import { InvocationContext } from '@azure/functions';
import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { StorageService } from './storageService.js';

// =============================================================================
// CORE ARGUMENT HELPERS
// =============================================================================

export function getMcpArgs<T>(context: InvocationContext): T {
  const args = context.triggerMetadata?.mcptoolargs;
  if (!args || typeof args !== 'object') {
    throw new Error('No MCP tool arguments found in context');
  }
  return args as T;
}

export function validateArrayArg(arg: unknown, argName: string): void {
  if (!Array.isArray(arg)) {
    throw new Error(`Parameter '${argName}' must be an array`);
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(errorContext ? `${errorContext}: ${errorMessage}` : errorMessage);
  }
}

// =============================================================================
// GRAPH OPERATIONS
// =============================================================================

export async function executeGraphOperation<T>(
  persistenceService: StorageService,
  operation: (graph: KnowledgeGraph) => T,
  shouldSave?: (result: T) => boolean
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  const result = operation(graph);

  if (result && typeof result === 'object' && 'updatedGraph' in result) {
    const needsSave = shouldSave ? shouldSave(result) : true;
    if (needsSave) {
      await persistenceService.saveGraph((result as any).updatedGraph);
    }
  }

  return result;
}

export async function executeGraphOperationWithReplacement<T>(
  persistenceService: StorageService,
  operation: (graph: KnowledgeGraph) => T,
  shouldSave?: (result: T) => boolean
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  const result = operation(graph);

  if (result && typeof result === 'object' && 'updatedGraph' in result) {
    const needsSave = shouldSave ? shouldSave(result) : true;
    if (needsSave) {
      const updatedGraph = (result as any).updatedGraph as KnowledgeGraph;

      const entitiesToDelete = graph.entities.filter(
        current => !updatedGraph.entities.some(updated => updated.name === current.name)
      );

      const relationsToDelete = graph.relations.filter(current =>
        !updatedGraph.relations.some(
          updated =>
            updated.from === current.from &&
            updated.to === current.to &&
            updated.relationType === current.relationType
        )
      );

      await Promise.all([
        ...entitiesToDelete.map(entity => persistenceService.deleteEntity(entity.name)),
        ...relationsToDelete.map(relation =>
          persistenceService.deleteRelation(relation.from, relation.to, relation.relationType)
        )
      ]);

      await persistenceService.saveGraph(updatedGraph);
    }
  }

  return result;
}

export async function executeReadOnlyGraphOperation<T>(
  persistenceService: StorageService,
  operation: (graph: KnowledgeGraph) => T
): Promise<T> {
  const graph = await persistenceService.loadGraph();
  return operation(graph);
}

// =============================================================================
// WORKSPACE & USER CONTEXT
// =============================================================================

export function getWorkspaceId(context: InvocationContext): string {
  const args = getMcpArgs<{ workspaceId?: string }>(context);
  return args.workspaceId && args.workspaceId.trim() ? args.workspaceId : 'default';
}

export function getUserId(_context: InvocationContext): string {
  // Placeholder until authenticated user context is available
  return 'default-user';
}

// =============================================================================
// ENTITY HELPERS
// =============================================================================

export function enhanceEntitiesWithUser(entities: Entity[], userId: string): Entity[] {
  return entities.map(entity => {
    validateEntity(entity);
    const timestamp = new Date().toISOString();

    return {
      ...entity,
      createdBy: entity.createdBy ?? userId,
      createdAt: entity.createdAt ?? timestamp,
      updatedAt: timestamp
    };
  });
}

export function validateEntity(entity: unknown): asserts entity is Entity {
  if (!entity || typeof entity !== 'object') {
    throw new Error('Entity must be an object');
  }

  const typed = entity as Partial<Entity>;

  if (!typed.name || typeof typed.name !== 'string') {
    throw new Error('Entity must include a name (string)');
  }

  if (!typed.entityType || typeof typed.entityType !== 'string') {
    throw new Error('Entity must include an entityType (string)');
  }

  if (!Array.isArray(typed.observations)) {
    throw new Error('Entity must include observations (array of strings)');
  }
}
