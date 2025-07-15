/**
 * Operation parameter types for MCP tool operations
 */

import { Entity, Relation } from './core.js';

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

export interface EntityMergeParams {
  targetEntityName: string;
  sourceEntityNames: string[];
  mergeStrategy: 'combine' | 'replace' | 'manual';
  keepObservations?: boolean;
  keepMetadata?: boolean;
}

export interface DuplicateDetectionResult {
  duplicateGroups: {
    entities: Entity[];
    similarityScore: number;
    suggestedMergeTarget: string;
  }[];
}
