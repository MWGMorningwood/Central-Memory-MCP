import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { Logger } from './logger.js';
import { TableStorageManager } from './tableStorageManager.js';
import { StatsUtils, BatchUtils, RelationUtils, EntityUtils } from './utils/index.js';

// Environment configuration for Azure Table Storage
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

/**
 * Simplified KnowledgeGraphManager - Core CRUD operations only
 * 
 * Features:
 * - Basic entity and relation operations
 * - Azure Table Storage integration
 * - Error handling and logging
 * - Workspace isolation
 */
export class KnowledgeGraphManager {
  private readonly logger: Logger;
  private readonly tableStorageManager: TableStorageManager;
  private readonly workspaceId: string;

  /**
   * Factory method to create a workspace-specific KnowledgeGraphManager
   */
  static async createForWorkspace(workspaceId: string, logger: Logger): Promise<KnowledgeGraphManager> {
    if (!AZURE_STORAGE_ACCOUNT_NAME) {
      throw new Error('Azure Table Storage configuration required: AZURE_STORAGE_ACCOUNT_NAME must be set');
    }

    try {
      const tableStorageManager = new TableStorageManager({
        accountName: AZURE_STORAGE_ACCOUNT_NAME,
        connectionString: AZURE_STORAGE_CONNECTION_STRING
      }, logger);

      await tableStorageManager.initialize();
      return new KnowledgeGraphManager(workspaceId, logger, tableStorageManager);
    } catch (error) {
      logger.error('Failed to initialize Azure Table Storage', error);
      throw error;
    }
  }

  constructor(
    workspaceId: string,
    logger: Logger,
    tableStorageManager: TableStorageManager
  ) {
    this.workspaceId = workspaceId;
    this.logger = logger;
    this.tableStorageManager = tableStorageManager;

    this.logger.info('KnowledgeGraphManager initialized', { workspaceId });
  }

  /**
   * Loads the complete knowledge graph from storage
   */
  async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const [entities, relations] = await Promise.all([
        this.tableStorageManager.getEntities(this.workspaceId),
        this.tableStorageManager.getRelations(this.workspaceId)
      ]);

      this.logger.debug('Loaded knowledge graph', { 
        workspaceId: this.workspaceId,
        entityCount: entities.length, 
        relationCount: relations.length 
      });

