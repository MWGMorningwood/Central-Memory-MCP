# Architecture Guide

## Overview

The Central Memory MCP Server is built as a serverless Azure Functions application that provides persistent knowledge graph storage for AI assistants through the Model Context Protocol (MCP).

## System Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VS Code       │    │  Azure Functions │    │  Azure Table    │
│   Copilot       │◄──►│   MCP Server     │◄──►│   Storage       │
│   (#memory-test)│    │                 │    │  (Azurite local)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. MCP Integration Layer

- **Location**: `src/functions/mcpTools.ts`
- **Purpose**: Handles MCP protocol communication
- **Features**:
  - 16 MCP tools for knowledge graph operations
  - Workspace-aware request routing
  - Error handling and validation

### 2. Storage Service

- **Location**: `src/services/storageService.ts`
- **Purpose**: Unified storage abstraction
- **Features**:
  - Azure Table Storage integration
  - Azurite development storage support
  - Workspace isolation
  - Batch operations for performance

### 3. Domain Services

- **Entities Service**: `src/services/entities.ts`
- **Relations Service**: `src/services/relations.ts`
- **Stats Service**: `src/services/stats.ts`
- **Purpose**: Business logic for knowledge graph operations

### 4. Type System

- **Location**: `src/types/`
- **Purpose**: TypeScript definitions for all domain objects
- **Structure**:
  - `core.ts` - Entity and Relation definitions
  - `storage.ts` - Storage and workspace types
  - `operations.ts` - Operation and batch types
  - `stats.ts` - Statistics and metrics types

## Design Patterns

### 1. Workspace Isolation

Each VS Code workspace gets its own partition in Azure Table Storage:

- **Partition Key**: `workspaceId`
- **Row Key**: Entity name or relation identifier
- **Benefits**: Complete data isolation, multi-tenant support

### 2. Entity-Relation Model

```typescript
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  metadata?: Record<string, any>;
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
  strength?: number;
  metadata?: Record<string, any>;
}
```

### 3. Batch Processing

- Operations are automatically batched for performance
- Azure Table Storage 100-item batch limit respected
- Fallback to individual operations when needed

### 4. Storage Abstraction

```typescript
class StorageService {
  // Factory pattern for workspace-specific instances
  static async createForWorkspace(workspaceId: string): Promise<StorageService>
  
  // Unified operations for all storage needs
  async upsertEntities(entities: Entity[]): Promise<void>
  async searchEntities(query: SearchQuery): Promise<Entity[]>
}
```

## Data Flow

### 1. Request Processing

1. VS Code sends MCP request to `/runtime/webhooks/mcp/sse`
2. Azure Functions runtime routes to appropriate MCP tool
3. Tool validates request and extracts workspace context
4. Storage service performs operation with workspace isolation

### 2. Storage Operations

1. Entity/relation validation
2. Workspace-specific storage service creation
3. Azure Table Storage operations (with Azurite locally)
4. Response transformation and return

## Performance Considerations

### 1. Storage Optimization

- **Partition Strategy**: Workspace-based partitioning
- **Batch Operations**: Automatic batching for bulk operations
- **Connection Pooling**: Reused TableClient instances

### 2. Memory Management

- **Stateless Functions**: Each request is independent
- **Efficient Serialization**: JSON for complex objects
- **Streaming**: Large result sets handled efficiently

## Security Model

### 1. Development

- **Azurite**: Local storage emulator
- **Connection String**: Development storage account
- **Isolation**: Process-level isolation

### 2. Production

- **Managed Identity**: Azure AD authentication
- **Network Security**: Private endpoints support
- **Workspace Isolation**: Tenant-level data separation

## Error Handling

### 1. Validation Errors

- Entity structure validation
- Required field checking
- Type safety enforcement

### 2. Storage Errors

- Connection failure handling
- Retry logic for transient failures
- Graceful degradation

### 3. MCP Protocol Errors

- Proper error response formatting
- Detailed error messages for debugging
- Request/response logging

## Monitoring and Observability

### 1. Health Endpoints

- `/api/health` - Basic health check
- `/api/ready` - Readiness probe for containers

### 2. Logging

- Structured logging with correlation IDs
- Storage operation metrics
- Error tracking and alerting

### 3. Performance Metrics

- Request latency tracking
- Storage operation timing
- Batch operation efficiency
