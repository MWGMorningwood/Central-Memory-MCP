import { Entity, KnowledgeGraph } from '../../types/index.js';

/**
 * Utility functions for entity operations
 */
export class EntityUtils {
  /**
   * Calculate similarity between two entities
   */
  static calculateEntitySimilarity(entity1: Entity, entity2: Entity): number {
    // Simple similarity calculation based on name and observations
    let score = 0;
    
    // Name similarity (Levenshtein distance normalized)
    const nameScore = 1 - (this.levenshteinDistance(
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
  static levenshteinDistance(str1: string, str2: string): number {
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
   * Detect duplicate entities in a knowledge graph
   */
  static detectDuplicates(graph: KnowledgeGraph, threshold: number = 0.8): {
    duplicateGroups: {
      entities: Entity[];
      similarityScore: number;
      suggestedMergeTarget: string;
    }[];
  } {
    const duplicateGroups: {
      entities: Entity[];
      similarityScore: number;
      suggestedMergeTarget: string;
    }[] = [];

    // Group entities by type first for more efficient comparison
    const entitiesByType = graph.entities.reduce((acc, entity) => {
      if (!acc[entity.entityType]) acc[entity.entityType] = [];
      acc[entity.entityType].push(entity);
      return acc;
    }, {} as Record<string, Entity[]>);

    // Check for duplicates within each type
    for (const [entityType, entities] of Object.entries(entitiesByType)) {
      for (let i = 0; i < entities.length - 1; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const similarity = this.calculateEntitySimilarity(entities[i], entities[j]);
          if (similarity >= threshold) {
            duplicateGroups.push({
              entities: [entities[i], entities[j]],
              similarityScore: similarity,
              suggestedMergeTarget: entities[i].name // Use first entity as merge target
            });
          }
        }
      }
    }

    return { duplicateGroups };
  }

  /**
   * Merge entities in a knowledge graph
   */
  static mergeEntities(
    graph: KnowledgeGraph,
    targetEntityName: string,
    sourceEntityNames: string[],
    mergeStrategy: 'combine' | 'replace' = 'combine'
  ): { updatedGraph: KnowledgeGraph; mergedEntity: Entity } {
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
    const mergedObservations = [...targetEntity.observations];
    if (mergeStrategy === 'combine') {
      sourceEntities.forEach(entity => {
        entity.observations.forEach(obs => {
          if (!mergedObservations.includes(obs)) {
            mergedObservations.push(obs);
          }
        });
      });
    }

    // Merge metadata
    const mergedMetadata = { ...targetEntity.metadata };
    if (mergeStrategy === 'combine') {
      sourceEntities.forEach(entity => {
        if (entity.metadata) {
          Object.assign(mergedMetadata, entity.metadata);
        }
      });
    }

    // Update target entity
    const mergedEntity: Entity = {
      ...targetEntity,
      observations: mergedObservations,
      metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
      updatedAt: new Date().toISOString()
    };

    // Update relations to point to target entity
    const updatedRelations = graph.relations.map(relation => {
      const updatedRelation = { ...relation };
      if (sourceEntityNames.includes(relation.from)) {
        updatedRelation.from = targetEntityName;
      }
      if (sourceEntityNames.includes(relation.to)) {
        updatedRelation.to = targetEntityName;
      }
      return updatedRelation;
    });

    // Remove source entities and update target entity
    const updatedEntities = graph.entities.filter(e => !sourceEntityNames.includes(e.name));
    const targetIndex = updatedEntities.findIndex(e => e.name === targetEntityName);
    updatedEntities[targetIndex] = mergedEntity;

    return {
      updatedGraph: { entities: updatedEntities, relations: updatedRelations },
      mergedEntity
    };
  }

  /**
   * Creates new entities with validation and deduplication
   */
  static createEntities(
    graph: KnowledgeGraph,
    entities: Omit<Entity, 'createdAt' | 'updatedAt'>[],
    userId?: string
  ): {
    newEntities: Entity[];
    updatedGraph: KnowledgeGraph;
  } {
    const now = new Date().toISOString();
    
    const newEntities = entities
      .filter(e => !graph.entities.some(existing => existing.name === e.name))
      .map(e => ({
        ...e,
        createdAt: now,
        updatedAt: now,
        createdBy: userId
      }));

    const updatedGraph = {
      ...graph,
      entities: [...graph.entities, ...newEntities]
    };

    return { newEntities, updatedGraph };
  }

  /**
   * Updates an entity with new observations and metadata
   */
  static updateEntity(
    graph: KnowledgeGraph,
    entityName: string,
    newObservations: string[],
    userId?: string,
    metadata?: Record<string, any>
  ): {
    updatedEntity: Entity | null;
    updatedGraph: KnowledgeGraph;
  } {
    const entityIndex = graph.entities.findIndex(e => e.name === entityName);
    
    if (entityIndex === -1) {
      return { updatedEntity: null, updatedGraph: graph };
    }

    const entity = { ...graph.entities[entityIndex] };
    
    if (newObservations?.length > 0) {
      entity.observations = [...entity.observations, ...newObservations];
    }

    if (metadata) {
      entity.metadata = { ...entity.metadata, ...metadata };
    }

    entity.updatedAt = new Date().toISOString();
    if (userId && !entity.createdBy) {
      entity.createdBy = userId;
    }

    const updatedEntities = [...graph.entities];
    updatedEntities[entityIndex] = entity;

    const updatedGraph = {
      ...graph,
      entities: updatedEntities
    };

    return { updatedEntity: entity, updatedGraph };
  }

  /**
   * Deletes an entity from the graph
   */
  static deleteEntity(
    graph: KnowledgeGraph,
    entityName: string
  ): {
    deleted: boolean;
    updatedGraph: KnowledgeGraph;
  } {
    const entityExists = graph.entities.some(e => e.name === entityName);
    
    if (!entityExists) {
      return { deleted: false, updatedGraph: graph };
    }

    const updatedEntities = graph.entities.filter(e => e.name !== entityName);
    const updatedRelations = graph.relations.filter(r => 
      r.from !== entityName && r.to !== entityName
    );

    const updatedGraph = {
      entities: updatedEntities,
      relations: updatedRelations
    };

    return { deleted: true, updatedGraph };
  }

  /**
   * Searches entities by name or type
   */
  static searchEntities(
    entities: Entity[],
    query: { name?: string; entityType?: string }
  ): Entity[];
  /**
   * Fuzzy search entities by query string
   */
  static searchEntities(entities: Entity[], query: string): Entity[];
  static searchEntities(
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
      const matchesName = !query.name || entity.name.toLowerCase().includes(query.name.toLowerCase());
      const matchesType = !query.entityType || entity.entityType.toLowerCase().includes(query.entityType.toLowerCase());
      return matchesName && matchesType;
    });
  }

  /**
   * Get entities by names
   */
  static getEntitiesByNames(entities: Entity[], names: string[]): Entity[] {
    return entities.filter(entity => names.includes(entity.name));
  }
}