      return { entities, relations };
    } catch (error) {
      this.logger.error('Failed to load knowledge graph', error);
      return { entities: [], relations: [] };
    }
  }

  /**
   * Saves the complete knowledge graph to storage
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    try {
      await Promise.all([
        this.tableStorageManager.upsertEntities(this.workspaceId, graph.entities),
        this.tableStorageManager.upsertRelations(this.workspaceId, graph.relations)
      ]);

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

  // === ENTITY OPERATIONS ===

  /**
   * Creates new entities
   */
  async createEntities(entities: Omit<Entity, 'createdAt' | 'updatedAt'>[], userId?: string): Promise<Entity[]> {
    try {
      const graph = await this.loadGraph();
      const result = EntityUtils.createEntities(graph, entities, userId);
      
      if (result.newEntities.length === 0) {
        this.logger.info('No new entities to create', { workspaceId: this.workspaceId });
        return [];
      }

      await this.saveGraph(result.updatedGraph);
      
      this.logger.info('Created entities', { 
        workspaceId: this.workspaceId,
        count: result.newEntities.length
      });
      return result.newEntities;
    } catch (error) {
      this.logger.error('Failed to create entities', error);
      throw error;
    }
  }

  /**
   * Searches for entities
   */
  async searchEntities(query?: { name?: string; entityType?: string }): Promise<Entity[]> {
    try {
      const graph = await this.loadGraph();
      const results = EntityUtils.searchEntities(graph.entities, query || {});
      
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
   * Gets a single entity by name
   */
  async getEntity(entityName: string): Promise<Entity | null> {
    try {
      return await this.tableStorageManager.getEntity(this.workspaceId, entityName);
    } catch (error) {
      this.logger.error('Failed to get entity', error);
      throw error;
    }
  }

  /**
   * Updates an entity
   */
  async updateEntity(
    entityName: string, 
    newObservations: string[], 
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<Entity | null> {
    try {
      const graph = await this.loadGraph();
      const result = EntityUtils.updateEntity(graph, entityName, newObservations, userId, metadata);
      
      if (!result.updatedEntity) {
        this.logger.warn('Entity not found for update', { workspaceId: this.workspaceId, entityName });
        return null;
      }

      await this.saveGraph(result.updatedGraph);
      
      this.logger.info('Updated entity', { 
        workspaceId: this.workspaceId,
        entityName,
        newObservationsCount: newObservations?.length || 0
      });
      
      return result.updatedEntity;
    } catch (error) {
      this.logger.error('Failed to update entity', error);
      throw error;
    }
  }

  /**
   * Deletes an entity and all its relations
   */
  async deleteEntity(entityName: string): Promise<boolean> {
    try {
      const graph = await this.loadGraph();
      const result = EntityUtils.deleteEntity(graph, entityName);
      
      if (!result.deleted) {
        this.logger.warn('Entity not found for deletion', { workspaceId: this.workspaceId, entityName });
        return false;
      }

      await this.saveGraph(result.updatedGraph);
      
      this.logger.info('Deleted entity and relations', { 
        workspaceId: this.workspaceId,
        entityName
      });
      return true;
    } catch (error) {
      this.logger.error('Failed to delete entity', error);
      throw error;
    }
  }

  /**
   * Adds a single observation to an entity
   */
  async addObservation(entityName: string, observation: string): Promise<Entity | null> {
    return await this.updateEntity(entityName, [observation]);
  }

  // === RELATION OPERATIONS ===

  /**
   * Creates new relations
   */
  async createRelations(relations: Omit<Relation, 'createdAt'>[]): Promise<Relation[]> {
    try {
      const graph = await this.loadGraph();
      const result = RelationUtils.createRelations(graph, relations);
      
      if (result.newRelations.length === 0) {
        this.logger.info('No new relations to create', { workspaceId: this.workspaceId });
        return [];
      }

      await this.saveGraph(result.updatedGraph);
      
      this.logger.info('Created relations', { 
        workspaceId: this.workspaceId,
        count: result.newRelations.length 
      });
      return result.newRelations;
    } catch (error) {
      this.logger.error('Failed to create relations', error);
      throw error;
    }
  }

  /**
   * Searches for relations
   */
  async searchRelations(query?: { 
    from?: string; 
    to?: string; 
    relationType?: string 
  }): Promise<Relation[]> {
    try {
      const graph = await this.loadGraph();
      const results = RelationUtils.searchRelations(graph.relations, query || {});
      
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
   * Searches for relations by user
   */
  async searchRelationsByUser(query: { 
    userId?: string; 
    relationType?: string; 
  }): Promise<Relation[]> {
    try {
      const graph = await this.loadGraph();
      const results = RelationUtils.searchRelationsByUser(graph.relations, query);

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

  // === GRAPH OPERATIONS ===

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
   * Gets basic statistics about the knowledge graph
   */
  async getStats(): Promise<{
    entityCount: number;
    relationCount: number;
    entityTypes: { [type: string]: number };
    relationTypes: { [type: string]: number };
    storageType: 'table';
    workspaceId: string;
    lastModified?: string;
  }> {
    try {
      const graph = await this.loadGraph();
      const stats = StatsUtils.generateStats(graph, this.workspaceId);
      this.logger.debug('Generated stats', { workspaceId: this.workspaceId, stats });
      return stats;
    } catch (error) {
      this.logger.error('Failed to get stats', error);
      throw error;
    }
  }

  /**
   * Clears all data for this workspace
   */
  async clearMemory(): Promise<void> {
    try {
      await this.tableStorageManager.clearWorkspace(this.workspaceId);
      this.logger.info('Cleared memory', { workspaceId: this.workspaceId });
    } catch (error) {
      this.logger.error('Failed to clear memory', error);
      throw error;
    }
  }

  // === ADVANCED OPERATIONS (delegated to specialized services) ===

  /**
   * Gets user statistics
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
      const stats = StatsUtils.generateUserStats(graph, userId);
      this.logger.debug('Generated user stats', { workspaceId: this.workspaceId, userId });
      return stats;
    } catch (error) {
      this.logger.error('Failed to get user stats', error);
      throw error;
    }
  }

  /**
   * Gets temporal events
   */
  async getTemporalEvents(query: { 
    startTime?: string; 
    endTime?: string; 
    entityName?: string; 
    relationType?: string; 
    userId?: string 
  }): Promise<{
    entities: (Entity & { actionType: 'created' | 'updated' })[];
    relations: (Relation & { actionType: 'created' | 'updated' })[];
    timeRange: { start: string; end: string };
  }> {
    try {
      const start = query.startTime || '1970-01-01T00:00:00.000Z';
      const end = query.endTime || new Date().toISOString();
      
      const { entities, relations } = await this.tableStorageManager.getTemporalEvents(
        this.workspaceId, 
        start, 
        end
      );

      const filtered = StatsUtils.filterTemporalEvents(entities, relations, {
        entityName: query.entityName,
        relationType: query.relationType,
        userId: query.userId
      });

      this.logger.debug('Generated temporal events', { 
        workspaceId: this.workspaceId,
        query,
        resultCount: { entities: filtered.entities.length, relations: filtered.relations.length }
      });

      return {
        entities: filtered.entities,
        relations: filtered.relations,
        timeRange: { start, end }
      };
    } catch (error) {
      this.logger.error('Failed to get temporal events', error);
      throw error;
    }
  }

  /**
   * Detects duplicate entities
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
      const result = EntityUtils.detectDuplicates(graph, threshold);

      this.logger.debug('Detected duplicate entities', { 
        workspaceId: this.workspaceId,
        duplicateGroups: result.duplicateGroups.length,
        threshold
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to detect duplicate entities', error);
      throw error;
    }
  }

  /**
   * Merges entities
   */
  async mergeEntities(
    targetEntityName: string,
    sourceEntityNames: string[],
    mergeStrategy: 'combine' | 'replace' = 'combine',
    userId?: string
  ): Promise<Entity> {
    try {
      const graph = await this.loadGraph();
      const result = EntityUtils.mergeEntities(graph, targetEntityName, sourceEntityNames, mergeStrategy);
      
      await this.saveGraph(result.updatedGraph);

      this.logger.info('Merged entities', { 
        workspaceId: this.workspaceId,
        targetEntity: targetEntityName,
        sourceEntities: sourceEntityNames,
        mergeStrategy,
        userId
      });

      return result.mergedEntity;
    } catch (error) {
      this.logger.error('Failed to merge entities', error);
      throw error;
    }
  }

  /**
   * Executes batch operations
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
      const graph = await this.loadGraph();
      const result = await BatchUtils.executeBatchOperations(graph, operations);

      await this.saveGraph(result.updatedGraph);

      this.logger.info('Executed batch operations', { 
        workspaceId: this.workspaceId,
        total: operations.length,
        successful: result.successful,
        failed: result.failed
      });

      return {
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
        results: result.results
      };
    } catch (error) {
      this.logger.error('Failed to execute batch operations', error);
      throw error;
    }
  }
}
