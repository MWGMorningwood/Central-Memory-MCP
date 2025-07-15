/**
 * Core domain types for the knowledge graph
 */

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;  // User who created this entity
  metadata?: Record<string, any>;  // Additional metadata
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;  // User who created this relation
  strength?: number;   // Relationship strength/confidence (0-1)
  metadata?: Record<string, any>;  // Additional metadata
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  version?: string;
  lastModified?: string;
}
