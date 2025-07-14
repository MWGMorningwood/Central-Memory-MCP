import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { Logger } from './logger.js';
import { BlobStorageManager } from './blobStorageManager.js';

// Environment configuration for Azure Blob Storage
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'mcp-memory';
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;

// Fallback configuration for file-based storage
const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH || '/tmp/memory.json';

/**
 * Enhanced KnowledgeGraphManager with Azure Blob Storage support
 * 
 * Features:
 * - Workspace-specific memory isolation
 * - Azure Blob Storage with managed identity
 * - Backward compatibility with file-based storage
 * - Automatic workspace detection from environment
 * - Comprehensive error handling and logging
 */
export class KnowledgeGraphManager {
  private readonly logger: Logger;
  private readonly blobStorageManager?: BlobStorageManager;
  private readonly workspaceId: string;
  private readonly useFileStorage: boolean;
  private readonly filePath?: string;

  /**
   * Factory method to create a workspace-specific KnowledgeGraphManager
   * Tries Azure Blob Storage first, falls back to file storage
   */
  static async createForWorkspace(workspaceId: string, logger: Logger): Promise<KnowledgeGraphManager> {
    // Try to initialize Azure Blob Storage first (preferred)
    if (AZURE_STORAGE_ACCOUNT_NAME) {
      try {
        const blobStorageManager = new BlobStorageManager({
          accountName: AZURE_STORAGE_ACCOUNT_NAME,
          containerName: AZURE_STORAGE_CONTAINER_NAME,
          connectionString: AZURE_STORAGE_CONNECTION_STRING,
          accountKey: AZURE_STORAGE_ACCOUNT_KEY
        }, logger);

        return new KnowledgeGraphManager(workspaceId, logger, blobStorageManager);
      } catch (blobError) {
        logger.warn('Failed to initialize Azure Blob Storage, falling back to file storage', blobError);
      }
    }

    // Fall back to file-based storage
    const workspaceFilePath = MEMORY_FILE_PATH.replace(/\.[^/.]+$/, `-${workspaceId}.jsonl`);
    return new KnowledgeGraphManager(workspaceId, logger, undefined, workspaceFilePath);
  }

  constructor(
    workspaceId: string,
    logger: Logger,
    blobStorageManager?: BlobStorageManager,
    fallbackFilePath?: string
  ) {
    this.workspaceId = workspaceId;
    this.logger = logger;
    this.blobStorageManager = blobStorageManager;
    this.useFileStorage = !blobStorageManager;
    this.filePath = fallbackFilePath;

    if (this.useFileStorage) {
      this.logger.info('Initializing KnowledgeGraphManager with file storage', { 
        workspaceId, 
        filePath: fallbackFilePath 
      });
      if (fallbackFilePath) {
        this.ensureDirectoryExists(fallbackFilePath);
      }
    } else {
      this.logger.info('Initializing KnowledgeGraphManager with Azure Blob Storage', { 
        workspaceId 
      });
    }
  }

  /**
   * Ensures directory exists for file-based storage
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    try {
      const { promises: fs } = await import('fs');
      const path = await import('path');
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create directory', error);
    }
  }

  /**
   * Loads the knowledge graph from storage (blob or file)
   */
  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      let data: string;

