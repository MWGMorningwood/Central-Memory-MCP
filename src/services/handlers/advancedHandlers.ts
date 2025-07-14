import { InvocationContext } from '@azure/functions';
import { KnowledgeGraphManager } from '../knowledgeGraphManager.js';
import { Logger } from '../logger.js';
import { getWorkspaceId, getUserId } from '../utils/mcpUtils.js';

// Get Temporal Events MCP Tool
export async function getTemporalEvents(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    startTime?: string;
    endTime?: string;
    entityName?: string;
    relationType?: string;
  };

  try {
    const events = await knowledgeGraphManager.getTemporalEvents({
      startTime: mcptoolargs?.startTime,
      endTime: mcptoolargs?.endTime,
      entityName: mcptoolargs?.entityName,
      relationType: mcptoolargs?.relationType,
    });
    
    return JSON.stringify(events, null, 2);
  } catch (error) {
    context.error('Failed to get temporal events', error);
    return JSON.stringify({ error: "Failed to get temporal events", details: error });
  }
}

// Detect Duplicate Entities MCP Tool
export async function detectDuplicateEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    threshold?: string;
  };

  try {
    const threshold = mcptoolargs?.threshold ? parseFloat(mcptoolargs.threshold) : 0.8;
    const duplicates = await knowledgeGraphManager.detectDuplicateEntities(threshold);
    
    return JSON.stringify(duplicates, null, 2);
  } catch (error) {
    context.error('Failed to detect duplicate entities', error);
    return JSON.stringify({ error: "Failed to detect duplicate entities", details: error });
  }
}

// Merge Entities MCP Tool
export async function mergeEntities(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const userId = getUserId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    targetEntityName?: string;
    sourceEntityNames?: string;
    mergeStrategy?: string;
  };

  if (!mcptoolargs?.targetEntityName || !mcptoolargs?.sourceEntityNames) {
    return JSON.stringify({ error: "Target entity name and source entity names are required" });
  }

  try {
    const sourceEntityNames = JSON.parse(mcptoolargs.sourceEntityNames);
    const mergeStrategy = mcptoolargs.mergeStrategy || 'combine';
    
    const result = await knowledgeGraphManager.mergeEntities(
      mcptoolargs.targetEntityName,
      sourceEntityNames,
      mergeStrategy as 'combine' | 'replace',
      userId
    );
    
    return JSON.stringify(result, null, 2);
  } catch (error) {
    context.error('Failed to merge entities', error);
    return JSON.stringify({ error: "Failed to merge entities", details: error });
  }
}

// Execute Batch Operations MCP Tool
export async function executeBatchOperations(_toolArguments: unknown, context: InvocationContext): Promise<string> {
  const workspaceId = getWorkspaceId(context);
  const userId = getUserId(context);
  const logger = new Logger(context);
  const knowledgeGraphManager = await KnowledgeGraphManager.createForWorkspace(workspaceId, logger);
  
  const mcptoolargs = context.triggerMetadata?.mcptoolargs as {
    operations?: string;
  };

  if (!mcptoolargs?.operations) {
    return JSON.stringify({ error: "No operations provided" });
  }

  try {
    const operations = JSON.parse(mcptoolargs.operations);
    
    if (!Array.isArray(operations)) {
      return JSON.stringify({ error: "Operations must be an array" });
    }

    const results = await knowledgeGraphManager.executeBatchOperations(operations);
    return JSON.stringify(results, null, 2);
  } catch (error) {
    context.error('Failed to execute batch operations', error);
    return JSON.stringify({ error: "Failed to execute batch operations", details: error });
  }
}
