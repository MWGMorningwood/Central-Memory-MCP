# Storage Guide

## Overview

The Central Memory MCP Server uses Azure Table Storage for persistent knowledge graph storage with automatic workspace isolation.

## Storage Architecture

### Development Storage (Azurite)

- **Purpose**: Local development and testing
- **Connection**: Development storage connection string
- **Endpoint**: `http://127.0.0.1:10002/devstoreaccount1`
- **Configuration**: Automatic when `AzureWebJobsStorage=UseDevelopmentStorage=true`

### Production Storage (Azure Table Storage)

- **Purpose**: Production workloads
- **Authentication**: Azure Managed Identity
- **Connection**: HTTPS endpoints with AAD authentication
- **Configuration**: Environment variables for account and credentials

## Table Structure

### Entities Table

- **Table Name**: `entities`
- **Partition Key**: `workspaceId`
- **Row Key**: `entityName`
- **Properties**:
  - `name` (string): Entity name
  - `entityType` (string): Entity type/category
  - `observations` (string): JSON array of observations
  - `createdAt` (string): ISO 8601 timestamp
  - `updatedAt` (string): ISO 8601 timestamp
  - `createdBy` (string): User identifier
  - `metadata` (string): JSON object with custom properties

### Relations Table

- **Table Name**: `relations`
- **Partition Key**: `workspaceId`
- **Row Key**: `{from}|{to}|{relationType}`
- **Properties**:
  - `from` (string): Source entity name
  - `to` (string): Target entity name
  - `relationType` (string): Relationship type
  - `strength` (number): Relationship strength (0.0-1.0)
  - `createdAt` (string): ISO 8601 timestamp
  - `updatedAt` (string): ISO 8601 timestamp
  - `createdBy` (string): User identifier
  - `metadata` (string): JSON object with custom properties

## Workspace Isolation

### Partition Strategy

Each workspace gets its own partition in both tables:

- **Benefits**: Complete data isolation, efficient queries
- **Scaling**: Automatic load distribution across partitions
- **Security**: Workspace-level access control

### Workspace ID Generation

- **Source**: VS Code workspace folder path or project identifier
- **Format**: Normalized string (lowercase, alphanumeric)
- **Examples**:
  - `my-project` → `my-project`
  - `C:\Users\Dev\Project` → `c-users-dev-project`

## Configuration

### Environment Variables

#### Development

```bash
# Azure Functions setting
AzureWebJobsStorage=UseDevelopmentStorage=true

# Azurite connection (optional override)
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;
```

#### Production

```bash
# Azure Functions setting
AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=...

# Storage account name
AZURE_STORAGE_ACCOUNT_NAME=mystorageaccount

# Optional: Connection string override
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=...
```

## Performance Optimization

### Batch Operations

- **Batch Size**: 100 items maximum (Azure limit)
- **Automatic Batching**: Large operations split automatically
- **Parallel Processing**: Multiple batches processed concurrently

### Query Optimization

- **Partition Queries**: All queries scoped to workspace partition
- **Row Key Optimization**: Efficient entity lookups by name
- **Filter Optimization**: Uses OData filters for complex queries

### Connection Management

- **Connection Pooling**: Reused TableClient instances
- **Retry Logic**: Automatic retry for transient failures
- **Circuit Breaker**: Prevents cascade failures

## Data Consistency

### Transaction Boundaries

- **Entity Operations**: Single entity per transaction
- **Relation Operations**: Single relation per transaction
- **Batch Operations**: Multiple items with eventual consistency

### Conflict Resolution

- **Upsert Operations**: Last-write-wins for conflicts
- **Optimistic Concurrency**: ETags for version control
- **Duplicate Detection**: Pre-write validation

## Backup and Recovery

### Development

- **Azurite Data**: Stored in `__azurite_db_*.json` files
- **Backup**: Copy JSON files to backup location
- **Recovery**: Restore JSON files and restart Azurite

### Production

- **Azure Backup**: Built-in geo-redundant storage
- **Point-in-Time Recovery**: Azure Table Storage snapshots
- **Cross-Region Replication**: Automatic with geo-redundant storage

## Monitoring

### Storage Metrics

- **Request Latency**: Query and write operation timing
- **Error Rates**: Failed operations and retry counts
- **Throughput**: Requests per second and data transfer

### Health Checks

- **Connection Health**: Periodic connectivity tests
- **Table Availability**: Verify table accessibility
- **Performance Baseline**: Monitor query performance

## Security

### Development

- **Local Access**: No authentication required
- **Network Security**: Localhost binding only
- **Data Isolation**: Process-level isolation

### Production

- **Authentication**: Azure Managed Identity
- **Authorization**: RBAC with Storage Table Data Contributor
- **Network Security**: Private endpoints and firewall rules
- **Encryption**: TLS in transit, encryption at rest

## Troubleshooting

### Common Issues

#### Connection Failures

```bash
# Check Azurite is running
azurite --location ./azurite --debug

# Verify connection string
func settings list
```

#### Permission Errors

```bash
# Check managed identity assignment
az role assignment list --assignee <identity-id>

# Verify storage account access
az storage account show --name <account-name>
```

#### Performance Issues

```bash
# Check query patterns
# Ensure workspace-scoped queries
# Monitor batch operation sizes
```

### Debug Logging

```bash
# Enable detailed logging
func start --verbose

# Check specific operations
# Review Azure Functions logs
# Monitor storage account metrics
```

## Migration

### Schema Changes

- **Backward Compatibility**: Additive changes only
- **Version Management**: Metadata versioning
- **Migration Scripts**: Automated data transformation

### Data Migration

- **Export/Import**: JSON-based data transfer
- **Workspace Migration**: Per-workspace data movement
- **Validation**: Data integrity checks post-migration
