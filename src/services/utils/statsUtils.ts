import { Entity, Relation, KnowledgeGraph } from '../../types/index.js';

/**
 * Utility functions for statistics and analytics
 */
export class StatsUtils {
  /**
   * Generate comprehensive statistics for a knowledge graph
   */
  static generateStats(graph: KnowledgeGraph, workspaceId: string): {
    entityCount: number;
    relationCount: number;
    entityTypes: { [type: string]: number };
    relationTypes: { [type: string]: number };
    storageType: 'table';
    workspaceId: string;
    lastModified?: string;
  } {
    // Count entity types
    const entityTypes: { [type: string]: number } = {};
    graph.entities.forEach(entity => {
      entityTypes[entity.entityType] = (entityTypes[entity.entityType] || 0) + 1;
    });

    // Count relation types
    const relationTypes: { [type: string]: number } = {};
    graph.relations.forEach(relation => {
      relationTypes[relation.relationType] = (relationTypes[relation.relationType] || 0) + 1;
    });

    // Find last modified date
    const lastModified = graph.entities.length > 0 
      ? Math.max(...graph.entities
          .filter(e => e.updatedAt)
          .map(e => new Date(e.updatedAt!).getTime()))
      : undefined;

    return {
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
      entityTypes,
      relationTypes,
      storageType: 'table' as const,
      workspaceId,
      lastModified: lastModified ? new Date(lastModified).toISOString() : undefined
    };
  }

  /**
   * Generate user-specific statistics
   */
  static generateUserStats(graph: KnowledgeGraph, userId?: string): {
    entities: Entity[];
    relations: Relation[];
    entityCount: number;
    relationCount: number;
    topEntityTypes: { [type: string]: number };
    topRelationTypes: { [type: string]: number };
    userId: string;
  } {
    // Filter by user if specified
    const userEntities = userId 
      ? graph.entities.filter(e => e.createdBy === userId)
      : graph.entities;
      
    const userRelations = userId
      ? graph.relations.filter(r => r.createdBy === userId)
      : graph.relations;

    // Count entity types
    const entityTypes: { [type: string]: number } = {};
    userEntities.forEach(entity => {
      entityTypes[entity.entityType] = (entityTypes[entity.entityType] || 0) + 1;
    });

    // Count relation types
    const relationTypes: { [type: string]: number } = {};
    userRelations.forEach(relation => {
      relationTypes[relation.relationType] = (relationTypes[relation.relationType] || 0) + 1;
    });

    return {
      entities: userEntities,
      relations: userRelations,
      entityCount: userEntities.length,
      relationCount: userRelations.length,
      topEntityTypes: entityTypes,
      topRelationTypes: relationTypes,
      userId: userId || 'all'
    };
  }

  /**
   * Filter entities and relations by time range
   */
  static filterByTimeRange(
    graph: KnowledgeGraph,
    startTime: string,
    endTime: string
  ): {
    entities: (Entity & { actionType: 'created' | 'updated' })[];
    relations: (Relation & { actionType: 'created' | 'updated' })[];
  } {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // Filter entities
    const entities = graph.entities
      .filter(entity => {
        if (!entity.createdAt) return false;
        const createdAt = new Date(entity.createdAt);
        const updatedAt = entity.updatedAt ? new Date(entity.updatedAt) : null;
        return (createdAt >= start && createdAt <= end) || 
               (updatedAt && updatedAt >= start && updatedAt <= end);
      })
      .map(entity => {
        const createdAt = new Date(entity.createdAt!);
        const updatedAt = entity.updatedAt ? new Date(entity.updatedAt) : null;
        
        // Determine action type based on which timestamp falls in range
        let actionType: 'created' | 'updated' = 'created';
        if (updatedAt && updatedAt >= start && updatedAt <= end && 
            (createdAt < start || createdAt > end)) {
          actionType = 'updated';
        }
        
        return { ...entity, actionType };
      });

    // Filter relations
    const relations = graph.relations
      .filter(relation => {
        if (!relation.createdAt) return false;
        const createdAt = new Date(relation.createdAt);
        const updatedAt = relation.updatedAt ? new Date(relation.updatedAt) : null;
        return (createdAt >= start && createdAt <= end) || 
               (updatedAt && updatedAt >= start && updatedAt <= end);
      })
      .map(relation => {
        const createdAt = new Date(relation.createdAt!);
        const updatedAt = relation.updatedAt ? new Date(relation.updatedAt) : null;
        
        // Determine action type based on which timestamp falls in range
        let actionType: 'created' | 'updated' = 'created';
        if (updatedAt && updatedAt >= start && updatedAt <= end && 
            (createdAt < start || createdAt > end)) {
          actionType = 'updated';
        }
        
        return { ...relation, actionType };
      });

    return { entities, relations };
  }

  /**
   * Apply additional filters to temporal events
   */
  static filterTemporalEvents(
    entities: (Entity & { actionType: 'created' | 'updated' })[],
    relations: (Relation & { actionType: 'created' | 'updated' })[],
    filters: {
      entityName?: string;
      relationType?: string;
      userId?: string;
    }
  ): {
    entities: (Entity & { actionType: 'created' | 'updated' })[];
    relations: (Relation & { actionType: 'created' | 'updated' })[];
  } {
    let filteredEntities = entities;
    let filteredRelations = relations;

    if (filters.entityName) {
      filteredEntities = entities.filter(e => 
        e.name.toLowerCase().includes(filters.entityName!.toLowerCase())
      );
      filteredRelations = relations.filter(r => 
        r.from.toLowerCase().includes(filters.entityName!.toLowerCase()) ||
        r.to.toLowerCase().includes(filters.entityName!.toLowerCase())
      );
    }
    
    if (filters.relationType) {
      filteredRelations = filteredRelations.filter(r => r.relationType === filters.relationType);
    }
    
    if (filters.userId) {
      filteredEntities = filteredEntities.filter(e => e.createdBy === filters.userId);
      filteredRelations = filteredRelations.filter(r => r.createdBy === filters.userId);
    }

    return { entities: filteredEntities, relations: filteredRelations };
  }
}
