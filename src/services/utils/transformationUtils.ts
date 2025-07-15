import { Entity, Relation } from '../../types/index.js';
import { TableEntity } from '@azure/data-tables';

/**
 * DRY utility functions for data transformations
 * Eliminates repetitive parsing and transformation logic
 */
export class TransformationUtils {
  /**
   * Transform table entity to domain Entity
   * Used by: getEntities, searchEntities, getTemporalEvents, getEntity
   */
  static tableEntityToEntity(tableEntity: any): Entity {
    return {
      name: tableEntity.name as string,
      entityType: tableEntity.entityType as string,
      observations: tableEntity.observations ? JSON.parse(tableEntity.observations as string) : [],
      createdAt: tableEntity.createdAt as string,
      updatedAt: tableEntity.updatedAt as string,
      createdBy: tableEntity.createdBy as string || undefined,
      metadata: tableEntity.metadata ? JSON.parse(tableEntity.metadata as string) : undefined
    };
  }

  /**
   * Transform table entity to domain Relation
   * Used by: getRelations, searchRelations, getTemporalEvents
   */
  static tableEntityToRelation(tableEntity: any): Relation {
    return {
      from: tableEntity.from as string,
      to: tableEntity.to as string,
      relationType: tableEntity.relationType as string,
      createdAt: tableEntity.createdAt as string,
      updatedAt: tableEntity.updatedAt as string,
      createdBy: tableEntity.createdBy as string || undefined,
      strength: tableEntity.strength as number || 0.8,
      metadata: tableEntity.metadata ? JSON.parse(tableEntity.metadata as string) : undefined
    };
  }

  /**
   * Transform domain Entity to table entity
   * Used by: upsertEntities
   */
  static entityToTableEntity(entity: Entity, workspaceId: string): TableEntity {
    return {
      partitionKey: workspaceId,
      rowKey: entity.name,
      name: entity.name,
      entityType: entity.entityType,
      observations: JSON.stringify(entity.observations || []),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      createdBy: entity.createdBy || '',
      metadata: entity.metadata ? JSON.stringify(entity.metadata) : ''
    };
  }

  /**
   * Transform domain Relation to table entity
   * Used by: upsertRelations
   */
  static relationToTableEntity(relation: Relation, workspaceId: string): TableEntity {
    return {
      partitionKey: workspaceId,
      rowKey: `${relation.from}|${relation.to}|${relation.relationType}`,
      from: relation.from,
      to: relation.to,
      relationType: relation.relationType,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt || relation.createdAt,
      createdBy: relation.createdBy || '',
      strength: relation.strength || 0.8,
      metadata: relation.metadata ? JSON.stringify(relation.metadata) : ''
    };
  }

  /**
   * Determine action type for temporal events
   * Used by: getTemporalEvents (both entities and relations)
   */
  static determineActionType(createdAt?: string, updatedAt?: string): 'created' | 'updated' {
    if (!createdAt || !updatedAt) return 'created';
    return updatedAt !== createdAt ? 'updated' : 'created';
  }

  /**
   * Safe JSON parsing with fallback
   * Used by: All transformation methods
   */
  static safeJsonParse(jsonString: string | undefined, fallback: any = undefined): any {
    if (!jsonString) return fallback;
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  }

  /**
   * Safe JSON stringification
   * Used by: All table entity transformations
   */
  static safeJsonStringify(obj: any): string {
    if (!obj) return '';
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  }
}
