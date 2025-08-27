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
  description: 'Create new entities in the knowledge graph. This is typically the first step when adding new information. Use read_graph first to check if entities already exist. Creates or updates entities with observations.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entities',
      propertyType: 'object',
      description: 'Entity object with required fields: name (string), entityType (string), observations (array of strings). Example: {"name": "Alice", "entityType": "Person", "observations": ["Software engineer", "Works on React"]}',
    },
  ],
  handler: createEntities,
});

app.mcpTool('createRelations', {
  toolName: 'create_relations',
  description: 'Create relationships between entities in the knowledge graph. Will automatically create any missing entities referenced in the relationship. Use read_graph first to understand existing entities.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'relations',
      propertyType: 'object',
      description: 'Relation object with required fields: from (string), to (string), relationType (string). Optional: strength (0-1). Example: {"from": "Alice", "to": "React Project", "relationType": "worksOn", "strength": 0.9}',
    },
  ],
  handler: createRelations,
});

app.mcpTool('readGraph', {
  toolName: 'read_graph',
  description: 'RECOMMENDED FIRST STEP: Read the entire knowledge graph to understand existing entities and relationships before making changes. Always use this tool first to avoid duplicates and understand the current state.',
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
  description: 'Search for existing entities by name or type. Use this to check if entities exist before creating new ones or adding relationships.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'name',
      propertyType: 'string',
      description: 'Search by entity name (partial match, case-insensitive, optional)',
    },
    {
      propertyName: 'entityType',
      propertyType: 'string',
      description: 'Search by entity type (partial match, case-insensitive, optional)',
    },
  ],
  handler: searchEntities,
});

app.mcpTool('searchRelations', {
  toolName: 'search_relations',
  description: 'Search for existing relationships between entities. Use this to understand how entities are connected before creating new relationships.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'from',
      propertyType: 'string',
      description: 'Source entity name (partial match, case-insensitive, optional)',
    },
    {
      propertyName: 'to',
      propertyType: 'string',
      description: 'Target entity name (partial match, case-insensitive, optional)',
    },
    {
      propertyName: 'relationType',
      propertyType: 'string',
      description: 'Relation type (partial match, case-insensitive, optional)',
    },
  ],
  handler: searchRelations,
});

app.mcpTool('addObservation', {
  toolName: 'add_observation',
  description: 'Add a new observation to an existing entity. If entity does not exist, will automatically create it with basic information. IMPORTANT: Use read_graph or search_entities first to check if entity exists.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Name of the entity to add observation to (required)',
    },
    {
      propertyName: 'observation',
      propertyType: 'string',
      description: 'Observation content to add (required)',
    },
    {
      propertyName: 'entityType',
      propertyType: 'string',
      description: 'Entity type to use if creating new entity (optional, defaults to "Unknown")',
    },
  ],
  handler: addObservation,
});

app.mcpTool('deleteEntity', {
  toolName: 'delete_entity',
  description: 'Delete an entity and all its relationships from the workspace. Use search_entities or read_graph first to confirm the entity exists.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Name of the entity to delete (required)',
    },
  ],
  handler: deleteEntity,
});

app.mcpTool('getStats', {
  toolName: 'get_stats',
  description: 'Get statistics about the knowledge graph including entity counts, types, and relationships. Useful for understanding the current state of your workspace.',
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
  description: 'CAUTION: Permanently delete all memory data for a workspace. Use get_stats first to understand what will be deleted.',
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
  description: 'Update an existing entity with new observations or metadata. Use this to modify entities found via search_entities or read_graph.',
  toolProperties: [
    {
      propertyName: 'workspaceId',
      propertyType: 'string',
      description: 'Unique identifier for the workspace/project (defaults to "default")',
    },
    {
      propertyName: 'entityName',
      propertyType: 'string',
      description: 'Name of the entity to update (required)',
    },
    {
      propertyName: 'newObservations',
      propertyType: 'object',
      description: 'Single observation string or array of observation strings to add to the entity (optional)',
    },
    {
      propertyName: 'metadata',
      propertyType: 'object',
      description: 'Object containing metadata fields to update (optional)',
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
