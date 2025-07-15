/**
 * Batch operation types for bulk operations
 */

export interface BatchOperation {
  type: 'create_entity' | 'create_relation' | 'update_entity' | 'delete_entity';
  data: any;
  userId?: string;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: string[];
  results: any[];
}
