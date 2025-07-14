import { promises as fs } from 'fs';
import path from 'path';
import { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import { Logger } from './logger.js';

export class KnowledgeGraphManager {
  private readonly filePath: string;
  private readonly logger: Logger;

  constructor(filePath: string, logger: Logger) {
    this.filePath = filePath;
    this.logger = logger;
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create directory', error);
    }
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.filePath, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      
      const graph = lines.reduce((acc: KnowledgeGraph, line) => {
        try {
          const item = JSON.parse(line);
          if (item.type === "entity") {
            acc.entities.push({
              ...item,
              updatedAt: item.updatedAt || new Date().toISOString()
            });
          }
          if (item.type === "relation") {
            acc.relations.push({
              ...item,
              createdAt: item.createdAt || new Date().toISOString()
            });
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse line in knowledge graph', { line, error: parseError });
        }
        return acc;
      }, { entities: [], relations: [], version: "1.0" });

      this.logger.debug('Loaded knowledge graph', { entityCount: graph.entities.length, relationCount: graph.relations.length });
      return graph;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        this.logger.info('Knowledge graph file not found, starting with empty graph');
        return { entities: [], relations: [], version: "1.0" };
      }
      this.logger.error('Failed to load knowledge graph', error);
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    try {
      graph.lastModified = new Date().toISOString();
      const lines = [
        ...graph.entities.map(e => JSON.stringify({ type: "entity", ...e })),
        ...graph.relations.map(r => JSON.stringify({ type: "relation", ...r })),
      ];
      await fs.writeFile(this.filePath, lines.join("\n"));
      this.logger.debug('Saved knowledge graph', { entityCount: graph.entities.length, relationCount: graph.relations.length });
    } catch (error) {
      this.logger.error('Failed to save knowledge graph', error);
      throw error;
    }
  }

  async createEntities(entities: Omit<Entity, 'createdAt' | 'updatedAt'>[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const now = new Date().toISOString();
    
    const newEntities = entities
      .filter(e => !graph.entities.some(existing => existing.name === e.name))
      .map(e => ({
        ...e,
        createdAt: now,
        updatedAt: now
      }));
    
    graph.entities.push(...newEntities);
    await this.saveGraph(graph);
    
    this.logger.info('Created entities', { count: newEntities.length });
    return newEntities;
  }

  async createRelations(relations: Omit<Relation, 'createdAt'>[]): Promise<Relation[]> {
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
        createdAt: now
      }));
    
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    
    this.logger.info('Created relations', { count: newRelations.length });
    return newRelations;
  }

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const now = new Date().toISOString();
    
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      entity.updatedAt = now;
      
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    
    await this.saveGraph(graph);
    this.logger.info('Added observations', { operations: results.length });
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    
    await this.saveGraph(graph);
    this.logger.info('Deleted entities', { count: entityNames.length });
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    const graph = await this.loadGraph();
    const now = new Date().toISOString();
    
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
        entity.updatedAt = now;
      }
    });
    
    await this.saveGraph(graph);
    this.logger.info('Deleted observations', { operations: deletions.length });
  }

  async deleteRelations(relations: Omit<Relation, 'createdAt'>[]): Promise<void> {
    const graph = await this.loadGraph();
    
    graph.relations = graph.relations.filter(r => !relations.some(delRelation => 
      r.from === delRelation.from && 
      r.to === delRelation.to && 
      r.relationType === delRelation.relationType
    ));
    
    await this.saveGraph(graph);
    this.logger.info('Deleted relations', { count: relations.length });
  }

  async readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph();
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const lowerQuery = query.toLowerCase();
    
    const filteredEntities = graph.entities.filter(e => 
      e.name.toLowerCase().includes(lowerQuery) ||
      e.entityType.toLowerCase().includes(lowerQuery) ||
      e.observations.some(o => o.toLowerCase().includes(lowerQuery))
    );
  
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    this.logger.debug('Search completed', { query, entityResults: filteredEntities.length, relationResults: filteredRelations.length });
    
    return {
      entities: filteredEntities,
      relations: filteredRelations,
      version: graph.version
    };
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    this.logger.debug('Opened nodes', { requestedNodes: names.length, foundEntities: filteredEntities.length });
    
    return {
      entities: filteredEntities,
      relations: filteredRelations,
      version: graph.version
    };
  }

  async getStats(): Promise<{ entityCount: number; relationCount: number; lastModified?: string }> {
    const graph = await this.loadGraph();
    return {
      entityCount: graph.entities.length,
      relationCount: graph.relations.length,
      lastModified: graph.lastModified
    };
  }
}
