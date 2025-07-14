import { InvocationContext } from '@azure/functions';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import { Logger } from '../logger.js';
import { getWorkspaceId, getUserId } from '../utils/mcpUtils.js';

// Create Relations MCP Tool
export async function createRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const userId = getUserId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    relations?: string;
  };

  if (!mcptoolargs?.relations) {
    return JSON.stringify({ error: "No relations provided" });
  }

  try {
    const relations = JSON.parse(mcptoolargs.relations);
    
    if (!Array.isArray(relations)) {
      return JSON.stringify({ error: "Relations must be an array" });
    }

    // Add user context to relations that don't already have it
    const enhancedRelations = relations.map(rel => ({
      ...rel,
      createdBy: rel.createdBy || userId,
      strength: rel.strength !== undefined ? rel.strength : (rel.strength === 0 ? 0 : 0.8), // Default strength 0.8 unless explicitly set
    }));

    const createdRelations = await knowledgeGraphManager.createRelations(enhancedRelations);
    return JSON.stringify(createdRelations, null, 2);
  } catch (error) {
    context.error('Failed to create relations', error);
    return JSON.stringify({ error: "Failed to create relations", details: error });
  }
}

// Search Relations MCP Tool
export async function searchRelations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    from?: string;
    to?: string;
    relationType?: string;
  };

  try {
    const results = await knowledgeGraphManager.searchRelations({
      from: mcptoolargs?.from,
      to: mcptoolargs?.to,
      relationType: mcptoolargs?.relationType,
    });
    
    return JSON.stringify(results, null, 2);
  } catch (error) {
    context.error('Failed to search relations', error);
    return JSON.stringify({ error: "Failed to search relations", details: error });
  }
}

// Search Relations by User MCP Tool
export async function searchRelationsByUser(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    userId?: string;
    relationType?: string;
  };

  try {
    const results = await knowledgeGraphManager.searchRelationsByUser({
      userId: mcptoolargs?.userId,
      relationType: mcptoolargs?.relationType,
    });
    
    return JSON.stringify(results, null, 2);
  } catch (error) {
    context.error('Failed to search relations by user', error);
    return JSON.stringify({ error: "Failed to search relations by user", details: error });
  }
}
