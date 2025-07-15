# API Reference

## Overview

The Central Memory MCP Server provides 16 MCP tools for knowledge graph operations. All tools are prefixed with `#memory-test` in VS Code.

## Entity Operations

### create_entities

Creates one or more entities in the knowledge graph.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `entities` (string): JSON array of entities to create

**Entity Structure:**

```json
{
  "name": "EntityName",
  "entityType": "Person|Project|Concept",
  "observations": ["observation1", "observation2"],
  "metadata": {} // optional
}
```

**Example:**

```json
{
  "entities": "[{\"name\":\"Alice\",\"entityType\":\"Person\",\"observations\":[\"Software engineer\",\"Loves React\"]}]",
  "workspaceId": "my-project"
}
```

### add_observation

Adds a new observation to an existing entity.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `entityName` (string): Name of the entity to update
- `observation` (string): New observation to add

### update_entity

Updates entity metadata and observations.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `entityName` (string): Name of entity to update
- `newObservations` (string): JSON array of new observations to add
- `metadata` (string): JSON object of metadata to update

### delete_entity

Removes an entity and all its relations.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `entityName` (string): Name of entity to delete

### search_entities

Searches entities by name or type.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `name` (string): Partial name match (optional)
- `entityType` (string): Partial type match (optional)

## Relation Operations

### create_relations

Creates relationships between entities.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `relations` (string): JSON array of relations to create

**Relation Structure:**

```json
{
  "from": "EntityA",
  "to": "EntityB",
  "relationType": "worksOn|collaboratesWith|manages",
  "strength": 0.8, // optional, default 0.8
  "metadata": {} // optional
}
```

### search_relations

Searches relations by entities or type.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `from` (string): Source entity name (optional)
- `to` (string): Target entity name (optional)
- `relationType` (string): Relation type filter (optional)

### search_relations_by_user

Searches relations created by a specific user.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `userId` (string): User ID filter (optional)
- `relationType` (string): Relation type filter (optional)

## Graph Operations

### read_graph

Retrieves the complete knowledge graph.

**Parameters:**

- `workspaceId` (string): Workspace identifier

**Response:**

```json
{
  "entities": [/* array of entities */],
  "relations": [/* array of relations */]
}
```

### clear_memory

Clears all data for a workspace.

**Parameters:**

- `workspaceId` (string): Workspace identifier

## Statistics Operations

### get_stats

Gets comprehensive workspace statistics.

**Parameters:**

- `workspaceId` (string): Workspace identifier

**Response:**

```json
{
  "totalEntities": 5,
  "totalRelations": 3,
  "entityTypes": {"Person": 3, "Project": 2},
  "relationTypes": {"worksOn": 2, "manages": 1},
  "averageObservationsPerEntity": 2.4,
  "workspaceId": "my-project"
}
```

### get_user_stats

Gets statistics for a specific user.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `userId` (string): User ID (optional, defaults to current user)

## Temporal Operations

### get_temporal_events

Retrieves time-based activity tracking.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `startTime` (string): Start time (ISO 8601 format)
- `endTime` (string): End time (ISO 8601 format)
- `entityName` (string): Entity filter (optional)
- `relationType` (string): Relation type filter (optional)

**Response:**

```json
{
  "entities": [/* entities with actionType: 'created'|'updated' */],
  "relations": [/* relations with actionType: 'created'|'updated' */],
  "timeRange": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-02T00:00:00.000Z"
  }
}
```

## Advanced Operations

### detect_duplicate_entities

Finds potential duplicate entities based on similarity.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `threshold` (string): Similarity threshold (0.0-1.0, default 0.8)

### merge_entities

Merges duplicate entities into a single target entity.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `targetEntityName` (string): Target entity to merge into
- `sourceEntityNames` (string): JSON array of source entities to merge
- `mergeStrategy` (string): "combine" or "replace" (default "combine")

### execute_batch_operations

Executes multiple operations in a single request.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `operations` (string): JSON array of operations to execute

**Operation Structure:**

```json
{
  "type": "create_entity|create_relation|delete_entity",
  "data": {/* operation-specific data */}
}
```

## Error Handling

All tools return structured error responses:

```json
{
  "error": "ValidationError",
  "message": "Entity name is required and must be a string",
  "details": {
    "field": "name",
    "value": null
  }
}
```

## Common Error Types

- **ValidationError**: Invalid input data
- **NotFoundError**: Entity or relation not found
- **ConflictError**: Duplicate entity creation
- **StorageError**: Azure Table Storage issues
- **NetworkError**: Connection problems

## Rate Limits

No explicit rate limits, but Azure Functions has natural throttling:

- **Concurrent Executions**: 200 per function app
- **Request Duration**: 5 minutes maximum
- **Memory**: 1.5GB per function

## Authentication

- **Development**: No authentication required
- **Production**: Managed Identity with Azure AD
- **Workspace Isolation**: Automatic based on workspace ID
