import { TableClient, TableEntity, odata } from '@azure/data-tables';
import { DefaultAzureCredential } from '@azure/identity';
import { Entity, Relation } from '../types/index.js';
import { Logger } from './logger.js';

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
      const tableEntities: TableEntity[] = entities.map(entity => ({
        partitionKey: workspaceId,
        rowKey: entity.name,
        name: entity.name,
        entityType: entity.entityType,
        observations: JSON.stringify(entity.observations || []),
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        createdBy: entity.createdBy || '',
        metadata: entity.metadata ? JSON.stringify(entity.metadata) : ''
      }));

      // Batch operations for better performance
      const batchSize = 100; // Azure Table Storage limit
      for (let i = 0; i < tableEntities.length; i += batchSize) {
        const batch = tableEntities.slice(i, i + batchSize);
        
        if (batch.length === 1) {
          // Single entity upsert
          await this.entityTableClient.upsertEntity(batch[0]);
        } else {
          // Batch upsert - use individual upserts for now
          await Promise.all(batch.map(entity => this.entityTableClient.upsertEntity(entity)));
        }
      }

      this.logger.debug('Upserted entities', { 
        workspaceId, 
        count: entities.length 
      });
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
      const tableRelations: TableEntity[] = relations.map(relation => ({
        partitionKey: workspaceId,
        rowKey: `${relation.from}|${relation.to}|${relation.relationType}`,
        from: relation.from,
        to: relation.to,
        relationType: relation.relationType,
        createdAt: relation.createdAt,
        updatedAt: relation.updatedAt || relation.createdAt,
        createdBy: relation.createdBy || '',
        strength: relation.strength || 0.8,
        metadata: relation.metadata ? JSON.stringify(relation.metadata) : ''
      }));

      // Batch operations for better performance
      const batchSize = 100;
      for (let i = 0; i < tableRelations.length; i += batchSize) {
        const batch = tableRelations.slice(i, i + batchSize);
        
        if (batch.length === 1) {
          await this.relationTableClient.upsertEntity(batch[0]);
        } else {
          // Batch upsert - use individual upserts for now
          await Promise.all(batch.map(relation => this.relationTableClient.upsertEntity(relation)));
        }
      }

      this.logger.debug('Upserted relations', { 
        workspaceId, 
        count: relations.length 
      });
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
        entities.push({
          name: entity.name as string,
          entityType: entity.entityType as string,
          observations: entity.observations ? JSON.parse(entity.observations as string) : [],
          createdAt: entity.createdAt as string,
          updatedAt: entity.updatedAt as string,
          createdBy: entity.createdBy as string || undefined,
          metadata: entity.metadata ? JSON.parse(entity.metadata as string) : undefined
        });
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
        relations.push({
          from: relation.from as string,
          to: relation.to as string,
          relationType: relation.relationType as string,
          createdAt: relation.createdAt as string,
          updatedAt: relation.updatedAt as string,
          createdBy: relation.createdBy as string || undefined,
          strength: relation.strength as number || 0.8,
          metadata: relation.metadata ? JSON.parse(relation.metadata as string) : undefined
        });
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
        entities.push({
          name: entity.name as string,
          entityType: entity.entityType as string,
          observations: entity.observations ? JSON.parse(entity.observations as string) : [],
          createdAt: entity.createdAt as string,
          updatedAt: entity.updatedAt as string,
          createdBy: entity.createdBy as string || undefined,
          metadata: entity.metadata ? JSON.parse(entity.metadata as string) : undefined
        });
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
        relations.push({
          from: relation.from as string,
          to: relation.to as string,
          relationType: relation.relationType as string,
          createdAt: relation.createdAt as string,
          updatedAt: relation.updatedAt as string,
          createdBy: relation.createdBy as string || undefined,
          strength: relation.strength as number || 0.8,
          metadata: relation.metadata ? JSON.parse(relation.metadata as string) : undefined
        });
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
      
      return {
        name: entity.name as string,
        entityType: entity.entityType as string,
        observations: entity.observations ? JSON.parse(entity.observations as string) : [],
        createdAt: entity.createdAt as string,
        updatedAt: entity.updatedAt as string,
        createdBy: entity.createdBy as string || undefined,
        metadata: entity.metadata ? JSON.parse(entity.metadata as string) : undefined
      };
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
        const entityData = {
          name: entity.name as string,
          entityType: entity.entityType as string,
          observations: entity.observations ? JSON.parse(entity.observations as string) : [],
          createdAt: entity.createdAt as string,
          updatedAt: entity.updatedAt as string,
          createdBy: entity.createdBy as string || undefined,
          metadata: entity.metadata ? JSON.parse(entity.metadata as string) : undefined
        };

        const actionType = entityData.updatedAt !== entityData.createdAt ? 'updated' : 'created';
        entities.push({ ...entityData, actionType });
      }

      // Query relations in time range
      const relationFilter = odata`PartitionKey eq ${workspaceId} and (createdAt ge ${startTime} and createdAt le ${endTime}) or (updatedAt ge ${startTime} and updatedAt le ${endTime})`;
      const relationsIter = this.relationTableClient.listEntities({
        queryOptions: { filter: relationFilter }
      });

      for await (const relation of relationsIter) {
        const relationData = {
          from: relation.from as string,
          to: relation.to as string,
          relationType: relation.relationType as string,
          createdAt: relation.createdAt as string,
          updatedAt: relation.updatedAt as string,
          createdBy: relation.createdBy as string || undefined,
          strength: relation.strength as number || 0.8,
          metadata: relation.metadata ? JSON.parse(relation.metadata as string) : undefined
        };

        const actionType = relationData.updatedAt !== relationData.createdAt ? 'updated' : 'created';
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
