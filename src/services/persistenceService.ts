import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { Logger } from './logger.js';
import { TableStorageManager } from './tableStorageManager.js';

// Environment configuration for Azure Table Storage
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

/**
 * PersistenceService - Pure storage operations
 * 
 * This service handles only storage operations, no business logic.
 */
export class PersistenceService {
  private readonly logger: Logger;
  private readonly tableStorageManager: TableStorageManager;
  private readonly workspaceId: string;

  /**
   * Factory method to create a workspace-specific PersistenceService
   */
  static async createForWorkspace(workspaceId: string, logger: Logger): Promise<PersistenceService> {
    if (!AZURE_STORAGE_ACCOUNT_NAME) {
      throw new Error('Azure Table Storage configuration required: AZURE_STORAGE_ACCOUNT_NAME must be set');
    }

    try {
      const tableStorageManager = new TableStorageManager({
        accountName: AZURE_STORAGE_ACCOUNT_NAME,
        connectionString: AZURE_STORAGE_CONNECTION_STRING
      }, logger);

      await tableStorageManager.initialize();
      return new PersistenceService(workspaceId, logger, tableStorageManager);
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
    } catch (error) {
      this.logger.error('Failed to save knowledge graph', error);
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
   * Clears all data for this workspace
   */
  async clearMemory(): Promise<void> {
    try {
      await this.tableStorageManager.clearWorkspace(this.workspaceId);
    } catch (error) {
      this.logger.error('Failed to clear memory', error);
      throw error;
    }
  }

  /**
   * Gets temporal events from storage
   */
  async getTemporalEvents(startTime: string, endTime: string): Promise<{ entities: (Entity & { actionType: 'created' | 'updated' })[]; relations: (Relation & { actionType: 'created' | 'updated' })[] }> {
    return await this.tableStorageManager.getTemporalEvents(this.workspaceId, startTime, endTime);
  }

  getWorkspaceId(): string {
    return this.workspaceId;
  }
}
