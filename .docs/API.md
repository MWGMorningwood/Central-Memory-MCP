# API Reference

## Overview

The Central Memory MCP Server provides 16 MCP tools for knowledge graph operations. All tools are prefixed with `#memory-test` in VS Code.

## Entity Operations

### create_entities

Creates a single entity in the knowledge graph.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `entities` (object): Single entity object to create

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
  "workspaceId": "my-project",
  "entities": {
    "name": "Alice",
    "entityType": "Person",
    "observations": ["Software engineer", "Loves React"]
  }
}
```
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
- `newObservations` (object): Single observation object to add
- `metadata` (object): Metadata object to update

**Example:**

```json
{
  "workspaceId": "my-project",
  "entityName": "Alice",
  "newObservations": {
    "content": "Promoted to senior engineer",
    "timestamp": "2024-01-15T10:00:00Z"
  },
  "metadata": {
    "department": "Engineering"
  }
}
```

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

Creates a single relationship between entities.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `relations` (object): Single relation object to create

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

**Example:**

```json
{
  "workspaceId": "my-project",
  "relations": {
    "from": "Alice",
    "to": "React Project",
    "relationType": "worksOn",
    "strength": 0.9
  }
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
- `sourceEntityNames` (object): Object containing array of source entities to merge
- `mergeStrategy` (string): "combine" or "replace" (default "combine")

**Example:**

```json
{
  "workspaceId": "my-project",
  "targetEntityName": "Alice",
  "sourceEntityNames": ["Alice Smith", "A. Smith"],
  "mergeStrategy": "combine"
}
```

### execute_batch_operations

Executes multiple operations in a single request.

**Parameters:**

- `workspaceId` (string): Workspace identifier
- `operations` (object): Object containing array of operations to execute

**Operation Structure:**

```json
{
  "type": "create_entity|create_relation|delete_entity",
  "data": {/* operation-specific data */}
}
```

**Example:**

```json
{
  "workspaceId": "my-project",
  "operations": [
    {
      "type": "create_entity",
      "data": {
        "name": "New Entity",
        "entityType": "Concept",
        "observations": ["Initial observation"]
      }
    },
    {
      "type": "create_relation",
      "data": {
        "from": "Alice",
        "to": "New Entity",
        "relationType": "created"
      }
    }
  ]
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
