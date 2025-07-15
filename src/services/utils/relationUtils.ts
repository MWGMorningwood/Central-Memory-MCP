import { Relation, KnowledgeGraph } from '../../types/index.js';

/**
 * Utility functions for relation operations
 */
export class RelationUtils {
  /**
   * Creates new relations with validation and deduplication
   */
  static createRelations(
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
        strength: r.strength || 0.8
      }));

    const updatedGraph = {
      ...graph,
      relations: [...graph.relations, ...newRelations]
    };

    return { newRelations, updatedGraph };
  }

  /**
   * Searches relations by criteria
   */
  static searchRelations(
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
   * Search relations by user
   */
  static searchRelationsByUser(
    relations: Relation[],
    query: { userId?: string; relationType?: string }
  ): Relation[] {
    let results = relations;

    if (query.userId) {
      results = results.filter(relation => 
        relation.createdBy?.toLowerCase().includes(query.userId!.toLowerCase())
      );
    }

    if (query.relationType) {
      results = results.filter(relation =>
        relation.relationType.toLowerCase().includes(query.relationType!.toLowerCase())
      );
    }

    return results;
  }

  /**
   * Filter relations by entity names or type
   */
  static filterRelations(
    relations: Relation[],
    query: { from?: string; to?: string; relationType?: string }
  ): Relation[] {
    let results = relations;

    if (query.from) {
      results = results.filter(relation => 
        relation.from.toLowerCase().includes(query.from!.toLowerCase())
      );
    }

    if (query.to) {
      results = results.filter(relation => 
        relation.to.toLowerCase().includes(query.to!.toLowerCase())
      );
    }

    if (query.relationType) {
      results = results.filter(relation => 
        relation.relationType.toLowerCase().includes(query.relationType!.toLowerCase())
      );
    }

    return results;
  }

  /**
   * Get all relations involving specific entities
   */
  static getRelationsForEntities(
    relations: Relation[],
    entityNames: string[]
  ): { fromRelations: Relation[]; toRelations: Relation[] } {
    const fromRelations = relations.filter(relation => 
      entityNames.includes(relation.from)
    );
    
    const toRelations = relations.filter(relation => 
      entityNames.includes(relation.to)
    );

    return { fromRelations, toRelations };
  }

  /**
   * Update relations to point to a new entity (used in merging)
   */
  static updateRelationsForMerge(
    relations: Relation[],
    sourceEntityNames: string[],
    targetEntityName: string
  ): Relation[] {
    return relations.map(relation => {
      const updatedRelation = { ...relation };
      if (sourceEntityNames.includes(relation.from)) {
        updatedRelation.from = targetEntityName;
      }
      if (sourceEntityNames.includes(relation.to)) {
        updatedRelation.to = targetEntityName;
      }
      return updatedRelation;
    });
  }

  /**
   * Remove duplicate relations that might be created during merging
   */
  static removeDuplicateRelations(relations: Relation[]): Relation[] {
    const seen = new Set<string>();
    return relations.filter(relation => {
      const key = `${relation.from}-${relation.to}-${relation.relationType}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
