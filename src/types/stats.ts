/**
 * Statistics and analytics types for knowledge graph metrics
 */

export interface KnowledgeGraphStats {
  entityCount: number;
  relationCount: number;
  entityTypes: Record<string, number>;
  relationTypes: Record<string, number>;
  userStats?: Record<string, { entities: number; relations: number }>;
  lastModified?: string;
}
