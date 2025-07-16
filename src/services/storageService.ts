import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { Logger } from './logger.js';

// =============================================================================
// TRANSFORMATION UTILITIES
// =============================================================================

/**
 * Convert entity to table entity for storage
 */
function entityToTableEntity(entity: Entity, workspaceId: string): TableEntity {
  // Validate required fields
  if (!entity.name || typeof entity.name !== 'string') {
    throw new Error('Entity name is required and must be a string');
  }
  
  if (!entity.entityType || typeof entity.entityType !== 'string') {
    throw new Error('Entity entityType is required and must be a string');
  }
  
  if (!Array.isArray(entity.observations)) {
    throw new Error('Entity observations must be an array');
  }
  
  return {
    partitionKey: workspaceId,
    rowKey: entity.name,
    name: entity.name,
    entityType: entity.entityType,
    observations: JSON.stringify(entity.observations),
    createdAt: entity.createdAt || new Date().toISOString(),
    updatedAt: entity.updatedAt || new Date().toISOString(),
    createdBy: entity.createdBy || 'default-user',
    metadata: entity.metadata ? JSON.stringify(entity.metadata) : undefined,
  };
}

/**
 * Convert relation to table entity for storage
 */
function relationToTableEntity(relation: Relation, workspaceId: string): TableEntity {
  const rowKey = `${relation.from}|${relation.to}|${relation.relationType}`;
  return {
    partitionKey: workspaceId,
    rowKey,
    from: relation.from,
    to: relation.to,
    relationType: relation.relationType,
    createdAt: relation.createdAt || new Date().toISOString(),
    updatedAt: relation.updatedAt || new Date().toISOString(),
    createdBy: relation.createdBy || 'default-user',
    strength: relation.strength,
    metadata: relation.metadata ? JSON.stringify(relation.metadata) : undefined,
  };
}

/**
 * Convert table entity to domain entity
 */
function tableEntityToEntity(tableEntity: any): Entity {
  return {
    name: tableEntity.name as string,
    entityType: tableEntity.entityType as string,
    observations: JSON.parse(tableEntity.observations as string || '[]'),
    createdAt: tableEntity.createdAt as string,
    updatedAt: tableEntity.updatedAt as string,
    createdBy: tableEntity.createdBy as string,
    metadata: tableEntity.metadata ? JSON.parse(tableEntity.metadata as string) : undefined,
  };
}

/**
 * Convert table entity to domain relation
 */
function tableEntityToRelation(tableEntity: any): Relation {
  // Validate required fields exist
  if (!tableEntity.from || !tableEntity.to || !tableEntity.relationType) {
    throw new Error(`Invalid relation data: missing required fields. Got: ${JSON.stringify(tableEntity)}`);
  }

  return {
    from: tableEntity.from as string,
    to: tableEntity.to as string,
    relationType: tableEntity.relationType as string,
    createdAt: tableEntity.createdAt as string,
    updatedAt: tableEntity.updatedAt as string,
    createdBy: tableEntity.createdBy as string,
    strength: tableEntity.strength as number,
    metadata: tableEntity.metadata ? JSON.parse(tableEntity.metadata as string) : undefined,
  };
}

/**
 * Determine action type based on timestamps
 */
function determineActionType(createdAt?: string, updatedAt?: string): 'created' | 'updated' {
  if (!createdAt || !updatedAt) return 'created';
  return createdAt === updatedAt ? 'created' : 'updated';
}

// =============================================================================
// BATCH OPERATION UTILITIES
// =============================================================================

/**
 * Execute operations in batches with logging
 */
