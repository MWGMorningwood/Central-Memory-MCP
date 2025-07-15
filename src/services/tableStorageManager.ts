import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { Entity, Relation } from '../types/index.js';
import { Logger } from './logger.js';

// Table Storage transformation utilities
class TransformationUtils {
  static entityToTableEntity(entity: Entity, workspaceId: string): TableEntity {
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

  static relationToTableEntity(relation: Relation, workspaceId: string): TableEntity {
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

  static tableEntityToEntity(tableEntity: any): Entity {
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

  static tableEntityToRelation(tableEntity: any): Relation {
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

  static determineActionType(createdAt?: string, updatedAt?: string): 'created' | 'updated' {
    if (!createdAt || !updatedAt) return 'created';
    return createdAt === updatedAt ? 'created' : 'updated';
  }
}

// Batch processing utilities
class BatchOperationUtils {
  static async executeBatch<T>(
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

  static async processItems<T>(
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
}

/**
 * Azure Table Storage manager for knowledge graph data
 * Uses managed identity for secure authentication
 * Optimized for knowledge graph operations with proper partitioning
 */
export class TableStorageManager {
  private readonly logger: Logger;
  private readonly entityTableClient: TableClient;
  private readonly relationTableClient: TableClient;
  private readonly accountName: string;
  private readonly initialized = false;

  constructor(
    config: {
      accountName: string;
      connectionString?: string;
    },
    logger: Logger
  ) {
    this.logger = logger;
    this.accountName = config.accountName;

    // Use managed identity for secure authentication
    const credential = new DefaultAzureCredential();
    
    if (config.connectionString) {
      // For local development with Azurite
      this.entityTableClient = new TableClient(config.connectionString, 'entities');
      this.relationTableClient = new TableClient(config.connectionString, 'relations');
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

    this.logger.info('Table Storage Manager initialized', { 
      accountName: config.accountName,
      useConnectionString: !!config.connectionString
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
      
      this.logger.info('Table Storage tables initialized');
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

  /**
   * Create or update multiple entities in batch
   * Uses workspace as partition key for optimal performance
   */
  async upsertEntities(workspaceId: string, entities: Entity[]): Promise<void> {
    try {
      const tableEntities: TableEntity[] = entities.map(entity => 
        TransformationUtils.entityToTableEntity(entity, workspaceId)
      );

      // DRY: Use BatchOperationUtils for consistent batch processing
      await BatchOperationUtils.executeBatch(
        tableEntities,
        async (batch) => {
          await BatchOperationUtils.processItems(
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
  async upsertRelations(workspaceId: string, relations: Relation[]): Promise<void> {
    try {
      const tableRelations: TableEntity[] = relations.map(relation => 
        TransformationUtils.relationToTableEntity(relation, workspaceId)
      );

      // DRY: Use BatchOperationUtils for consistent batch processing
      await BatchOperationUtils.executeBatch(
        tableRelations,
        async (batch) => {
          await BatchOperationUtils.processItems(
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
   * Get all entities for a workspace
   */
  async getEntities(workspaceId: string): Promise<Entity[]> {
    try {
      const entities: Entity[] = [];
      const entitiesIter = this.entityTableClient.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${workspaceId}` }
      });

      for await (const entity of entitiesIter) {
        entities.push(TransformationUtils.tableEntityToEntity(entity));
      }

      this.logger.debug('Retrieved entities', { 
        workspaceId, 
        count: entities.length 
      });

      return entities;
    } catch (error) {
      this.logger.error('Failed to get entities', error);
      throw error;
    }
  }

  /**
   * Get all relations for a workspace
   */
  async getRelations(workspaceId: string): Promise<Relation[]> {
    try {
      const relations: Relation[] = [];
      const relationsIter = this.relationTableClient.listEntities({
        queryOptions: { filter: odata`PartitionKey eq ${workspaceId}` }
      });

      for await (const relation of relationsIter) {
        relations.push(TransformationUtils.tableEntityToRelation(relation));
      }

      this.logger.debug('Retrieved relations', { 
        workspaceId, 
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
  async searchEntities(
    workspaceId: string, 
    query: { name?: string; entityType?: string }
  ): Promise<Entity[]> {
    try {
      let filter = odata`PartitionKey eq ${workspaceId}`;
      
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
        entities.push(TransformationUtils.tableEntityToEntity(entity));
      }

      this.logger.debug('Searched entities', { 
        workspaceId, 
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
  async searchRelations(
    workspaceId: string,
    query: { from?: string; to?: string; relationType?: string }
  ): Promise<Relation[]> {
    try {
      let filter = odata`PartitionKey eq ${workspaceId}`;
      
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
        relations.push(TransformationUtils.tableEntityToRelation(relation));
      }

      this.logger.debug('Searched relations', { 
        workspaceId, 
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
   * Get entity by name
   */
  async getEntity(workspaceId: string, entityName: string): Promise<Entity | null> {
    try {
      const entity = await this.entityTableClient.getEntity(workspaceId, entityName);
      return TransformationUtils.tableEntityToEntity(entity);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      this.logger.error('Failed to get entity', error);
      throw error;
    }
  }

  /**
   * Delete entity
   */
  async deleteEntity(workspaceId: string, entityName: string): Promise<void> {
    try {
      await this.entityTableClient.deleteEntity(workspaceId, entityName);
      this.logger.debug('Deleted entity', { workspaceId, entityName });
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
  async deleteRelation(workspaceId: string, from: string, to: string, relationType: string): Promise<void> {
    try {
      const rowKey = `${from}|${to}|${relationType}`;
      await this.relationTableClient.deleteEntity(workspaceId, rowKey);
      this.logger.debug('Deleted relation', { workspaceId, from, to, relationType });
    } catch (error: any) {
      if (error.statusCode !== 404) {
        this.logger.error('Failed to delete relation', error);
        throw error;
      }
    }
  }

  /**
   * Clear all data for a workspace
   */
  async clearWorkspace(workspaceId: string): Promise<void> {
    try {
      // Delete all entities
      const entities = await this.getEntities(workspaceId);
      for (const entity of entities) {
        await this.deleteEntity(workspaceId, entity.name);
      }

      // Delete all relations
      const relations = await this.getRelations(workspaceId);
      for (const relation of relations) {
        await this.deleteRelation(workspaceId, relation.from, relation.to, relation.relationType);
      }

      this.logger.info('Cleared workspace', { 
        workspaceId, 
        entitiesDeleted: entities.length,
        relationsDeleted: relations.length
      });
    } catch (error) {
      this.logger.error('Failed to clear workspace', error);
      throw error;
    }
  }

  /**
   * Get temporal events (entities/relations created/updated in time range)
   */
  async getTemporalEvents(
    workspaceId: string,
    startTime: string,
    endTime: string
  ): Promise<{
    entities: (Entity & { actionType: 'created' | 'updated' })[];
    relations: (Relation & { actionType: 'created' | 'updated' })[];
  }> {
    try {
      const entities: (Entity & { actionType: 'created' | 'updated' })[] = [];
      const relations: (Relation & { actionType: 'created' | 'updated' })[] = [];

      // Query entities in time range
      const entityFilter = odata`PartitionKey eq ${workspaceId} and (createdAt ge ${startTime} and createdAt le ${endTime}) or (updatedAt ge ${startTime} and updatedAt le ${endTime})`;
      const entitiesIter = this.entityTableClient.listEntities({
        queryOptions: { filter: entityFilter }
      });

      for await (const entity of entitiesIter) {
        const entityData = TransformationUtils.tableEntityToEntity(entity);
        const actionType = TransformationUtils.determineActionType(entityData.createdAt, entityData.updatedAt);
        entities.push({ ...entityData, actionType });
      }

      // Query relations in time range
      const relationFilter = odata`PartitionKey eq ${workspaceId} and (createdAt ge ${startTime} and createdAt le ${endTime}) or (updatedAt ge ${startTime} and updatedAt le ${endTime})`;
      const relationsIter = this.relationTableClient.listEntities({
        queryOptions: { filter: relationFilter }
      });

      for await (const relation of relationsIter) {
        const relationData = TransformationUtils.tableEntityToRelation(relation);
        const actionType = TransformationUtils.determineActionType(relationData.createdAt, relationData.updatedAt);
        relations.push({ ...relationData, actionType });
      }

      this.logger.debug('Retrieved temporal events', {
        workspaceId,
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
}
