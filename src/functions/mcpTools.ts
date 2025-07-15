import { app } from '@azure/functions';

// Import handlers from consolidated domain files
import { createEntities, searchEntities, addObservation, deleteEntity, updateEntity } from '../services/entities.js';
import { createRelations, searchRelations, searchRelationsByUser } from '../services/relations.js';
import { getTemporalEvents, detectDuplicateEntities, mergeEntities, executeBatchOperations, getUserStats, readGraph, getStats, clearMemory } from '../services/stats.js';

// Consolidated file structure - all tools use inline property definitions

// =============================================================================
// MCP TOOL REGISTRATIONS
// =============================================================================
app.mcpTool('createEntities', {
  toolName: 'create_entities',
  description: 'Create a new entity in the centralized knowledge graph for a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entities',
      propertyType: 'object',
      description: 'Single entity object to create with name, entityType, and observations',
    },
  ],
  handler: createEntities,
});

app.mcpTool('createRelations', {
  toolName: 'create_relations',
  description: 'Create a new relation between entities in the knowledge graph for a specific workspace. Supports enhanced features like strength scoring and user attribution.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'relations',
      propertyType: 'object',
      description: 'Single relation object to create with from, to, relationType, and optional strength/createdBy',
    },
  ],
  handler: createRelations,
});

app.mcpTool('readGraph', {
  toolName: 'read_graph',
  description: 'Read the entire centralized knowledge graph for a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
  ],
  handler: readGraph,
});

app.mcpTool('searchEntities', {
  toolName: 'search_entities',
  description: 'Search for entities by name or type in a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'name',
      propertyType: 'string',
      description: 'Search by entity name (partial match, optional)',
    },
    {
      propertyName: 'entityType',
      propertyType: 'string',
      description: 'Search by entity type (partial match, optional)',
    },
  ],
  handler: searchEntities,
});

app.mcpTool('searchRelations', {
  toolName: 'search_relations',
  description: 'Search for relations by entity names or type in a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'from',
      propertyType: 'string',
      description: 'Source entity name (optional)',
    },
    {
      propertyName: 'to',
      propertyType: 'string',
      description: 'Target entity name (optional)',
    },
    {
      propertyName: 'relationType',
      propertyType: 'string',
      description: 'Relation type (partial match, optional)',
    },
  ],
  handler: searchRelations,
});

app.mcpTool('addObservation', {
  toolName: 'add_observation',
  description: 'Add a new observation to an existing entity in a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Name of the entity to add observation to',
    },
    {
      propertyName: 'observation',
      propertyType: 'string',
      description: 'Observation content to add',
    },
  ],
  handler: addObservation,
});

app.mcpTool('deleteEntity', {
  toolName: 'delete_entity',
  description: 'Delete an entity and all its relations from a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Name of the entity to delete',
    },
  ],
  handler: deleteEntity,
});

app.mcpTool('getStats', {
  toolName: 'get_stats',
  description: 'Get statistics about the centralized knowledge graph for a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
  ],
  handler: getStats,
});

app.mcpTool('clearMemory', {
  toolName: 'clear_memory',
  description: 'Clear all memory data for a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
  ],
  handler: clearMemory,
});

app.mcpTool('updateEntity', {
  toolName: 'update_entity',
  description: 'Update an existing entity with new observations or metadata',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Name of the entity to update',
    },
    {
      propertyName: 'newObservations',
      propertyType: 'object',
      description: 'Single observation object to add to the entity',
    },
    {
      propertyName: 'metadata',
      propertyType: 'object',
      description: 'Object containing metadata fields to update',
    },
  ],
  handler: updateEntity,
});

app.mcpTool('searchRelationsByUser', {
  toolName: 'search_relations_by_user',
  description: 'Search for relations created by a specific user in a specific workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'userId',
      propertyType: 'string',
      description: 'ID of the user who created the relations (optional)',
    },
    {
      propertyName: 'relationType',
      propertyType: 'string',
      description: 'Relation type (partial match, optional)',
    },
  ],
  handler: searchRelationsByUser,
});

app.mcpTool('getUserStats', {
  toolName: 'get_user_stats',
  description: 'Get statistics about the memory usage and entity/relationship counts for a specific user in a workspace',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'userId',
      propertyType: 'string',
      description: 'ID of the user to get statistics for (optional, defaults to current user)',
    },
  ],
  handler: getUserStats,
});

// Phase 2 & Missing Features - Advanced Tools
app.mcpTool('getTemporalEvents', {
  toolName: 'get_temporal_events',
  description: 'Get temporal events - find what happened when in the memory system',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'startTime',
      propertyType: 'string',
      description: 'Start time for temporal query (ISO 8601 format, optional)',
    },
    {
      propertyName: 'endTime',
      propertyType: 'string',
      description: 'End time for temporal query (ISO 8601 format, optional)',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Filter by entity name (optional)',
    },
    {
      propertyName: 'relationType',
      propertyType: 'string',
      description: 'Filter by relation type (optional)',
    },
  ],
  handler: getTemporalEvents,
});

app.mcpTool('detectDuplicateEntities', {
  toolName: 'detect_duplicate_entities',
  description: 'Detect and identify potential duplicate entities in the knowledge graph',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'threshold',
      propertyType: 'string',
      description: 'Similarity threshold for duplicate detection (0.0 to 1.0, defaults to 0.8)',
    },
  ],
  handler: detectDuplicateEntities,
});

app.mcpTool('mergeEntities', {
  toolName: 'merge_entities',
  description: 'Merge duplicate entities into a single target entity',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'targetEntityName',
      propertyType: 'string',
      description: 'Name of the target entity to merge into',
    },
    {
      propertyName: 'sourceEntityNames',
      propertyType: 'object',
      description: 'Object containing array of source entity names to merge from',
    },
    {
      propertyName: 'mergeStrategy',
      propertyType: 'string',
      description: 'Merge strategy: "combine" or "replace" (defaults to "combine")',
    },
  ],
  handler: mergeEntities,
});

app.mcpTool('executeBatchOperations', {
  toolName: 'execute_batch_operations',
  description: 'Execute multiple operations in a single batch for performance',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'operations',
      propertyType: 'object',
      description: 'Object containing array of operation objects to execute in batch',
    },
  ],
  handler: executeBatchOperations,
});
