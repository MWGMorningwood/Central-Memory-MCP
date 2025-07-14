#!/usr/bin/env node

import express, { Request, Response, NextFunction } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Environment configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH || path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.json');

// Configure logging
const log = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || ''),
  error: (message: string, error?: any) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || ''),
  debug: (message: string, meta?: any) => {
    if (NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
    }
  }
};

// Data interfaces
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
  version?: string;
  lastModified?: string;
}

// Enhanced Knowledge Graph Manager with better error handling and logging
class KnowledgeGraphManager {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      log.error('Failed to create directory', error);
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
          log.warn('Failed to parse line in knowledge graph', { line, error: parseError });
        }
        return acc;
      }, { entities: [], relations: [], version: "1.0" });

      log.debug('Loaded knowledge graph', { entityCount: graph.entities.length, relationCount: graph.relations.length });
      return graph;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        log.info('Knowledge graph file not found, starting with empty graph');
        return { entities: [], relations: [], version: "1.0" };
      }
      log.error('Failed to load knowledge graph', error);
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
      log.debug('Saved knowledge graph', { entityCount: graph.entities.length, relationCount: graph.relations.length });
    } catch (error) {
      log.error('Failed to save knowledge graph', error);
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
    
    log.info('Created entities', { count: newEntities.length });
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
    
    log.info('Created relations', { count: newRelations.length });
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
    log.info('Added observations', { operations: results.length });
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    
    await this.saveGraph(graph);
    log.info('Deleted entities', { count: entityNames.length });
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
    log.info('Deleted observations', { operations: deletions.length });
  }

  async deleteRelations(relations: Omit<Relation, 'createdAt'>[]): Promise<void> {
    const graph = await this.loadGraph();
    
    graph.relations = graph.relations.filter(r => !relations.some(delRelation => 
      r.from === delRelation.from && 
      r.to === delRelation.to && 
      r.relationType === delRelation.relationType
    ));
    
    await this.saveGraph(graph);
    log.info('Deleted relations', { count: relations.length });
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
  
    log.debug('Search completed', { query, entityResults: filteredEntities.length, relationResults: filteredRelations.length });
    
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
  
    log.debug('Opened nodes', { requestedNodes: names.length, foundEntities: filteredEntities.length });
    
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

// Initialize the knowledge graph manager
const knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH);

