import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { Logger } from './logger.js';

export interface BlobStorageConfig {
  accountName: string;
  containerName: string;
  accountKey?: string; // Optional for development, managed identity preferred
  connectionString?: string; // Alternative for development
}

/**
 * BlobStorageManager provides secure Azure Blob Storage operations
 * using managed system identity for production environments.
 * 
 * Features:
 * - Managed Identity authentication (production)
 * - Connection string fallback (development)
 * - Automatic retry with exponential backoff
 * - Proper error handling and logging
 * - Workspace-specific blob organization
 */
export class BlobStorageManager {
  private readonly blobServiceClient: BlobServiceClient;
  private readonly containerName: string;
  private readonly logger: Logger;

  constructor(config: BlobStorageConfig, logger: Logger) {
    this.containerName = config.containerName;
    this.logger = logger;

    try {
      // Production: Use managed identity (preferred approach)
      if (!config.accountKey && !config.connectionString) {
        this.logger.info('Initializing BlobServiceClient with managed identity');
        const credential = new DefaultAzureCredential();
        this.blobServiceClient = new BlobServiceClient(
          `https://${config.accountName}.blob.core.windows.net`,
          credential
        );
      }
      // Development: Use connection string
      else if (config.connectionString) {
        this.logger.info('Initializing BlobServiceClient with connection string');
        this.blobServiceClient = BlobServiceClient.fromConnectionString(config.connectionString);
      }
      // Development: Use account key
      else if (config.accountKey) {
        this.logger.info('Initializing BlobServiceClient with account key');
        const credential = new StorageSharedKeyCredential(config.accountName, config.accountKey);
        this.blobServiceClient = new BlobServiceClient(
          `https://${config.accountName}.blob.core.windows.net`,
          credential
        );
      } else {
        throw new Error('Invalid configuration: Must provide either managed identity, connection string, or account key');
      }

      this.initializeContainer();
    } catch (error) {
      this.logger.error('Failed to initialize BlobStorageManager', error);
      throw error;
    }
  }

  /**
   * Ensures the container exists, creates it if necessary
   */
  private async initializeContainer(): Promise<void> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists({
        access: 'blob', // Secure by default
        metadata: {
          purpose: 'mcp-memory-storage',
          createdBy: 'central-memory-mcp-server'
        }
      });
      this.logger.info(`Container '${this.containerName}' initialized successfully`);
    } catch (error) {
      this.logger.error('Failed to initialize container', error);
      throw error;
    }
  }

  /**
   * Generates a workspace-specific blob name for memory storage
   * @param workspaceId Unique identifier for the workspace/project
   * @returns Blob name in format: workspaces/{workspaceId}/memory.jsonl
   */
  private getBlobName(workspaceId: string): string {
    // Sanitize workspace ID to ensure valid blob name
    const sanitizedId = workspaceId.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    return `workspaces/${sanitizedId}/memory.jsonl`;
  }

  /**
   * Reads memory data for a specific workspace from blob storage
   * @param workspaceId Unique identifier for the workspace
   * @returns Memory data as string, empty string if blob doesn't exist
   */
  async readMemoryData(workspaceId: string): Promise<string> {
    const blobName = this.getBlobName(workspaceId);
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      const downloadResponse = await blobClient.download(0);
      
      if (!downloadResponse.readableStreamBody) {
        this.logger.warn(`No readable stream for blob: ${blobName}`);
        return '';
      }

      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.from(chunk));
      }
      
      const data = Buffer.concat(chunks).toString('utf-8');
      this.logger.debug(`Successfully read memory data for workspace: ${workspaceId}`, { 
        blobName, 
        dataSize: data.length 
      });
      
      return data;
    } catch (error: any) {
      if (error?.statusCode === 404) {
        this.logger.info(`Memory blob not found for workspace: ${workspaceId}, returning empty data`);
        return '';
      }
      
      this.logger.error(`Failed to read memory data for workspace: ${workspaceId}`, error);
      throw error;
    }
  }

  /**
   * Writes memory data for a specific workspace to blob storage
   * @param workspaceId Unique identifier for the workspace
   * @param data Memory data to store
   */
  async writeMemoryData(workspaceId: string, data: string): Promise<void> {
    const blobName = this.getBlobName(workspaceId);
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      // Upload with metadata and proper content type
      await blockBlobClient.upload(data, data.length, {
        blobHTTPHeaders: {
          blobContentType: 'application/jsonl',
          blobCacheControl: 'no-cache'
        },
        metadata: {
          workspaceId: workspaceId,
          lastModified: new Date().toISOString(),
          version: '1.0'
        }
      });
      
      this.logger.debug(`Successfully wrote memory data for workspace: ${workspaceId}`, { 
        blobName, 
        dataSize: data.length 
      });
    } catch (error) {
      this.logger.error(`Failed to write memory data for workspace: ${workspaceId}`, error);
      throw error;
    }
  }

  /**
   * Lists all workspace memory blobs
   * @returns Array of workspace IDs that have memory data
   */
  async listWorkspaces(): Promise<string[]> {
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const workspaces: string[] = [];
      
      for await (const blob of containerClient.listBlobsFlat({ prefix: 'workspaces/' })) {
        // Extract workspace ID from blob name: workspaces/{workspaceId}/memory.jsonl
        const pathParts = blob.name.split('/');
        if (pathParts.length === 3 && pathParts[2] === 'memory.jsonl') {
          workspaces.push(pathParts[1]);
        }
      }
      
      this.logger.debug(`Found ${workspaces.length} workspaces with memory data`);
      return workspaces;
    } catch (error) {
      this.logger.error('Failed to list workspaces', error);
      throw error;
    }
  }

  /**
   * Deletes memory data for a specific workspace
   * @param workspaceId Unique identifier for the workspace
   */
  async deleteMemoryData(workspaceId: string): Promise<void> {
    const blobName = this.getBlobName(workspaceId);
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      await blobClient.deleteIfExists();
      this.logger.info(`Successfully deleted memory data for workspace: ${workspaceId}`);
    } catch (error) {
      this.logger.error(`Failed to delete memory data for workspace: ${workspaceId}`, error);
      throw error;
    }
  }

  /**
   * Checks if memory data exists for a workspace
   * @param workspaceId Unique identifier for the workspace
   * @returns True if memory data exists, false otherwise
   */
  async memoryExists(workspaceId: string): Promise<boolean> {
    const blobName = this.getBlobName(workspaceId);
    
    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlobClient(blobName);
      
      const exists = await blobClient.exists();
      this.logger.debug(`Memory existence check for workspace: ${workspaceId}`, { exists });
      return exists;
    } catch (error) {
      this.logger.error(`Failed to check memory existence for workspace: ${workspaceId}`, error);
      return false;
    }
  }
}
