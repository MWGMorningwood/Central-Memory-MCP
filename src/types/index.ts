// Data interfaces for the knowledge graph
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  version?: string;
  lastModified?: string;
}

export interface KnowledgeGraphStats {
  entityCount: number;
  relationCount: number;
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
