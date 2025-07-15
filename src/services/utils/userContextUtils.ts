/**
 * DRY utility for user context enhancement
 * Eliminates repetitive user context patterns
 */
export class UserContextUtils {
  /**
   * Add user context to entities
   */
  static enhanceEntitiesWithUser(entities: any[], userId?: string): any[] {
    return entities.map((entity: any) => ({
      ...entity,
      createdBy: entity.createdBy || userId,
    }));
  }

  /**
   * Add user context to relations
   */
  static enhanceRelationsWithUser(relations: any[], userId?: string): any[] {
    return relations.map((rel: any) => ({
      ...rel,
      createdBy: rel.createdBy || userId,
      strength: rel.strength !== undefined ? rel.strength : (rel.strength === 0 ? 0 : 0.8),
    }));
  }

  /**
   * Generic user context enhancement
   */
  static enhanceWithUser<T extends Record<string, any>>(
    items: T[], 
    userId?: string,
    additionalDefaults?: Partial<T>
  ): T[] {
    return items.map((item: any) => ({
      ...item,
      createdBy: item.createdBy || userId,
      ...additionalDefaults,
    }));
  }
}
