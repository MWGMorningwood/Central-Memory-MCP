import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PersistenceService } from '../services/persistenceService.js';
import { Logger } from '../services/logger.js';
import { StatsUtils } from '../services/utils/index.js';

// Environment configuration
const MEMORY_FILE_PATH = process.env.MEMORY_FILE_PATH || '/tmp/memory.json';

export async function healthHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const logger = new Logger(context);
  
  try {
    // DRY: Use PersistenceService and StatsUtils directly instead of knowledgeGraphManager
    const persistenceService = await PersistenceService.createForWorkspace('default', logger);
    const graph = await persistenceService.loadGraph();
    const stats = StatsUtils.generateStats(graph, persistenceService.getWorkspaceId());
    
    return {
      status: 200,
      jsonBody: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        stats,
        environment: process.env.NODE_ENV || 'development'
      }
    };
  } catch (error) {
    logger.error('Health check failed', error);
    
    return {
      status: 500,
      jsonBody: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }
    };
  }
}

// Register the health function
app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler
});
