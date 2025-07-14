import { InvocationContext } from '@azure/functions';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import { Logger } from '../logger.js';
import { getWorkspaceId, getUserId } from '../utils/mcpUtils.js';

// Read Graph MCP Tool
export async function readGraph(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  try {
    const graph = await knowledgeGraphManager.readGraph();
    return JSON.stringify(graph, null, 2);
  } catch (error) {
    context.error('Failed to read graph', error);
    return JSON.stringify({ error: "Failed to read graph", details: error });
  }
}

// Get Stats MCP Tool
export async function getStats(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  try {
    const stats = await knowledgeGraphManager.getStats();
    return JSON.stringify(stats, null, 2);
  } catch (error) {
    context.error('Failed to get stats', error);
    return JSON.stringify({ error: "Failed to get stats", details: error });
  }
}

// Clear Memory MCP Tool
export async function clearMemory(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  try {
    await knowledgeGraphManager.clearMemory();
    return JSON.stringify({ success: true, message: "Memory cleared successfully" }, null, 2);
  } catch (error) {
    context.error('Failed to clear memory', error);
    return JSON.stringify({ error: "Failed to clear memory", details: error });
  }
}

// Get User Stats MCP Tool
export async function getUserStats(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    userId?: string;
  };

  try {
    const userId = mcptoolargs?.userId || getUserId(context);
    const stats = await knowledgeGraphManager.getUserStats(userId);
    return JSON.stringify(stats, null, 2);
  } catch (error) {
    context.error('Failed to get user stats', error);
    return JSON.stringify({ error: "Failed to get user stats", details: error });
  }
}
