/**
 * Storage and infrastructure types
 */

export interface StorageConfig {
  accountName: string;
  connectionString?: string;
}

export interface SearchQuery {
  name?: string;
  entityType?: string;
  from?: string;
  to?: string;
  relationType?: string;
}
