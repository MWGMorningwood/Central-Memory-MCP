import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Entity, Relation } from '../types/index.js';
import { KnowledgeGraphManager } from './knowledgeGraphManager.js';
import { Logger } from './logger.js';

export class McpServerService {
  private server: McpServer;
  private knowledgeGraphManager: KnowledgeGraphManager;
  private logger: Logger;

  constructor(knowledgeGraphManager: KnowledgeGraphManager, logger: Logger) {
    this.knowledgeGraphManager = knowledgeGraphManager;
    this.logger = logger;
    this.server = new McpServer({
      name: "central-memory-server",
      version: "1.0.0",
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupTools();
  }

  private setupTools(): void {
    // Create entities tool
    this.server.tool(
      "create_entities",
      "Create multiple new entities in the centralized knowledge graph",
      {
        entities: z.array(z.object({
          name: z.string().describe("The unique name of the entity"),
          entityType: z.string().describe("The type of the entity"),
          observations: z.array(z.string()).describe("An array of observation contents associated with the entity")
        }))
      },
      async ({ entities }) => {
        try {
          const createdEntities = await this.knowledgeGraphManager.createEntities(
            entities as Omit<Entity, 'createdAt' | 'updatedAt'>[]
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(createdEntities, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error creating entities', error);
          throw error;
        }
      }
    );

    // Create relations tool
    this.server.tool(
      "create_relations",
      "Create multiple new relations between entities in the knowledge graph",
      {
        relations: z.array(z.object({
          from: z.string().describe("The name of the source entity"),
          to: z.string().describe("The name of the target entity"),
          relationType: z.string().describe("The type of the relation in active voice")
        }))
      },
      async ({ relations }) => {
        try {
          const createdRelations = await this.knowledgeGraphManager.createRelations(
            relations as Omit<Relation, 'createdAt'>[]
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(createdRelations, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error creating relations', error);
          throw error;
        }
      }
    );

    // Add observations tool
    this.server.tool(
      "add_observations",
      "Add new observations to existing entities in the knowledge graph",
      {
        observations: z.array(z.object({
          entityName: z.string().describe("The name of the entity to add observations to"),
          contents: z.array(z.string()).describe("An array of observation contents to add")
        }))
      },
      async ({ observations }) => {
        try {
          const observationResults = await this.knowledgeGraphManager.addObservations(
            observations as { entityName: string; contents: string[] }[]
          );
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(observationResults, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error adding observations', error);
          throw error;
        }
      }
    );

    // Delete entities tool
    this.server.tool(
      "delete_entities",
      "Delete multiple entities and their associated relations from the knowledge graph",
      {
        entityNames: z.array(z.string()).describe("An array of entity names to delete")
      },
      async ({ entityNames }) => {
        try {
          await this.knowledgeGraphManager.deleteEntities(entityNames);
          return {
            content: [{
              type: "text" as const,
              text: "Entities deleted successfully"
            }]
          };
        } catch (error) {
          this.logger.error('Error deleting entities', error);
          throw error;
        }
      }
    );

    // Delete observations tool
    this.server.tool(
      "delete_observations",
      "Delete specific observations from entities in the knowledge graph",
      {
        deletions: z.array(z.object({
          entityName: z.string().describe("The name of the entity containing the observations"),
          observations: z.array(z.string()).describe("An array of observations to delete")
        }))
      },
      async ({ deletions }) => {
        try {
          await this.knowledgeGraphManager.deleteObservations(
            deletions as { entityName: string; observations: string[] }[]
          );
          return {
            content: [{
              type: "text" as const,
              text: "Observations deleted successfully"
            }]
          };
        } catch (error) {
          this.logger.error('Error deleting observations', error);
          throw error;
        }
      }
    );

    // Delete relations tool
    this.server.tool(
      "delete_relations",
      "Delete multiple relations from the knowledge graph",
      {
        relations: z.array(z.object({
          from: z.string().describe("The name of the source entity"),
          to: z.string().describe("The name of the target entity"),
          relationType: z.string().describe("The type of the relation")
        }))
      },
      async ({ relations }) => {
        try {
          await this.knowledgeGraphManager.deleteRelations(
            relations as Omit<Relation, 'createdAt'>[]
          );
          return {
            content: [{
              type: "text" as const,
              text: "Relations deleted successfully"
            }]
          };
        } catch (error) {
          this.logger.error('Error deleting relations', error);
          throw error;
        }
      }
    );

    // Read graph tool
    this.server.tool(
      "read_graph",
      "Read the entire centralized knowledge graph",
      {},
      async () => {
        try {
          const fullGraph = await this.knowledgeGraphManager.readGraph();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(fullGraph, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error reading graph', error);
          throw error;
        }
      }
    );

    // Search nodes tool
    this.server.tool(
      "search_nodes",
      "Search for nodes in the knowledge graph based on a query",
      {
        query: z.string().describe("The search query to match against entity names, types, and observation content")
      },
      async ({ query }) => {
        try {
          const searchResults = await this.knowledgeGraphManager.searchNodes(query);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(searchResults, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error searching nodes', error);
          throw error;
        }
      }
    );

    // Open nodes tool
    this.server.tool(
      "open_nodes",
      "Open specific nodes in the knowledge graph by their names",
      {
        names: z.array(z.string()).describe("An array of entity names to retrieve")
      },
      async ({ names }) => {
        try {
          const nodeResults = await this.knowledgeGraphManager.openNodes(names);
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(nodeResults, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error opening nodes', error);
          throw error;
        }
      }
    );

    // Get stats tool
    this.server.tool(
      "get_stats",
      "Get statistics about the centralized knowledge graph",
      {},
      async () => {
        try {
          const stats = await this.knowledgeGraphManager.getStats();
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(stats, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error('Error getting stats', error);
          throw error;
        }
      }
    );
  }

  getServer(): McpServer {
    return this.server;
  }
}