async function executeBatch<T>(
  items: T[],
  processor: (batch: T[]) => Promise<void>,
  batchSize: number,
  logger: Logger
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
    logger.debug(`Processed batch ${Math.ceil(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
  }
}

/**
 * Process items either individually or in batch
 */
async function processItems<T>(
  items: T[],
  singleProcessor: (item: T) => Promise<void>,
  batchProcessor: (items: T[]) => Promise<void>
): Promise<void> {
  if (items.length === 1) {
    await singleProcessor(items[0]);
  } else {
    await batchProcessor(items);
  }
}

// =============================================================================
// STORAGE SERVICE
// =============================================================================

// Environment configuration for Azure Table Storage
const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_WEB_JOBS_STORAGE = process.env.AzureWebJobsStorage;

// Check if we're using development storage
const isUsingDevelopmentStorage = AZURE_WEB_JOBS_STORAGE === 'UseDevelopmentStorage=true';
const DEVELOPMENT_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;';

/**
 * StorageService - Unified storage operations for knowledge graphs
 * 
 * Combines persistence operations with Azure Table Storage management
 * Provides workspace-aware interface for all storage operations
 */
export class StorageService {
  private readonly logger: Logger;
  private readonly entityTableClient: TableClient;
  private readonly relationTableClient: TableClient;
  private readonly accountName: string;
  private readonly workspaceId: string;

  /**
   * Factory method to create a workspace-specific StorageService
   */
  static async createForWorkspace(workspaceId: string, logger: Logger): Promise<StorageService> {
    // First check if we have Azure Storage account configured - prioritize real storage
    if (AZURE_STORAGE_ACCOUNT_NAME) {
      logger.info(`Using Azure Storage account: ${AZURE_STORAGE_ACCOUNT_NAME}`);
      try {
        const service = new StorageService(workspaceId, logger, {
          accountName: AZURE_STORAGE_ACCOUNT_NAME,
          connectionString: AZURE_STORAGE_CONNECTION_STRING
        });

        await service.initialize();
        return service;
      } catch (error) {
        logger.error('Failed to initialize Azure Table Storage', error);
        throw error;
      }
    }

    // Fall back to development storage if no Azure Storage account is configured
    if (isUsingDevelopmentStorage) {
      logger.info('Using development storage (Azurite) - no Azure Storage account configured');
      try {
        const service = new StorageService(workspaceId, logger, {
          accountName: 'devstoreaccount1',
          connectionString: DEVELOPMENT_STORAGE_CONNECTION_STRING
        });

        await service.initialize();
        return service;
      } catch (error) {
        logger.error('Failed to initialize development storage', error);
        throw error;
      }
    }

    // No storage configuration found
    throw new Error('No storage configuration found. Either set AZURE_STORAGE_ACCOUNT_NAME for production or AzureWebJobsStorage=UseDevelopmentStorage=true for development.');
  }

  constructor(
    workspaceId: string,
    logger: Logger,
    config: {
      accountName: string;
      connectionString?: string;
    }
  ) {
    this.workspaceId = workspaceId;
    this.logger = logger;
    this.accountName = config.accountName;

    // Use managed identity for secure authentication
    const credential = new DefaultAzureCredential();
    
    if (config.connectionString) {
      // For local development with Azurite
      this.entityTableClient = TableClient.fromConnectionString(config.connectionString, 'entities', {
        allowInsecureConnection: true
      });
      this.relationTableClient = TableClient.fromConnectionString(config.connectionString, 'relations', {
        allowInsecureConnection: true
      });
    } else {
      // For production with managed identity
      this.entityTableClient = new TableClient(
        `https://${config.accountName}.table.core.windows.net`,
        'entities',
        credential
      );
      this.relationTableClient = new TableClient(
        `https://${config.accountName}.table.core.windows.net`,
        'relations',
        credential
      );
    }

    // DO NOT DIRECTLY LOG SENSITIVE INFORMATION
    this.logger.info('Storage Service initialized', { 
      workspaceId,
      accountName: config.accountName
    });
  }

  /**
   * Initialize table storage (create tables if they don't exist)
   */
  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.entityTableClient.createTable(),
        this.relationTableClient.createTable()
      ]);
      
      this.logger.info('Storage tables initialized');
    } catch (error: any) {
      // Tables might already exist - check if it's just a conflict
      if (error.statusCode === 409) {
        this.logger.info('Tables already exist, continuing');
      } else {
        this.logger.error('Failed to initialize tables', error);
        throw error;
      }
    }
  }

  // =============================================================================
  // KNOWLEDGE GRAPH OPERATIONS (from PersistenceService)
  // =============================================================================

  /**
   * Loads the complete knowledge graph from storage
   */
  async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const [entities, relations] = await Promise.all([
        this.getEntities(),
        this.getRelations()
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
        this.upsertEntities(graph.entities),
        this.upsertRelations(graph.relations)
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
      const entity = await this.entityTableClient.getEntity(this.workspaceId, entityName);
      return tableEntityToEntity(entity);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      this.logger.error('Failed to get entity', error);
      throw error;
    }
  }

  /**
   * Clears all data for this workspace
   */
  async clearMemory(): Promise<void> {
    try {
      await this.clearWorkspace();
    } catch (error) {
      this.logger.error('Failed to clear memory', error);
      throw error;
    }
  }

  /**
   * Gets temporal events from storage
   */
  async getTemporalEvents(startTime: string, endTime: string): Promise<{ entities: (Entity & { actionType: 'created' | 'updated' })[]; relations: (Relation & { actionType: 'created' | 'updated' })[] }> {
    try {
      const entities: (Entity & { actionType: 'created' | 'updated' })[] = [];
      const relations: (Relation & { actionType: 'created' | 'updated' })[] = [];

      // Query entities in time range
      const entityFilter = odata`PartitionKey eq ${this.workspaceId} and (createdAt ge ${startTime} and createdAt le ${endTime}) or (updatedAt ge ${startTime} and updatedAt le ${endTime})`;
      const entitiesIter = this.entityTableClient.listEntities({
        queryOptions: { filter: entityFilter }
      });

      for await (const entity of entitiesIter) {
        const entityData = tableEntityToEntity(entity);
        const actionType = determineActionType(entityData.createdAt, entityData.updatedAt);
        entities.push({ ...entityData, actionType });
      }

      // Query relations in time range
      const relationFilter = odata`PartitionKey eq ${this.workspaceId} and (createdAt ge ${startTime} and createdAt le ${endTime}) or (updatedAt ge ${startTime} and updatedAt le ${endTime})`;
      const relationsIter = this.relationTableClient.listEntities({
        queryOptions: { filter: relationFilter }
      });

      for await (const relation of relationsIter) {
        try {
          const relationData = tableEntityToRelation(relation);
          const actionType = determineActionType(relationData.createdAt, relationData.updatedAt);
          relations.push({ ...relationData, actionType });
        } catch (error) {
          this.logger.warn('Skipping corrupted relation record', { 
            error: error instanceof Error ? error.message : String(error),
            relationData: relation 
          });
        }
      }

      this.logger.debug('Retrieved temporal events', {
        workspaceId: this.workspaceId,
        timeRange: { startTime, endTime },
        entityCount: entities.length,
        relationCount: relations.length
      });

      return { entities, relations };
    } catch (error) {
      this.logger.error('Failed to get temporal events', error);
      throw error;
    }
  }

  // =============================================================================
  // AZURE TABLE STORAGE OPERATIONS (from TableStorageManager)
  // =============================================================================

  /**
   * Create or update multiple entities in batch
   */
  async upsertEntities(entities: Entity[]): Promise<void> {
    try {
      const tableEntities: TableEntity[] = entities.map(entity => 
        entityToTableEntity(entity, this.workspaceId)
      );

      await executeBatch(
        tableEntities,
        async (batch) => {
          await processItems(
            batch,
            async (entity) => { await this.entityTableClient.upsertEntity(entity); },
            async (items) => { await Promise.all(items.map(entity => this.entityTableClient.upsertEntity(entity))); }
          );
        },
        100, // Azure Table Storage batch limit
        this.logger
      );
    } catch (error) {
      this.logger.error('Failed to upsert entities', error);
      throw error;
    }
  }

  /**
   * Create or update multiple relations in batch
   */
  async upsertRelations(relations: Relation[]): Promise<void> {
    try {
      const tableRelations: TableEntity[] = relations.map(relation => 
        relationToTableEntity(relation, this.workspaceId)
      );

      await executeBatch(
        tableRelations,
        async (batch) => {
          await processItems(
            batch,
            async (relation) => { await this.relationTableClient.upsertEntity(relation); },
            async (items) => { await Promise.all(items.map(relation => this.relationTableClient.upsertEntity(relation))); }
          );
        },
        100, // Azure Table Storage batch limit
        this.logger
      );
    } catch (error) {
      this.logger.error('Failed to upsert relations', error);
      throw error;
    }
  }

  /**
   * Get all entities for this workspace
   */
  async getEntities(): Promise<Entity[]> {
    try {
      const entities: Entity[] = [];
      const entitiesIter = this.entityTableClient.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${this.workspaceId}` }
      });

      for await (const entity of entitiesIter) {
        entities.push(tableEntityToEntity(entity));
      }

      this.logger.debug('Retrieved entities', { 
        workspaceId: this.workspaceId, 
        count: entities.length 
      });

      return entities;
    } catch (error) {
      this.logger.error('Failed to get entities', error);
      throw error;
    }
  }

  /**
   * Get all relations for this workspace
   */
  async getRelations(): Promise<Relation[]> {
    try {
      const relations: Relation[] = [];
      const relationsIter = this.relationTableClient.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${this.workspaceId}` }
      });

      for await (const relation of relationsIter) {
        try {
          relations.push(tableEntityToRelation(relation));
        } catch (error) {
          this.logger.warn('Skipping corrupted relation record', { 
            error: error instanceof Error ? error.message : String(error),
            relationData: relation 
          });
        }
      }

      this.logger.debug('Retrieved relations', { 
        workspaceId: this.workspaceId, 
        count: relations.length 
      });

      return relations;
    } catch (error) {
      this.logger.error('Failed to get relations', error);
      throw error;
    }
  }

  /**
   * Search entities by name or type
   */
  async searchEntities(query: { name?: string; entityType?: string }): Promise<Entity[]> {
    try {
      let filter = odata`PartitionKey eq ${this.workspaceId}`;
      
      if (query.name) {
        filter = odata`${filter} and contains(name, ${query.name})`;
      }
      
      if (query.entityType) {
        filter = odata`${filter} and contains(entityType, ${query.entityType})`;
      }

      const entities: Entity[] = [];
      const entitiesIter = this.entityTableClient.listEntities({
        queryOptions: { filter }
      });

      for await (const entity of entitiesIter) {
        entities.push(tableEntityToEntity(entity));
      }

      this.logger.debug('Searched entities', { 
        workspaceId: this.workspaceId, 
        query, 
        count: entities.length 
      });

      return entities;
    } catch (error) {
      this.logger.error('Failed to search entities', error);
      throw error;
    }
  }

  /**
   * Search relations by from/to/type
   */
  async searchRelations(query: { from?: string; to?: string; relationType?: string }): Promise<Relation[]> {
    try {
      let filter = odata`PartitionKey eq ${this.workspaceId}`;
      
      if (query.from) {
        filter = odata`${filter} and from eq ${query.from}`;
      }
      
      if (query.to) {
        filter = odata`${filter} and to eq ${query.to}`;
      }
      
      if (query.relationType) {
        filter = odata`${filter} and contains(relationType, ${query.relationType})`;
      }

      const relations: Relation[] = [];
      const relationsIter = this.relationTableClient.listEntities({
        queryOptions: { filter }
      });

      for await (const relation of relationsIter) {
        relations.push(tableEntityToRelation(relation));
      }

      this.logger.debug('Searched relations', { 
        workspaceId: this.workspaceId, 
        query, 
        count: relations.length 
      });

      return relations;
    } catch (error) {
      this.logger.error('Failed to search relations', error);
      throw error;
    }
  }

  /**
   * Delete entity
   */
  async deleteEntity(entityName: string): Promise<void> {
    try {
      await this.entityTableClient.deleteEntity(this.workspaceId, entityName);
      this.logger.debug('Deleted entity', { workspaceId: this.workspaceId, entityName });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        this.logger.error('Failed to delete entity', error);
        throw error;
      }
    }
  }

  /**
   * Delete relation
   */
  async deleteRelation(from: string, to: string, relationType: string): Promise<void> {
    try {
      const rowKey = `${from}|${to}|${relationType}`;
      await this.relationTableClient.deleteEntity(this.workspaceId, rowKey);
      this.logger.debug('Deleted relation', { workspaceId: this.workspaceId, from, to, relationType });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        this.logger.error('Failed to delete relation', error);
        throw error;
      }
    }
  }

  /**
   * Clear all data for this workspace
   */
  async clearWorkspace(): Promise<void> {
    try {
      // Delete all entities
      const entities = await this.getEntities();
      for (const entity of entities) {
        await this.deleteEntity(entity.name);
      }

      // Delete all relations
      const relations = await this.getRelations();
      for (const relation of relations) {
        await this.deleteRelation(relation.from, relation.to, relation.relationType);
      }

      this.logger.info('Cleared workspace', { 
        workspaceId: this.workspaceId, 
        entitiesDeleted: entities.length,
        relationsDeleted: relations.length
      });
    } catch (error) {
      this.logger.error('Failed to clear workspace', error);
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  getWorkspaceId(): string {
    return this.workspaceId;
  }
}
