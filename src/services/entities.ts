import { InvocationContext } from '@azure/functions';
import { Entity, KnowledgeGraph } from '../types/index.js';
import { StorageService } from './storageService.js';
import { Logger } from './logger.js';
import { 
  getMcpArgs, 
  parseJsonArg, 
  validateArrayArg, 
  executeGraphOperation,
  getUserContext,
  enrichEntityWithUserContext,
  getWorkspaceId,
  getUserId,
  enhanceEntitiesWithUser 
} from './utils.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Execute operation with standardized error handling
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

// =============================================================================
// ENTITY UTILITIES
// =============================================================================

/**
 * Calculate similarity between two entities
 */
export function calculateEntitySimilarity(entity1: Entity, entity2: Entity): number {
  // Simple similarity calculation based on name and observations
  let score = 0;
  
  // Name similarity (Levenshtein distance normalized)
  const nameScore = 1 - (levenshteinDistance(
    entity1.name.toLowerCase(), 
    entity2.name.toLowerCase()
  ) / Math.max(entity1.name.length, entity2.name.length));
  score += nameScore * 0.4;
  
  // Type match
  if (entity1.entityType === entity2.entityType) {
    score += 0.3;
  }
  
  // Observation overlap
  const obs1Set = new Set(entity1.observations.map(o => o.toLowerCase()));
  const obs2Set = new Set(entity2.observations.map(o => o.toLowerCase()));
  const intersection = new Set([...obs1Set].filter(x => obs2Set.has(x)));
  const union = new Set([...obs1Set, ...obs2Set]);
  const observationScore = intersection.size / union.size;
  score += observationScore * 0.3;
  
  return score;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Create new entities in the knowledge graph
 */
export function createEntitiesInGraph(
  graph: KnowledgeGraph,
  entities: { name: string; entityType: string; observations: string[] }[],
  userId: string
): { newEntities: Entity[]; updatedGraph: KnowledgeGraph } {
  const newEntities: Entity[] = [];
  const updatedEntities = [...graph.entities];

  for (const entityData of entities) {
    // Check if entity already exists
    const existingEntity = updatedEntities.find(e => e.name === entityData.name);
    
    if (existingEntity) {
      // Update existing entity with new observations
      existingEntity.observations = [...new Set([...existingEntity.observations, ...entityData.observations])];
      existingEntity.updatedAt = new Date().toISOString();
      newEntities.push(existingEntity);
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
    }
  }

  return {
    newEntities,
    updatedGraph: { entities: updatedEntities, relations: graph.relations }
  };
}

/**
 * Search entities by name or type
 */
export function searchEntitiesInGraph(
  entities: Entity[],
  query: { name?: string; entityType?: string }
): Entity[];
export function searchEntitiesInGraph(entities: Entity[], query: string): Entity[];
export function searchEntitiesInGraph(
  entities: Entity[],
  query: { name?: string; entityType?: string } | string
): Entity[] {
  if (typeof query === 'string') {
    const searchTerm = query.toLowerCase();
    return entities.filter(entity => {
      return entity.name.toLowerCase().includes(searchTerm) ||
             entity.entityType.toLowerCase().includes(searchTerm) ||
             entity.observations.some(obs => obs.toLowerCase().includes(searchTerm));
    });
  }

  return entities.filter(entity => {
    const nameMatch = !query.name || entity.name.toLowerCase().includes(query.name.toLowerCase());
    const typeMatch = !query.entityType || entity.entityType.toLowerCase().includes(query.entityType.toLowerCase());
    return nameMatch && typeMatch;
  });
}

/**
 * Add observation to an entity
 */
export function addObservationToEntity(
  graph: KnowledgeGraph,
  entityName: string,
  observation: string,
  userId: string
): { updatedEntity: Entity; updatedGraph: KnowledgeGraph } {
  const entity = graph.entities.find(e => e.name === entityName);
  if (!entity) {
    throw new Error(`Entity '${entityName}' not found`);
  }

  // Add observation if not already present
  if (!entity.observations.includes(observation)) {
    entity.observations.push(observation);
    entity.updatedAt = new Date().toISOString();
  }

  return {
    updatedEntity: entity,
    updatedGraph: { entities: graph.entities, relations: graph.relations }
  };
}

/**
 * Delete an entity and all its relations
 */
export function deleteEntityFromGraph(
  graph: KnowledgeGraph,
  entityName: string
): { deleted: boolean; updatedGraph: KnowledgeGraph } {
  const entityExists = graph.entities.some(e => e.name === entityName);
  
  if (!entityExists) {
    throw new Error(`Entity '${entityName}' not found`);
  }

  const updatedEntities = graph.entities.filter(e => e.name !== entityName);
  const updatedRelations = graph.relations.filter(r => 
    r.from !== entityName && r.to !== entityName
  );

  return {
    deleted: true,
    updatedGraph: { entities: updatedEntities, relations: updatedRelations }
  };
}

/**
 * Update an entity with new observations or metadata
 */
export function updateEntityInGraph(
  graph: KnowledgeGraph,
  entityName: string,
  newObservations: string[],
  metadata?: Record<string, any>
): { updatedEntity: Entity; updatedGraph: KnowledgeGraph } {
  const entity = graph.entities.find(e => e.name === entityName);
  if (!entity) {
    throw new Error(`Entity '${entityName}' not found`);
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
}

/**
 * Detect duplicate entities in the knowledge graph
 */
export function detectDuplicateEntities(
  graph: KnowledgeGraph,
  threshold: number = 0.8
): { duplicates: { entity: Entity; similars: Entity[] }[]; duplicateCount: number } {
  const duplicates: { entity: Entity; similars: Entity[] }[] = [];
  const processed = new Set<string>();

  for (const entity of graph.entities) {
    if (processed.has(entity.name)) continue;

    const similars = graph.entities.filter(other => {
      if (other.name === entity.name || processed.has(other.name)) return false;
      return calculateEntitySimilarity(entity, other) >= threshold;
    });

    if (similars.length > 0) {
      duplicates.push({ entity, similars });
      processed.add(entity.name);
      similars.forEach(similar => processed.add(similar.name));
    }
  }

  return { duplicates, duplicateCount: duplicates.length };
}

/**
 * Merge entities into a single target entity
 */
export function mergeEntitiesInGraph(
  graph: KnowledgeGraph,
  targetEntityName: string,
  sourceEntityNames: string[],
  mergeStrategy: 'combine' | 'replace' = 'combine'
): { mergedEntity: Entity; updatedGraph: KnowledgeGraph } {
  const targetEntity = graph.entities.find(e => e.name === targetEntityName);
  if (!targetEntity) {
    throw new Error(`Target entity '${targetEntityName}' not found`);
  }

  const sourceEntities = sourceEntityNames.map(name => {
    const entity = graph.entities.find(e => e.name === name);
    if (!entity) {
      throw new Error(`Source entity '${name}' not found`);
    }
    return entity;
  });

  // Merge observations
  if (mergeStrategy === 'combine') {
    const allObservations = [
      ...targetEntity.observations,
      ...sourceEntities.flatMap(e => e.observations)
    ];
    targetEntity.observations = [...new Set(allObservations)];
  }

  // Update relations - replace source entity names with target entity name
  const updatedRelations = graph.relations.map(relation => {
    const newRelation = { ...relation };
    if (sourceEntityNames.includes(relation.from)) {
      newRelation.from = targetEntityName;
    }
    if (sourceEntityNames.includes(relation.to)) {
      newRelation.to = targetEntityName;
    }
    return newRelation;
  }).filter(relation => relation.from !== relation.to); // Remove self-relations

  // Remove source entities
  const updatedEntities = graph.entities.filter(e => !sourceEntityNames.includes(e.name));

  targetEntity.updatedAt = new Date().toISOString();

  return {
    mergedEntity: targetEntity,
    updatedGraph: { entities: updatedEntities, relations: updatedRelations }
  };
}

// =============================================================================
// ENTITY HANDLER FUNCTIONS
// =============================================================================
// EXPORTED HANDLER FUNCTIONS
// =============================================================================

/**
 * Create multiple new entities in the centralized knowledge graph
 */
export async function createEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entities?: string; workspaceId?: string }>(context);
    const entities = parseJsonArg(args.entities, 'entities');
    validateArrayArg(entities, 'entities');
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    // Enhance entities with user context
    const enhancedEntities = enhanceEntitiesWithUser(entities, userId);
    
    // Execute graph operation
    const result = await executeGraphOperation(
      storageService,
      (graph) => createEntitiesInGraph(graph, enhancedEntities, userId),
      (result) => result.newEntities.length > 0
    );
    
    return result.newEntities;
  }, 'Failed to create entities');
}

