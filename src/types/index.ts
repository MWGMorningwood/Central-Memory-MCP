// Data interfaces for the knowledge graph
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

// Enhanced relationship types for Phase 2
export type PreferenceRelationType = 'prefers' | 'dislikes' | 'interested_in';
export type InteractionRelationType = 'asked_about' | 'discussed_with' | 'learned_from';
export type TemporalRelationType = 'before' | 'after' | 'caused_by';
export type ContextualRelationType = 'in_context_of' | 'related_to_project';
export type ExpertiseRelationType = 'expert_in' | 'learning' | 'teaches';
export type TechnicalRelationType = 'built_with' | 'depends_on' | 'implements';

export type EnhancedRelationType = 
  | PreferenceRelationType 
  | InteractionRelationType 
  | TemporalRelationType 
  | ContextualRelationType
  | ExpertiseRelationType
  | TechnicalRelationType;

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  version?: string;
  lastModified?: string;
}

export interface KnowledgeGraphStats {
  entityCount: number;
  relationCount: number;
  entityTypes: Record<string, number>;
  relationTypes: Record<string, number>;
  userStats?: Record<string, { entities: number; relations: number }>;
  lastModified?: string;
}

// Tool operation interfaces
export interface CreateEntitiesParams {
  entities: Omit<Entity, 'createdAt' | 'updatedAt'>[];
}

export interface CreateRelationsParams {
  relations: Omit<Relation, 'createdAt'>[];
}

export interface AddObservationsParams {
  observations: {
    entityName: string;
    contents: string[];
  }[];
}

export interface DeleteEntitiesParams {
  entityNames: string[];
}

export interface DeleteObservationsParams {
  deletions: {
    entityName: string;
    observations: string[];
  }[];
}

export interface DeleteRelationsParams {
  relations: Omit<Relation, 'createdAt'>[];
}

export interface SearchNodesParams {
  query: string;
}

export interface OpenNodesParams {
  names: string[];
}

export interface AddObservationResult {
  entityName: string;
  addedObservations: string[];
}

// Temporal query interfaces
export interface TemporalQuery {
  startTime?: string;
  endTime?: string;
  entityName?: string;
  relationType?: string;
  userId?: string;
}

export interface TemporalResult {
  entities: (Entity & { actionType: 'created' | 'updated' })[];
  relations: (Relation & { actionType: 'created' })[];
  timeRange: { start: string; end: string };
}

// Entity merging interfaces
export interface DuplicateDetectionResult {
  duplicateGroups: {
    entities: Entity[];
    similarityScore: number;
    suggestedMergeTarget: string;
  }[];
}

export interface EntityMergeParams {
  targetEntityName: string;
  sourceEntityNames: string[];
  mergeStrategy: 'combine' | 'replace' | 'manual';
  keepObservations?: boolean;
  keepMetadata?: boolean;
}

// Batch operation interfaces
export interface BatchOperation {
  type: 'create_entity' | 'create_relation' | 'update_entity' | 'delete_entity';
  data: any;
  userId?: string;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: string[];
  results: any[];
}
