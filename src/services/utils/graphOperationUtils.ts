import { KnowledgeGraph } from '../../types/index.js';
import { PersistenceService } from '../persistenceService.js';

/**
 * DRY utility for common graph operations
 * Eliminates repetitive load/save patterns across all handlers
 */
export class GraphOperationUtils {
  /**
   * Execute a graph operation with automatic load/save
   * @param persistenceService - Service for loading/saving graphs
   * @param operation - Function that takes a graph and returns result with updatedGraph
   * @param saveCondition - Optional condition to check before saving (e.g., result.newEntities.length > 0)
   */
  static async executeGraphOperation<T>(
    persistenceService: PersistenceService,
    operation: (graph: KnowledgeGraph) => T,
    saveCondition?: (result: T) => boolean
  ): Promise<T> {
    const graph = await persistenceService.loadGraph();
    const result = operation(graph);
    
    // Check if result has updatedGraph and should be saved
    if (
      result && 
      typeof result === 'object' && 
      'updatedGraph' in result &&
      (!saveCondition || saveCondition(result))
    ) {
      await persistenceService.saveGraph((result as any).updatedGraph);
    }
    
    return result;
  }

  /**
   * Execute a read-only graph operation (no save needed)
   */
  static async executeReadOnlyGraphOperation<T>(
    persistenceService: PersistenceService,
    operation: (graph: KnowledgeGraph) => T
  ): Promise<T> {
    const graph = await persistenceService.loadGraph();
    return operation(graph);
  }
}
