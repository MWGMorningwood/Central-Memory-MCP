import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from 'zod';
import path from 'path';
import { KnowledgeGraphManager } from '../services/knowledgeGraphManager.js';
import { Logger } from '../services/logger.js';
import { Entity, Relation } from '../types/index.js';

// Environment configuration
const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH || '/tmp/memory.json';

function createMcpServer(knowledgeGraphManager: KnowledgeGraphManager, logger: Logger): McpServer {
  const server = new McpServer({
    name: "central-memory-server",
    version: "1.0.0",
  });

  // Register create_entities tool
  server.registerTool("create_entities", {
    description: "Create multiple new entities in the centralized knowledge graph",
    inputSchema: {
      entities: z.array(z.object({
        name: z.string().describe("The unique name of the entity"),
        entityType: z.string().describe("The type of the entity"),
        observations: z.array(z.string()).describe("An array of observation contents associated with the entity")
      }))
    }
  }, async ({ entities }) => {
    try {
      const createdEntities = await knowledgeGraphManager.createEntities(entities);
      return { content: [{ type: "text", text: JSON.stringify(createdEntities, null, 2) }] };
    } catch (error) {
      logger.error('Failed to create entities', error);
      throw error;
    }
  });

  // Register create_relations tool
  server.registerTool("create_relations", {
    description: "Create multiple new relations between entities in the knowledge graph",
    inputSchema: {
      relations: z.array(z.object({
        from: z.string().describe("The name of the source entity"),
        to: z.string().describe("The name of the target entity"),
        relationType: z.string().describe("The type of the relation in active voice")
      }))
    }
  }, async ({ relations }) => {
    try {
      const createdRelations = await knowledgeGraphManager.createRelations(relations);
      return { content: [{ type: "text", text: JSON.stringify(createdRelations, null, 2) }] };
    } catch (error) {
      logger.error('Failed to create relations', error);
      throw error;
    }
  });

  // Register add_observations tool
  server.registerTool("add_observations", {
    description: "Add new observations to existing entities in the knowledge graph",
    inputSchema: {
      observations: z.array(z.object({
        entityName: z.string().describe("The name of the entity to add observations to"),
        contents: z.array(z.string()).describe("An array of observation contents to add")
      }))
    }
  }, async ({ observations }) => {
    try {
      const results = await knowledgeGraphManager.addObservations(observations);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (error) {
      logger.error('Failed to add observations', error);
      throw error;
    }
  });

  // Register delete_entities tool
  server.registerTool("delete_entities", {
    description: "Delete multiple entities and their associated relations from the knowledge graph",
    inputSchema: {
      entityNames: z.array(z.string()).describe("An array of entity names to delete")
    }
  }, async ({ entityNames }) => {
    try {
      await knowledgeGraphManager.deleteEntities(entityNames);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    } catch (error) {
      logger.error('Failed to delete entities', error);
      throw error;
    }
  });

  // Register delete_observations tool
  server.registerTool("delete_observations", {
    description: "Delete specific observations from entities in the knowledge graph",
    inputSchema: {
      deletions: z.array(z.object({
        entityName: z.string().describe("The name of the entity containing the observations"),
        observations: z.array(z.string()).describe("An array of observations to delete")
      }))
    }
  }, async ({ deletions }) => {
    try {
      await knowledgeGraphManager.deleteObservations(deletions);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    } catch (error) {
      logger.error('Failed to delete observations', error);
      throw error;
    }
  });

  // Register delete_relations tool
  server.registerTool("delete_relations", {
    description: "Delete multiple relations from the knowledge graph",
    inputSchema: {
      relations: z.array(z.object({
        from: z.string().describe("The name of the source entity"),
        to: z.string().describe("The name of the target entity"),
        relationType: z.string().describe("The type of the relation")
      }))
    }
  }, async ({ relations }) => {
    try {
      await knowledgeGraphManager.deleteRelations(relations);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    } catch (error) {
      logger.error('Failed to delete relations', error);
      throw error;
    }
  });

  // Register read_graph tool
  server.registerTool("read_graph", {
    description: "Read the entire centralized knowledge graph",
    inputSchema: {}
  }, async () => {
    try {
      const graph = await knowledgeGraphManager.readGraph();
      return { content: [{ type: "text", text: JSON.stringify(graph, null, 2) }] };
    } catch (error) {
      logger.error('Failed to read graph', error);
      throw error;
    }
  });

  // Register search_nodes tool
  server.registerTool("search_nodes", {
    description: "Search for nodes in the knowledge graph based on a query",
    inputSchema: {
      query: z.string().describe("The search query to match against entity names, types, and observation content")
    }
  }, async ({ query }) => {
    try {
      const results = await knowledgeGraphManager.searchNodes(query);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (error) {
      logger.error('Failed to search nodes', error);
      throw error;
    }
  });

  // Register open_nodes tool
  server.registerTool("open_nodes", {
    description: "Open specific nodes in the knowledge graph by their names",
    inputSchema: {
      names: z.array(z.string()).describe("An array of entity names to retrieve")
    }
  }, async ({ names }) => {
    try {
      const results = await knowledgeGraphManager.openNodes(names);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    } catch (error) {
      logger.error('Failed to open nodes', error);
      throw error;
    }
  });

  // Register get_stats tool
  server.registerTool("get_stats", {
    description: "Get statistics about the centralized knowledge graph",
    inputSchema: {}
  }, async () => {
    try {
      const stats = await knowledgeGraphManager.getStats();
      return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
    } catch (error) {
      logger.error('Failed to get stats', error);
      throw error;
    }
  });

  return server;
}

// Azure Function for MCP requests
export async function mcpHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const logger = new Logger(context);
  const knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH, logger);
  
  try {
    logger.info(`MCP ${request.method} request received`, { url: request.url });
    
    if (request.method !== 'POST' && request.method !== 'GET') {
      return {
        status: 405,
        jsonBody: {
          error: "Method Not Allowed",
          message: "MCP endpoint supports GET and POST methods only"
        }
      };
    }

    const server = createMcpServer(knowledgeGraphManager, logger);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    
    await server.connect(transport);
    
    // Handle the request based on method
    let requestData: any;
    if (request.method === 'POST') {
      requestData = await request.json();
    } else {
      // For GET requests, convert query parameters to appropriate format
      requestData = request.query;
    }
    
    // Create a mock response object that captures the response
    let responseData: any;
    let statusCode = 200;
    const headers: Record<string, string> = {};
    
    const mockRes = {
      writeHead: (status: number, responseHeaders?: Record<string, string>) => {
        statusCode = status;
        if (responseHeaders) {
          Object.assign(headers, responseHeaders);
        }
      },
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      write: (data: string) => { 
        if (typeof data === 'string') {
          try {
            responseData = JSON.parse(data);
          } catch {
            responseData = data;
          }
        } else {
          responseData = data;
        }
      },
      end: (data?: string) => {
        if (data) {
          try {
            responseData = JSON.parse(data);
          } catch {
            responseData = data;
          }
        }
      },
      on: () => {},
      headersSent: false
    };

    const mockReq = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body: requestData,
      query: request.query
    };
    
    await transport.handleRequest(mockReq as any, mockRes as any, requestData);
    
    // Clean up
    transport.close();
    server.close();
    
    logger.info('MCP request completed successfully');
    
    return {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: typeof responseData === 'string' ? responseData : JSON.stringify(responseData)
    };
    
  } catch (error) {
    logger.error("Error handling MCP request", error);
    
    return {
      status: 500,
      jsonBody: {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      }
    };
  }
}

// Register the MCP function
app.http('mcp', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'mcp',
  handler: mcpHandler
});
