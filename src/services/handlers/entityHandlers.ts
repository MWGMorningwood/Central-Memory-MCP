import { InvocationContext } from '@azure/functions';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import { Logger } from '../logger.js';
import { getWorkspaceId, getUserId } from '../utils/mcpUtils.js';

// Create Entities MCP Tool
export async function createEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const userId = getUserId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    entities?: string;
  };

  if (!mcptoolargs?.entities) {
    return JSON.stringify({ error: "No entities provided" });
  }

  try {
    const entities = JSON.parse(mcptoolargs.entities);
    
    if (!Array.isArray(entities)) {
      return JSON.stringify({ error: "Entities must be an array" });
    }

    // Add user context to entities
    const enhancedEntities = entities.map(entity => ({
      ...entity,
      createdBy: entity.createdBy || userId,
    }));

    const createdEntities = await knowledgeGraphManager.createEntities(enhancedEntities);
    return JSON.stringify(createdEntities, null, 2);
  } catch (error) {
    context.error('Failed to create entities', error);
    return JSON.stringify({ error: "Failed to create entities", details: error });
  }
}

// Search Entities MCP Tool
export async function searchEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    name?: string;
    entityType?: string;
  };

  try {
    const results = await knowledgeGraphManager.searchEntities({
      name: mcptoolargs?.name,
      entityType: mcptoolargs?.entityType,
    });
    
    return JSON.stringify(results, null, 2);
  } catch (error) {
    context.error('Failed to search entities', error);
    return JSON.stringify({ error: "Failed to search entities", details: error });
  }
}

// Add Observation MCP Tool
export async function addObservation(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const userId = getUserId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    entityName?: string;
    observation?: string;
  };

  if (!mcptoolargs?.entityName || !mcptoolargs?.observation) {
    return JSON.stringify({ error: "Entity name and observation are required" });
  }

  try {
    const result = await knowledgeGraphManager.addObservation(
      mcptoolargs.entityName,
      mcptoolargs.observation
    );
    return JSON.stringify(result, null, 2);
  } catch (error) {
    context.error('Failed to add observation', error);
    return JSON.stringify({ error: "Failed to add observation", details: error });
  }
}

// Delete Entity MCP Tool
export async function deleteEntity(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    entityName?: string;
  };

  if (!mcptoolargs?.entityName) {
    return JSON.stringify({ error: "Entity name is required" });
  }

  try {
    const result = await knowledgeGraphManager.deleteEntity(mcptoolargs.entityName);
    return JSON.stringify({ success: true, deletedEntity: result }, null, 2);
  } catch (error) {
    context.error('Failed to delete entity', error);
    return JSON.stringify({ error: "Failed to delete entity", details: error });
  }
}

// Update Entity MCP Tool
export async function updateEntity(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const userId = getUserId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    entityName?: string;
    newObservations?: string;
    metadata?: string;
  };

  if (!mcptoolargs?.entityName) {
    return JSON.stringify({ error: "Entity name is required" });
  }

  try {
    const newObservations = mcptoolargs.newObservations ? JSON.parse(mcptoolargs.newObservations) : [];
    const metadata = mcptoolargs.metadata ? JSON.parse(mcptoolargs.metadata) : {};
    
    const result = await knowledgeGraphManager.updateEntity(
      mcptoolargs.entityName,
      newObservations, 
      userId,
      metadata
    );
    return JSON.stringify(result, null, 2);
  } catch (error) {
    context.error('Failed to update entity', error);
    return JSON.stringify({ error: "Failed to update entity", details: error });
  }
}