      if (this.blobStorageManager) {
        // Load from Azure Blob Storage
        data = await this.blobStorageManager.readMemoryData(this.workspaceId);
      } else if (this.filePath) {
        // Load from file system (fallback)
        const { promises: fs } = await import('fs');
        try {
          data = await fs.readFile(this.filePath, "utf-8");
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            this.logger.info('Memory file not found, starting with empty graph');
            return { entities: [], relations: [] };
          }
          throw error;
        }
      } else {
        throw new Error('No storage configuration provided');
      }

      if (!data.trim()) {
        this.logger.info('Empty memory data, starting with empty graph');
        return { entities: [], relations: [] };
      }

      const lines = data.split("\n").filter(line => line.trim() !== "");
      
      const graph = lines.reduce((acc: KnowledgeGraph, line) => {
        try {
          const item = JSON.parse(line);
          if (item.entityType) {
            acc.entities.push(item as Entity);
          } else if (item.relationType) {
            acc.relations.push(item as Relation);
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse line in knowledge graph', { line, error: parseError });
        }
        return acc;
      }, { entities: [], relations: [] });

      this.logger.debug('Loaded knowledge graph', { 
        workspaceId: this.workspaceId,
        entityCount: graph.entities.length, 
        relationCount: graph.relations.length 
      });

      return graph;
    } catch (error) {
      this.logger.error('Failed to load knowledge graph', error);
      // Return empty graph on error to allow operation to continue
      return { entities: [], relations: [] };
    }
  }

  /**
   * Saves the knowledge graph to storage (blob or file)
   */
  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    try {
      const lines: string[] = [];
      
      // Add entities
      for (const entity of graph.entities) {
        lines.push(JSON.stringify(entity));
      }
      
      // Add relations  
      for (const relation of graph.relations) {
        lines.push(JSON.stringify(relation));
      }

      const data = lines.join("\n");

      if (this.blobStorageManager) {
        // Save to Azure Blob Storage
        await this.blobStorageManager.writeMemoryData(this.workspaceId, data);
      } else if (this.filePath) {
        // Save to file system (fallback)
        const { promises: fs } = await import('fs');
        await fs.writeFile(this.filePath, data);
      } else {
        throw new Error('No storage configuration provided');
      }

      this.logger.debug('Saved knowledge graph', { 
        workspaceId: this.workspaceId,
        entityCount: graph.entities.length, 
        relationCount: graph.relations.length 
      });
    } catch (error) {
      this.logger.error('Failed to save knowledge graph', error);
      throw error;
    }
  }

  /**
   * Creates new entities in the knowledge graph
   */
  async createEntities(entities: Omit<Entity, 'createdAt' | 'updatedAt'>[], userId?: string): Promise<Entity[]> {
    try {
      const graph = await this.loadGraph();
      const now = new Date().toISOString();
      
      const newEntities = entities
        .filter(e => !graph.entities.some(existing => existing.name === e.name))
        .map(e => ({
          ...e,
          createdAt: now,
          updatedAt: now,
          createdBy: userId
        }));
      
      if (newEntities.length === 0) {
        this.logger.info('No new entities to create (all already exist)', { 
          workspaceId: this.workspaceId,
          requestedCount: entities.length,
          userId 
        });
        return [];
      }

      graph.entities.push(...newEntities);
      await this.saveGraph(graph);
      
      this.logger.info('Created entities', { 
        workspaceId: this.workspaceId,
        count: newEntities.length,
        userId 
      });
      return newEntities;
    } catch (error) {
      this.logger.error('Failed to create entities', error);
      throw error;
    }
  }

  /**
   * Creates new relations in the knowledge graph
   */
  async createRelations(relations: Omit<Relation, 'createdAt'>[]): Promise<Relation[]> {
    try {
      const graph = await this.loadGraph();
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
          strength: r.strength || 0.8 // Default strength
        }));
      
      if (newRelations.length === 0) {
        this.logger.info('No new relations to create (all already exist)', { 
          workspaceId: this.workspaceId,
          requestedCount: relations.length 
        });
        return [];
      }

      graph.relations.push(...newRelations);
      await this.saveGraph(graph);
      
      this.logger.info('Created relations', { 
        workspaceId: this.workspaceId,
        count: newRelations.length 
      });
      return newRelations;
    } catch (error) {
      this.logger.error('Failed to create relations', error);
      throw error;
    }
  }

  /**
   * Searches for entities by name or type
   */
  async searchEntities(query?: { name?: string; entityType?: string }): Promise<Entity[]> {
    try {
      const graph = await this.loadGraph();
      let results = graph.entities;

      if (query?.name) {
        const nameQuery = query.name.toLowerCase();
        results = results.filter(e => 
          e.name.toLowerCase().includes(nameQuery)
        );
      }

      if (query?.entityType) {
        const typeQuery = query.entityType.toLowerCase();
        results = results.filter(e => 
          e.entityType.toLowerCase().includes(typeQuery)
        );
      }

      this.logger.debug('Searched entities', { 
        workspaceId: this.workspaceId,
        query, 
        resultCount: results.length 
      });
      return results;
    } catch (error) {
      this.logger.error('Failed to search entities', error);
      throw error;
    }
  }

  /**
   * Searches for relations by type or entity names
   */
  async searchRelations(query?: { 
    from?: string; 
    to?: string; 
    relationType?: string 
  }): Promise<Relation[]> {
    try {
      const graph = await this.loadGraph();
      let results = graph.relations;

      if (query?.from) {
        results = results.filter(r => r.from === query.from);
      }

      if (query?.to) {
        results = results.filter(r => r.to === query.to);
      }

      if (query?.relationType) {
        const typeQuery = query.relationType.toLowerCase();
        results = results.filter(r => 
          r.relationType.toLowerCase().includes(typeQuery)
        );
      }

      this.logger.debug('Searched relations', { 
        workspaceId: this.workspaceId,
        query, 
        resultCount: results.length 
      });
      return results;
    } catch (error) {
      this.logger.error('Failed to search relations', error);
      throw error;
    }
  }

  /**
   * Adds observations to an existing entity
   */
  async addObservation(entityName: string, observation: string): Promise<Entity | null> {
    try {
      const graph = await this.loadGraph();
      const entity = graph.entities.find(e => e.name === entityName);
      
      if (!entity) {
        this.logger.warn('Entity not found for observation', { 
          workspaceId: this.workspaceId,
          entityName 
        });
        return null;
      }

      entity.observations.push(observation);
      entity.updatedAt = new Date().toISOString();
      
      await this.saveGraph(graph);
      
      this.logger.info('Added observation to entity', { 
        workspaceId: this.workspaceId,
        entityName, 
        observationLength: observation.length 
      });
      return entity;
    } catch (error) {
      this.logger.error('Failed to add observation', error);
      throw error;
    }
  }

  /**
   * Adds multiple observations to entities (batch operation)
   */
  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<Entity[]> {
    try {
      const results: Entity[] = [];
      
      for (const obs of observations) {
        for (const content of obs.contents) {
          const result = await this.addObservation(obs.entityName, content);
          if (result) {
            results.push(result);
          }
        }
      }
      
      this.logger.info('Added multiple observations', { 
        workspaceId: this.workspaceId,
        observationCount: observations.length 
      });
      return results;
    } catch (error) {
      this.logger.error('Failed to add observations', error);
      throw error;
    }
  }

  /**
   * Deletes an entity and all its relations
   */
  async deleteEntity(entityName: string): Promise<boolean> {
    try {
      const graph = await this.loadGraph();
      const entityIndex = graph.entities.findIndex(e => e.name === entityName);
      
      if (entityIndex === -1) {
        this.logger.warn('Entity not found for deletion', { 
          workspaceId: this.workspaceId,
          entityName 
        });
        return false;
      }

      // Remove entity
      graph.entities.splice(entityIndex, 1);
      
      // Remove all relations involving this entity
      const relationsRemoved = graph.relations.length;
      graph.relations = graph.relations.filter(r => 
        r.from !== entityName && r.to !== entityName
      );
      const relationsAfter = graph.relations.length;
      
      await this.saveGraph(graph);
      
      this.logger.info('Deleted entity and relations', { 
        workspaceId: this.workspaceId,
        entityName, 
        relationsRemoved: relationsRemoved - relationsAfter 
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete entity', error);
      throw error;
    }
  }

  /**
   * Deletes multiple entities and all their relations (batch operation)
   */
  async deleteEntities(entityNames: string[]): Promise<void> {
    try {
      for (const entityName of entityNames) {
        await this.deleteEntity(entityName);
      }
      
      this.logger.info('Deleted multiple entities', { 
        workspaceId: this.workspaceId,
        count: entityNames.length 
      });
    } catch (error) {
      this.logger.error('Failed to delete entities', error);
      throw error;
    }
  }

  /**
   * Deletes specific observations from entities
   */
  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    try {
      const graph = await this.loadGraph();
      let modified = false;

      for (const deletion of deletions) {
        const entity = graph.entities.find(e => e.name === deletion.entityName);
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

      if (modified) {
        await this.saveGraph(graph);
      }
      
      this.logger.info('Deleted observations', { 
        workspaceId: this.workspaceId,
        deletionCount: deletions.length 
      });
    } catch (error) {
      this.logger.error('Failed to delete observations', error);
      throw error;
    }
  }

  /**
   * Deletes specific relations from the knowledge graph
   */
  async deleteRelations(relations: { from: string; to: string; relationType: string }[]): Promise<void> {
    try {
      const graph = await this.loadGraph();
      const originalLength = graph.relations.length;

      graph.relations = graph.relations.filter(existing => 
        !relations.some(toDelete => 
          existing.from === toDelete.from && 
          existing.to === toDelete.to && 
          existing.relationType === toDelete.relationType
        )
      );

      if (graph.relations.length < originalLength) {
        await this.saveGraph(graph);
      }
      
      this.logger.info('Deleted relations', { 
        workspaceId: this.workspaceId,
        deletedCount: originalLength - graph.relations.length 
      });
    } catch (error) {
      this.logger.error('Failed to delete relations', error);
      throw error;
    }
  }

  /**
   * Reads the entire knowledge graph
   */
  async readGraph(): Promise<{ entities: Entity[]; relations: Relation[] }> {
    try {
      const graph = await this.loadGraph();
      this.logger.debug('Read complete graph', { 
        workspaceId: this.workspaceId,
        entityCount: graph.entities.length,
        relationCount: graph.relations.length 
      });
      return graph;
    } catch (error) {
      this.logger.error('Failed to read graph', error);
      throw error;
    }
  }

  /**
   * Searches for nodes (entities) based on query string
   */
  async searchNodes(query: string): Promise<Entity[]> {
    try {
      const graph = await this.loadGraph();
      const searchTerm = query.toLowerCase();
      
      const results = graph.entities.filter(entity => {
        return entity.name.toLowerCase().includes(searchTerm) ||
               entity.entityType.toLowerCase().includes(searchTerm) ||
               entity.observations.some(obs => obs.toLowerCase().includes(searchTerm));
      });

      this.logger.debug('Searched nodes', { 
        workspaceId: this.workspaceId,
        query, 
        resultCount: results.length 
      });
      return results;
    } catch (error) {
      this.logger.error('Failed to search nodes', error);
      throw error;
    }
  }

  /**
   * Opens specific nodes (entities) by their names
   */
  async openNodes(names: string[]): Promise<Entity[]> {
    try {
      const graph = await this.loadGraph();
      const results = graph.entities.filter(entity => 
        names.includes(entity.name)
      );

      this.logger.debug('Opened nodes', { 
        workspaceId: this.workspaceId,
        requestedNames: names, 
        foundCount: results.length 
      });
      return results;
    } catch (error) {
      this.logger.error('Failed to open nodes', error);
      throw error;
    }
  }

  /**
   * Gets comprehensive statistics about the knowledge graph
   */
  async getStats(): Promise<{
    entityCount: number;
    relationCount: number;
    entityTypes: { [type: string]: number };
    relationTypes: { [type: string]: number };
    storageType: 'blob' | 'file';
    workspaceId: string;
    lastModified?: string;
  }> {
    try {
      const graph = await this.loadGraph();
      
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

      const stats = {
        entityCount: graph.entities.length,
        relationCount: graph.relations.length,
        entityTypes,
        relationTypes,
        storageType: this.blobStorageManager ? 'blob' as const : 'file' as const,
        workspaceId: this.workspaceId,
        lastModified: lastModified ? new Date(lastModified).toISOString() : undefined
      };

      this.logger.debug('Generated stats', { 
        workspaceId: this.workspaceId,
        stats 
      });
      return stats;
    } catch (error) {
      this.logger.error('Failed to get stats', error);
      throw error;
    }
  }

  /**
   * Clears all memory data for this workspace
   */
  async clearMemory(): Promise<void> {
    try {
      const emptyGraph: KnowledgeGraph = {
        entities: [],
        relations: []
      };
      
      await this.saveGraph(emptyGraph);
      
      this.logger.info('Cleared memory', { 
        workspaceId: this.workspaceId
      });
    } catch (error) {
      this.logger.error('Failed to clear memory', error);
      throw error;
    }
  }

  /**
   * Updates an existing entity with new observations and metadata
   */
  async updateEntity(
    entityName: string, 
    newObservations: string[], 
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<Entity | null> {
    try {
      const graph = await this.loadGraph();
      const entity = graph.entities.find(e => e.name === entityName);
      
      if (!entity) {
        this.logger.warn('Entity not found for update', { 
          workspaceId: this.workspaceId,
          entityName 
        });
        return null;
      }

      // Add new observations
      if (newObservations && newObservations.length > 0) {
        entity.observations.push(...newObservations);
      }

      // Update metadata
      if (metadata) {
        entity.metadata = { ...entity.metadata, ...metadata };
      }

      // Update timestamps and user info
      entity.updatedAt = new Date().toISOString();
      if (userId && !entity.createdBy) {
        entity.createdBy = userId;
      }

      await this.saveGraph(graph);
      
      this.logger.info('Updated entity', { 
        workspaceId: this.workspaceId,
        entityName,
        userId,
        newObservationsCount: newObservations?.length || 0
      });
      
      return entity;
    } catch (error) {
      this.logger.error('Failed to update entity', error);
      throw error;
    }
  }

  /**
   * Searches for relations by user
   */
  async searchRelationsByUser(query: { 
    userId?: string; 
    relationType?: string; 
  }): Promise<Relation[]> {
    try {
      const graph = await this.loadGraph();
      let results = graph.relations;

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

      this.logger.debug('Searched relations by user', { 
        workspaceId: this.workspaceId,
        query,
        resultCount: results.length 
      });
      
      return results;
    } catch (error) {
      this.logger.error('Failed to search relations by user', error);
      throw error;
    }
  }

  /**
   * Gets statistics for a specific user
   */
  async getUserStats(userId?: string): Promise<{
    entities: Entity[];
    relations: Relation[];
    entityCount: number;
    relationCount: number;
    topEntityTypes: { [type: string]: number };
    topRelationTypes: { [type: string]: number };
    userId: string;
  }> {
    try {
      const graph = await this.loadGraph();
      
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

      const stats = {
        entities: userEntities,
        relations: userRelations,
        entityCount: userEntities.length,
        relationCount: userRelations.length,
        topEntityTypes: entityTypes,
        topRelationTypes: relationTypes,
        userId: userId || 'all'
      };

      this.logger.debug('Generated user stats', { 
        workspaceId: this.workspaceId,
        userId,
        stats: {
          entityCount: stats.entityCount,
          relationCount: stats.relationCount
        }
      });
      
      return stats;
    } catch (error) {
      this.logger.error('Failed to get user stats', error);
      throw error;
    }
  }

  /**
   * Temporal queries - find what happened when
   */
  async getTemporalEvents(query: { 
    startTime?: string; 
    endTime?: string; 
    entityName?: string; 
    relationType?: string; 
    userId?: string 
  }): Promise<{
    entities: (Entity & { actionType: 'created' | 'updated' })[];
    relations: (Relation & { actionType: 'created' })[];
    timeRange: { start: string; end: string };
  }> {
    try {
      const graph = await this.loadGraph();
      const start = query.startTime || '1970-01-01T00:00:00.000Z';
      const end = query.endTime || new Date().toISOString();
      
      // Filter entities by time range
      let entities = graph.entities.filter(e => {
        const created = e.createdAt && e.createdAt >= start && e.createdAt <= end;
        const updated = e.updatedAt && e.updatedAt >= start && e.updatedAt <= end && e.updatedAt !== e.createdAt;
        return created || updated;
      }).map(e => ({
        ...e,
        actionType: (e.updatedAt && e.updatedAt !== e.createdAt) ? 'updated' as const : 'created' as const
      }));

      // Filter relations by time range
      let relations = graph.relations.filter(r => 
        r.createdAt && r.createdAt >= start && r.createdAt <= end
      ).map(r => ({
        ...r,
        actionType: 'created' as const
      }));

      // Apply additional filters
      if (query.entityName) {
        entities = entities.filter(e => 
          e.name.toLowerCase().includes(query.entityName!.toLowerCase())
        );
        relations = relations.filter(r => 
          r.from.toLowerCase().includes(query.entityName!.toLowerCase()) ||
          r.to.toLowerCase().includes(query.entityName!.toLowerCase())
        );
      }
      
      if (query.relationType) {
        relations = relations.filter(r => r.relationType === query.relationType);
      }
      
      if (query.userId) {
        entities = entities.filter(e => e.createdBy === query.userId);
        relations = relations.filter(r => r.createdBy === query.userId);
      }

      this.logger.debug('Generated temporal events', { 
        workspaceId: this.workspaceId,
        query,
        resultCount: { entities: entities.length, relations: relations.length }
      });

      return {
        entities,
        relations,
        timeRange: { start, end }
      };
    } catch (error) {
      this.logger.error('Failed to get temporal events', error);
      throw error;
    }
  }

  /**
   * Entity merging - detect and merge duplicate entities
   */
  async detectDuplicateEntities(threshold: number = 0.8): Promise<{
    duplicateGroups: {
      entities: Entity[];
      similarityScore: number;
      suggestedMergeTarget: string;
    }[];
  }> {
    try {
      const graph = await this.loadGraph();
      const duplicateGroups: {
        entities: Entity[];
        similarityScore: number;
        suggestedMergeTarget: string;
      }[] = [];

      // Group entities by type first for more efficient comparison
      const entitiesByType = graph.entities.reduce((acc, entity) => {
        if (!acc[entity.entityType]) acc[entity.entityType] = [];
        acc[entity.entityType].push(entity);
        return acc;
      }, {} as Record<string, Entity[]>);

      // Check for duplicates within each type
      for (const [entityType, entities] of Object.entries(entitiesByType)) {
        for (let i = 0; i < entities.length - 1; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const similarity = this.calculateEntitySimilarity(entities[i], entities[j]);
            
            if (similarity >= threshold) {
              // Check if already in a group
              const existingGroup = duplicateGroups.find(group => 
                group.entities.some(e => e.name === entities[i].name || e.name === entities[j].name)
              );
              
              if (existingGroup) {
                // Add to existing group if not already there
                if (!existingGroup.entities.some(e => e.name === entities[i].name)) {
                  existingGroup.entities.push(entities[i]);
                }
                if (!existingGroup.entities.some(e => e.name === entities[j].name)) {
                  existingGroup.entities.push(entities[j]);
                }
                existingGroup.similarityScore = Math.max(existingGroup.similarityScore, similarity);
              } else {
                // Create new group
                duplicateGroups.push({
                  entities: [entities[i], entities[j]],
                  similarityScore: similarity,
                  suggestedMergeTarget: entities[i].createdAt! <= entities[j].createdAt! ? entities[i].name : entities[j].name
                });
              }
            }
          }
        }
      }

      this.logger.debug('Detected duplicate entities', { 
        workspaceId: this.workspaceId,
        duplicateGroups: duplicateGroups.length,
        threshold
      });

      return { duplicateGroups };
    } catch (error) {
      this.logger.error('Failed to detect duplicate entities', error);
      throw error;
    }
  }

  /**
   * Merge duplicate entities
   */
  async mergeEntities(
    targetEntityName: string,
    sourceEntityNames: string[],
    mergeStrategy: 'combine' | 'replace' = 'combine',
    userId?: string
  ): Promise<Entity> {
    try {
      const graph = await this.loadGraph();
      
      const targetEntity = graph.entities.find(e => e.name === targetEntityName);
      if (!targetEntity) {
        throw new Error(`Target entity '${targetEntityName}' not found`);
      }

      const sourceEntities = sourceEntityNames.map(name => {
        const entity = graph.entities.find(e => e.name === name);
        if (!entity) {
          throw new Error(`Source entity '${name}' not found`);
        }
        return entity;
      });

      // Merge observations
      const mergedObservations = [...targetEntity.observations];
      if (mergeStrategy === 'combine') {
        sourceEntities.forEach(source => {
          source.observations.forEach(obs => {
            if (!mergedObservations.includes(obs)) {
              mergedObservations.push(obs);
            }
          });
        });
      }

      // Merge metadata
      const mergedMetadata = { ...targetEntity.metadata };
      if (mergeStrategy === 'combine') {
        sourceEntities.forEach(source => {
          if (source.metadata) {
            Object.assign(mergedMetadata, source.metadata);
          }
        });
      }

      // Update target entity
      const mergedEntity: Entity = {
        ...targetEntity,
        observations: mergedObservations,
        metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
        updatedAt: new Date().toISOString()
      };

      // Update relations to point to target entity
      graph.relations.forEach(relation => {
        if (sourceEntityNames.includes(relation.from)) {
          relation.from = targetEntityName;
        }
        if (sourceEntityNames.includes(relation.to)) {
          relation.to = targetEntityName;
        }
      });

      // Remove source entities
      graph.entities = graph.entities.filter(e => !sourceEntityNames.includes(e.name));
      
      // Update target entity in graph
      const targetIndex = graph.entities.findIndex(e => e.name === targetEntityName);
      graph.entities[targetIndex] = mergedEntity;

      await this.saveGraph(graph);

      this.logger.info('Merged entities', { 
        workspaceId: this.workspaceId,
        targetEntity: targetEntityName,
        sourceEntities: sourceEntityNames,
        mergeStrategy,
        userId
      });

      return mergedEntity;
    } catch (error) {
      this.logger.error('Failed to merge entities', error);
      throw error;
    }
  }

  /**
   * Batch operations for performance
   */
  async executeBatchOperations(operations: {
    type: 'create_entity' | 'create_relation' | 'update_entity' | 'delete_entity';
    data: any;
    userId?: string;
  }[]): Promise<{
    successful: number;
    failed: number;
    errors: string[];
    results: any[];
  }> {
    try {
      const results: any[] = [];
      const errors: string[] = [];
      let successful = 0;
      let failed = 0;

      for (const operation of operations) {
        try {
          let result;
          switch (operation.type) {
            case 'create_entity':
              result = await this.createEntities([operation.data], operation.userId);
              break;
            case 'create_relation':
              result = await this.createRelations([operation.data]);
              break;
            case 'update_entity':
              result = await this.updateEntity(
                operation.data.entityName,
                operation.data.newObservations || [],
                operation.userId,
                operation.data.metadata || {}
              );
              break;
            case 'delete_entity':
              result = await this.deleteEntity(operation.data.entityName);
              break;
            default:
              throw new Error(`Unknown operation type: ${operation.type}`);
          }
          results.push(result);
          successful++;
        } catch (error) {
          errors.push(`${operation.type}: ${error}`);
          results.push(null);
          failed++;
        }
      }

      this.logger.info('Executed batch operations', { 
        workspaceId: this.workspaceId,
        total: operations.length,
        successful,
        failed
      });

      return { successful, failed, errors, results };
    } catch (error) {
      this.logger.error('Failed to execute batch operations', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two entities
   */
  private calculateEntitySimilarity(entity1: Entity, entity2: Entity): number {
    // Simple similarity calculation based on name and observations
    let score = 0;
    
    // Name similarity (Levenshtein distance normalized)
    const nameScore = 1 - (this.levenshteinDistance(
      entity1.name.toLowerCase(), 
      entity2.name.toLowerCase()
    ) / Math.max(entity1.name.length, entity2.name.length));
    score += nameScore * 0.4;
    
    // Type match
    if (entity1.entityType === entity2.entityType) {
      score += 0.3;
    }
    
    // Observation overlap
    const obs1Set = new Set(entity1.observations.map(o => o.toLowerCase()));
    const obs2Set = new Set(entity2.observations.map(o => o.toLowerCase()));
    const intersection = new Set([...obs1Set].filter(x => obs2Set.has(x)));
    const union = new Set([...obs1Set, ...obs2Set]);
    const observationScore = intersection.size / union.size;
    score += observationScore * 0.3;
    
    return score;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
