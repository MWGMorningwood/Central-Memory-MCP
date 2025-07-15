import { Entity, Relation, KnowledgeGraph } from '../../types/index.js';

/**
 * Utility functions for batch operations
 */
export class BatchUtils {
  /**
   * Execute batch operations on a knowledge graph
   */
  static async executeBatchOperations(
    graph: KnowledgeGraph,
    operations: {
      type: 'create_entity' | 'create_relation' | 'update_entity' | 'delete_entity';
      data: any;
      userId?: string;
    }[]
  ): Promise<{
    updatedGraph: KnowledgeGraph;
    successful: number;
    failed: number;
    errors: string[];
    results: any[];
  }> {
    const results: any[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;
    let workingGraph = { ...graph, entities: [...graph.entities], relations: [...graph.relations] };

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'create_entity': {
            const entityData = operation.data as Omit<Entity, 'createdAt' | 'updatedAt'>;
            const existingEntity = workingGraph.entities.find(e => e.name === entityData.name);
            
            if (!existingEntity) {
              const newEntity: Entity = {
                ...entityData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: operation.userId
              };
              workingGraph.entities.push(newEntity);
              results.push(newEntity);
              successful++;
            } else {
              results.push(existingEntity);
              successful++;
            }
            break;
          }

          case 'create_relation': {
            const relationData = operation.data as Omit<Relation, 'createdAt'>;
            const existingRelation = workingGraph.relations.find(r => 
              r.from === relationData.from && 
              r.to === relationData.to && 
              r.relationType === relationData.relationType
            );
            
            if (!existingRelation) {
              const newRelation: Relation = {
                ...relationData,
                createdAt: new Date().toISOString(),
                strength: relationData.strength || 0.8,
                createdBy: operation.userId
              };
              workingGraph.relations.push(newRelation);
              results.push(newRelation);
              successful++;
            } else {
              results.push(existingRelation);
              successful++;
            }
            break;
          }

          case 'update_entity': {
            const { entityName, newObservations, metadata } = operation.data;
            const entity = workingGraph.entities.find(e => e.name === entityName);
            
            if (entity) {
              if (newObservations && newObservations.length > 0) {
                entity.observations.push(...newObservations);
              }
              if (metadata) {
                entity.metadata = { ...entity.metadata, ...metadata };
              }
              entity.updatedAt = new Date().toISOString();
              results.push(entity);
              successful++;
            } else {
              throw new Error(`Entity '${entityName}' not found`);
            }
            break;
          }

          case 'delete_entity': {
            const entityName = operation.data.entityName || operation.data;
            const entityIndex = workingGraph.entities.findIndex(e => e.name === entityName);
            
            if (entityIndex !== -1) {
              // Remove entity
              const deletedEntity = workingGraph.entities.splice(entityIndex, 1)[0];
              
              // Remove related relations
              workingGraph.relations = workingGraph.relations.filter(r => 
                r.from !== entityName && r.to !== entityName
              );
              
              results.push(deletedEntity);
              successful++;
            } else {
              throw new Error(`Entity '${entityName}' not found`);
            }
            break;
          }

          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }
      } catch (error) {
        errors.push(`Operation ${operation.type} failed: ${error instanceof Error ? error.message : String(error)}`);
        results.push(null);
        failed++;
      }
    }

    return {
      updatedGraph: workingGraph,
      successful,
      failed,
      errors,
      results
    };
  }

  /**
   * Delete multiple observations from entities
   */
  static deleteObservations(
    graph: KnowledgeGraph,
    deletions: { entityName: string; observations: string[] }[]
  ): { updatedGraph: KnowledgeGraph; modified: boolean } {
    let modified = false;
    const updatedGraph = { ...graph, entities: [...graph.entities] };

    for (const deletion of deletions) {
      const entity = updatedGraph.entities.find(e => e.name === deletion.entityName);
      if (entity) {
        const originalLength = entity.observations.length;
        entity.observations = entity.observations.filter(obs => 
          !deletion.observations.includes(obs)
        );
        
        if (entity.observations.length < originalLength) {
          entity.updatedAt = new Date().toISOString();
          modified = true;
        }
      }
    }

    return { updatedGraph, modified };
  }

  /**
   * Delete multiple relations from the knowledge graph
   */
  static deleteRelations(
    graph: KnowledgeGraph,
    relations: { from: string; to: string; relationType: string }[]
  ): { updatedGraph: KnowledgeGraph; deletedCount: number } {
    const originalLength = graph.relations.length;
    
    const updatedRelations = graph.relations.filter(existing => 
      !relations.some(toDelete => 
        existing.from === toDelete.from && 
        existing.to === toDelete.to && 
        existing.relationType === toDelete.relationType
      )
    );

    return {
      updatedGraph: { ...graph, relations: updatedRelations },
      deletedCount: originalLength - updatedRelations.length
    };
  }

  /**
   * Add multiple observations to entities
   */
  static addObservations(
    graph: KnowledgeGraph,
    observations: { entityName: string; contents: string[] }[]
  ): { updatedGraph: KnowledgeGraph; results: Entity[] } {
    const results: Entity[] = [];
    const updatedGraph = { ...graph, entities: [...graph.entities] };

    for (const obs of observations) {
      const entity = updatedGraph.entities.find(e => e.name === obs.entityName);
      if (entity) {
        entity.observations.push(...obs.contents);
        entity.updatedAt = new Date().toISOString();
        results.push(entity);
      }
    }

    return { updatedGraph, results };
  }
}