// Create MCP Server instance
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "central-memory-server",
    version: "1.0.0",
  }, {
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "create_entities",
          description: "Create multiple new entities in the centralized knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "The unique name of the entity" },
                    entityType: { type: "string", description: "The type of the entity" },
                    observations: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "An array of observation contents associated with the entity"
                    },
                  },
                  required: ["name", "entityType", "observations"],
                },
              },
            },
            required: ["entities"],
          },
        },
        {
          name: "create_relations",
          description: "Create multiple new relations between entities in the knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              relations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    from: { type: "string", description: "The name of the source entity" },
                    to: { type: "string", description: "The name of the target entity" },
                    relationType: { type: "string", description: "The type of the relation in active voice" },
                  },
                  required: ["from", "to", "relationType"],
                },
              },
            },
            required: ["relations"],
          },
        },
        {
          name: "add_observations",
          description: "Add new observations to existing entities in the knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              observations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entityName: { type: "string", description: "The name of the entity to add observations to" },
                    contents: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "An array of observation contents to add"
                    },
                  },
                  required: ["entityName", "contents"],
                },
              },
            },
            required: ["observations"],
          },
        },
        {
          name: "delete_entities",
          description: "Delete multiple entities and their associated relations from the knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              entityNames: { 
                type: "array", 
                items: { type: "string" },
                description: "An array of entity names to delete" 
              },
            },
            required: ["entityNames"],
          },
        },
        {
          name: "delete_observations",
          description: "Delete specific observations from entities in the knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              deletions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    entityName: { type: "string", description: "The name of the entity containing the observations" },
                    observations: { 
                      type: "array", 
                      items: { type: "string" },
                      description: "An array of observations to delete"
                    },
                  },
                  required: ["entityName", "observations"],
                },
              },
            },
            required: ["deletions"],
          },
        },
        {
          name: "delete_relations",
          description: "Delete multiple relations from the knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              relations: { 
                type: "array", 
                items: {
                  type: "object",
                  properties: {
                    from: { type: "string", description: "The name of the source entity" },
                    to: { type: "string", description: "The name of the target entity" },
                    relationType: { type: "string", description: "The type of the relation" },
                  },
                  required: ["from", "to", "relationType"],
                },
                description: "An array of relations to delete" 
              },
            },
            required: ["relations"],
          },
        },
        {
          name: "read_graph",
          description: "Read the entire centralized knowledge graph",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "search_nodes",
          description: "Search for nodes in the knowledge graph based on a query",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
            },
            required: ["query"],
          },
        },
        {
          name: "open_nodes",
          description: "Open specific nodes in the knowledge graph by their names",
          inputSchema: {
            type: "object",
            properties: {
              names: {
                type: "array",
                items: { type: "string" },
                description: "An array of entity names to retrieve",
              },
            },
            required: ["names"],
          },
        },
        {
          name: "get_stats",
          description: "Get statistics about the centralized knowledge graph",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }

    try {
      switch (name) {
        case "create_entities":
          const createdEntities = await knowledgeGraphManager.createEntities(args.entities as Omit<Entity, 'createdAt' | 'updatedAt'>[]);
          return { content: [{ type: "text", text: JSON.stringify(createdEntities, null, 2) }] };
          
        case "create_relations":
          const createdRelations = await knowledgeGraphManager.createRelations(args.relations as Omit<Relation, 'createdAt'>[]);
          return { content: [{ type: "text", text: JSON.stringify(createdRelations, null, 2) }] };
          
        case "add_observations":
          const observationResults = await knowledgeGraphManager.addObservations(args.observations as { entityName: string; contents: string[] }[]);
          return { content: [{ type: "text", text: JSON.stringify(observationResults, null, 2) }] };
          
        case "delete_entities":
          await knowledgeGraphManager.deleteEntities(args.entityNames as string[]);
          return { content: [{ type: "text", text: "Entities deleted successfully" }] };
          
        case "delete_observations":
          await knowledgeGraphManager.deleteObservations(args.deletions as { entityName: string; observations: string[] }[]);
          return { content: [{ type: "text", text: "Observations deleted successfully" }] };
          
        case "delete_relations":
          await knowledgeGraphManager.deleteRelations(args.relations as Omit<Relation, 'createdAt'>[]);
          return { content: [{ type: "text", text: "Relations deleted successfully" }] };
          
        case "read_graph":
          const fullGraph = await knowledgeGraphManager.readGraph();
          return { content: [{ type: "text", text: JSON.stringify(fullGraph, null, 2) }] };
          
        case "search_nodes":
          const searchResults = await knowledgeGraphManager.searchNodes(args.query as string);
          return { content: [{ type: "text", text: JSON.stringify(searchResults, null, 2) }] };
          
        case "open_nodes":
          const nodeResults = await knowledgeGraphManager.openNodes(args.names as string[]);
          return { content: [{ type: "text", text: JSON.stringify(nodeResults, null, 2) }] };
          
        case "get_stats":
          const stats = await knowledgeGraphManager.getStats();
          return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      log.error(`Tool execution failed: ${name}`, error);
      throw error;
    }
  });

  return server;
}

// Create Express app with health checks and MCP endpoint
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = Math.random().toString(36).substring(7);
  req.headers['x-request-id'] = requestId;
  log.debug(`Request: ${req.method} ${req.path}`, { requestId, userAgent: req.get('User-Agent') });
  next();
});

// Health check endpoint for Azure Container Apps
app.get('/health', async (req: Request, res: Response) => {
  try {
    const stats = await knowledgeGraphManager.getStats();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      stats
    });
  } catch (error) {
    log.error('Health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Readiness probe for Azure Container Apps
app.get('/ready', (req: Request, res: Response) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Main MCP endpoint
app.post("/mcp", async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    log.debug('MCP request received', { requestId, body: req.body });
    
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    
    res.on("close", () => {
      transport.close();
      server.close();
    });
    
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    
    log.debug('MCP request completed', { requestId });
  } catch (error) {
    log.error("Error handling MCP request", { requestId, error });
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

// Handle GET requests on /mcp endpoint as per MCP specification
app.get("/mcp", async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  
  try {
    log.debug('MCP GET request received', { requestId, query: req.query });
    
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    
    res.on("close", () => {
      transport.close();
      server.close();
    });
    
    await server.connect(transport);
    await transport.handleRequest(req, res, req.query);
    
    log.debug('MCP GET request completed', { requestId });
  } catch (error) {
    log.error("Error handling MCP GET request", { requestId, error });
    
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

// Handle unsupported HTTP methods on /mcp
app.delete("/mcp", (req: Request, res: Response) => {
  res.status(405).json({
    error: "Method Not Allowed", 
    message: "MCP endpoint supports GET and POST methods only"
  });
});

app.put("/mcp", (req: Request, res: Response) => {
  res.status(405).json({
    error: "Method Not Allowed", 
    message: "MCP endpoint supports GET and POST methods only"
  });
});

app.patch("/mcp", (req: Request, res: Response) => {
  res.status(405).json({
    error: "Method Not Allowed", 
    message: "MCP endpoint supports GET and POST methods only"
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  log.info(`Central Memory MCP Server started`, {
    port: PORT,
    nodeEnv: NODE_ENV,
    memoryPath: MEMORY_FILE_PATH,
    version: '1.0.0'
  });
});