/**
 * Search for entities by name or type
 */
export async function searchEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ name?: string; entityType?: string; workspaceId?: string }>(context);
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const graph = await storageService.loadGraph();
    const results = searchEntitiesInGraph(graph.entities, { name: args.name, entityType: args.entityType });
    
    return results;
  }, 'Failed to search entities');
}

/**
 * Add a new observation to an existing entity
 */
export async function addObservation(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entityName?: string; observation?: string; workspaceId?: string }>(context);
    
    if (!args.entityName || !args.observation) {
      throw new Error('entityName and observation are required');
    }
    
    const workspaceId = getWorkspaceId(context);
    const userId = getUserId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeGraphOperation(
      storageService,
      (graph) => addObservationToEntity(graph, args.entityName!, args.observation!, userId),
      () => true
    );
    
    return result.updatedEntity;
  }, 'Failed to add observation');
}

/**
 * Delete an entity and all its relations
 */
export async function deleteEntity(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entityName?: string; workspaceId?: string }>(context);
    
    if (!args.entityName) {
      throw new Error('entityName is required');
    }
    
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeGraphOperation(
      storageService,
      (graph) => deleteEntityFromGraph(graph, args.entityName!),
      () => true
    );
    
    return { success: result.deleted, message: `Entity '${args.entityName}' deleted successfully` };
  }, 'Failed to delete entity');
}

/**
 * Update an existing entity with new observations or metadata
 */
export async function updateEntity(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  return executeWithErrorHandling(async () => {
    const args = getMcpArgs<{ entityName?: string; newObservations?: string; metadata?: string; workspaceId?: string }>(context);
    
    if (!args.entityName) {
      throw new Error('entityName is required');
    }
    
    const newObservations = args.newObservations ? parseJsonArg(args.newObservations, 'newObservations') : [];
    const metadata = args.metadata ? parseJsonArg(args.metadata, 'metadata') : undefined;
    
    const workspaceId = getWorkspaceId(context);
    
    const logger = new Logger(context);
    const storageService = await StorageService.createForWorkspace(workspaceId, logger);
    
    const result = await executeGraphOperation(
      storageService,
      (graph) => updateEntityInGraph(graph, args.entityName!, newObservations, metadata),
      () => true
    );
    
    return result.updatedEntity;
  }, 'Failed to update entity');
}
