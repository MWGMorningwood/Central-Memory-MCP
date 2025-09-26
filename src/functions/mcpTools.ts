import { app } from '@azure/functions';

// Import handlers from consolidated domain files
import { createEntities, searchEntities, addObservation, deleteEntity, updateEntity } from '../services/entities.js';
import { createRelations, searchRelations } from '../services/relations.js';
import { readGraph, getStats, clearMemory } from '../services/stats.js';

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

