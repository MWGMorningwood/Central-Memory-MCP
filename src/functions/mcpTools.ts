import { app } from '@azure/functions';

// Import handlers
import { createEntities, searchEntities, addObservation, deleteEntity, updateEntity } from '../services/handlers/entityHandlers.js';
import { createRelations, searchRelations, searchRelationsByUser } from '../services/handlers/relationHandlers.js';
import { getTemporalEvents, detectDuplicateEntities, mergeEntities, executeBatchOperations, getUserStats } from '../services/handlers/advancedHandlers.js';
import { readGraph, getStats, clearMemory } from '../services/handlers/utilityHandlers.js';

// DRY: Import standardized property definitions
import { McpToolProperties } from '../services/utils/mcpToolProperties.js';

// =============================================================================
// MCP TOOL REGISTRATIONS
// =============================================================================
app.mcpTool('createEntities', {
  toolName: 'create_entities',
  description: 'Create multiple new entities in the centralized knowledge graph for a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.ENTITIES_JSON,
  ],
  handler: createEntities,
});

app.mcpTool('createRelations', {
  toolName: 'create_relations',
  description: 'Create multiple new relations between entities in the knowledge graph for a specific workspace. Supports enhanced features like strength scoring and user attribution.',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.RELATIONS_JSON,
  ],
  handler: createRelations,
});

app.mcpTool('readGraph', {
  toolName: 'read_graph',
  description: 'Read the entire centralized knowledge graph for a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
  ],
  handler: readGraph,
});

app.mcpTool('searchEntities', {
  toolName: 'search_entities',
  description: 'Search for entities by name or type in a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.NAME,
    McpToolProperties.ENTITY_TYPE,
  ],
  handler: searchEntities,
});

app.mcpTool('searchRelations', {
  toolName: 'search_relations',
  description: 'Search for relations by entity names or type in a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.FROM,
    McpToolProperties.TO,
    McpToolProperties.RELATION_TYPE,
  ],
  handler: searchRelations,
});

app.mcpTool('addObservation', {
  toolName: 'add_observation',
  description: 'Add a new observation to an existing entity in a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.ENTITY_NAME,
    McpToolProperties.OBSERVATION,
  ],
  handler: addObservation,
});

app.mcpTool('deleteEntity', {
  toolName: 'delete_entity',
  description: 'Delete an entity and all its relations from a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.ENTITY_NAME,
  ],
  handler: deleteEntity,
});

app.mcpTool('getStats', {
  toolName: 'get_stats',
  description: 'Get statistics about the centralized knowledge graph for a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
  ],
  handler: getStats,
});

app.mcpTool('clearMemory', {
  toolName: 'clear_memory',
  description: 'Clear all memory data for a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
  ],
  handler: clearMemory,
});

app.mcpTool('updateEntity', {
  toolName: 'update_entity',
  description: 'Update an existing entity with new observations or metadata',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.ENTITY_NAME,
    McpToolProperties.NEW_OBSERVATIONS,
    McpToolProperties.METADATA,
  ],
  handler: updateEntity,
});

app.mcpTool('searchRelationsByUser', {
  toolName: 'search_relations_by_user',
  description: 'Search for relations created by a specific user in a specific workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.USER_ID,
    McpToolProperties.RELATION_TYPE,
  ],
  handler: searchRelationsByUser,
});

app.mcpTool('getUserStats', {
  toolName: 'get_user_stats',
  description: 'Get statistics about the memory usage and entity/relationship counts for a specific user in a workspace',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.USER_ID,
  ],
  handler: getUserStats,
});

// Phase 2 & Missing Features - Advanced Tools
app.mcpTool('getTemporalEvents', {
  toolName: 'get_temporal_events',
  description: 'Get temporal events - find what happened when in the memory system',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.START_TIME,
    McpToolProperties.END_TIME,
    McpToolProperties.ENTITY_NAME,
    McpToolProperties.RELATION_TYPE,
  ],
  handler: getTemporalEvents,
});

app.mcpTool('detectDuplicateEntities', {
  toolName: 'detect_duplicate_entities',
  description: 'Detect and identify potential duplicate entities in the knowledge graph',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.THRESHOLD,
  ],
  handler: detectDuplicateEntities,
});

app.mcpTool('mergeEntities', {
  toolName: 'merge_entities',
  description: 'Merge duplicate entities into a single target entity',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.TARGET_ENTITY_NAME,
    McpToolProperties.SOURCE_ENTITY_NAMES,
    McpToolProperties.MERGE_STRATEGY,
  ],
  handler: mergeEntities,
});

app.mcpTool('executeBatchOperations', {
  toolName: 'execute_batch_operations',
  description: 'Execute multiple operations in a single batch for performance',
  toolProperties: [
    McpToolProperties.WORKSPACE_ID,
    McpToolProperties.OPERATIONS,
  ],
  handler: executeBatchOperations,
});
