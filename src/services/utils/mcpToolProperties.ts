/**
 * DRY utility for common MCP tool properties
 * Eliminates repetitive property definitions across all tools
 */
export class McpToolProperties {
  /**
   * Standard workspaceId property used by all tools
   */
  static readonly WORKSPACE_ID = {
    propertyName: 'workspaceId',
    propertyType: 'string',
    description: 'Unique identifier for the workspace/project (defaults to "default")',
  };

  /**
   * Standard userId property used by user-related tools
   */
  static readonly USER_ID = {
    propertyName: 'userId',
    propertyType: 'string',
    description: 'ID of the user to get statistics for (optional, defaults to current user)',
  };

  /**
   * Standard entityName property used by entity tools
   */
  static readonly ENTITY_NAME = {
    propertyName: 'entityName',
    propertyType: 'string',
    description: 'Name of the entity to update',
  };

  /**
   * Standard entities JSON array property
   */
  static readonly ENTITIES_JSON = {
    propertyName: 'entities',
    propertyType: 'string',
    description: 'JSON string array of entities to create, each with name, entityType, and observations',
  };

  /**
   * Standard relations JSON array property
   */
  static readonly RELATIONS_JSON = {
    propertyName: 'relations',
    propertyType: 'string',
    description: 'JSON string array of relations to create, each with from, to, relationType, and optional strength/createdBy',
  };

  /**
   * Standard threshold property for similarity operations
   */
  static readonly THRESHOLD = {
    propertyName: 'threshold',
    propertyType: 'string',
    description: 'Similarity threshold for duplicate detection (0.0 to 1.0, defaults to 0.8)',
  };

  /**
   * Standard time range properties
   */
  static readonly START_TIME = {
    propertyName: 'startTime',
    propertyType: 'string',
    description: 'Start time for temporal query (ISO 8601 format, optional)',
  };

  static readonly END_TIME = {
    propertyName: 'endTime',
    propertyType: 'string',
    description: 'End time for temporal query (ISO 8601 format, optional)',
  };

  /**
   * Standard search properties
   */
  static readonly NAME = {
    propertyName: 'name',
    propertyType: 'string',
    description: 'Search by entity name (partial match, optional)',
  };

  static readonly ENTITY_TYPE = {
    propertyName: 'entityType',
    propertyType: 'string',
    description: 'Search by entity type (partial match, optional)',
  };

  static readonly RELATION_TYPE = {
    propertyName: 'relationType',
    propertyType: 'string',
    description: 'Filter by relation type (optional)',
  };

  static readonly FROM = {
    propertyName: 'from',
    propertyType: 'string',
    description: 'Source entity name (optional)',
  };

  static readonly TO = {
    propertyName: 'to',
    propertyType: 'string',
    description: 'Target entity name (optional)',
  };

  /**
   * Standard observation property
   */
  static readonly OBSERVATION = {
    propertyName: 'observation',
    propertyType: 'string',
    description: 'Observation content to add',
  };

  /**
   * Standard metadata property
   */
  static readonly METADATA = {
    propertyName: 'metadata',
    propertyType: 'string',
    description: 'JSON string object of metadata fields to update',
  };

  static readonly NEW_OBSERVATIONS = {
    propertyName: 'newObservations',
    propertyType: 'string',
    description: 'JSON string array of new observations to add to the entity',
  };

  /**
   * Standard merge properties
   */
  static readonly TARGET_ENTITY_NAME = {
    propertyName: 'targetEntityName',
    propertyType: 'string',
    description: 'Name of the target entity to merge into',
  };

  static readonly SOURCE_ENTITY_NAMES = {
    propertyName: 'sourceEntityNames',
    propertyType: 'string',
    description: 'JSON array of source entity names to merge from',
  };

  static readonly MERGE_STRATEGY = {
    propertyName: 'mergeStrategy',
    propertyType: 'string',
    description: 'Merge strategy: "combine" or "replace" (defaults to "combine")',
  };

  /**
   * Standard operations property
   */
  static readonly OPERATIONS = {
    propertyName: 'operations',
    propertyType: 'string',
    description: 'JSON array of operations to execute in batch',
  };

  /**
   * Create a property array with common workspace property plus custom ones
   */
  static withWorkspace(...additionalProperties: any[]): any[] {
    return [this.WORKSPACE_ID, ...additionalProperties];
  }

  /**
   * Create a property array with common workspace and user properties plus custom ones
   */
  static withWorkspaceAndUser(...additionalProperties: any[]): any[] {
    return [this.WORKSPACE_ID, this.USER_ID, ...additionalProperties];
  }
}
