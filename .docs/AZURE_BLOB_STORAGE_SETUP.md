# Azure Blob Storage Configuration for Memory Storage

This document explains how to configure Azure Blob Storage with managed system identity for memory storage in the Central Memory MCP Server.

## Overview

The Central Memory MCP Server supports two storage backends:

1. **Azure Blob Storage** (Recommended for production) - Uses managed identity for secure access
2. **File System** (Development/fallback) - Uses local files with workspace separation

## Azure Blob Storage Setup

### 1. Create Azure Storage Account

```powershell
# Create resource group (if needed)
az group create --name rg-mcp-memory --location eastus

# Create storage account
az storage account create \
  --name mcpmemory$(date +%s) \
  --resource-group rg-mcp-memory \
  --location eastus \
  --sku Standard_LRS \
  --allow-blob-public-access false
```

### 2. Create Storage Container

```powershell
# Get storage account name
$STORAGE_ACCOUNT_NAME = "your-storage-account-name"

# Create container
az storage container create \
  --name mcp-memory \
  --account-name $STORAGE_ACCOUNT_NAME \
  --public-access off
```

### 3. Configure Managed Identity (Production)

#### Option A: System-Assigned Managed Identity (Recommended)

```powershell
# Enable system-assigned managed identity on Azure Function
az functionapp identity assign \
  --name your-function-app-name \
  --resource-group your-resource-group

# Get the principal ID
$PRINCIPAL_ID = az functionapp identity show \
  --name your-function-app-name \
  --resource-group your-resource-group \
  --query principalId -o tsv

# Assign Storage Blob Data Contributor role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/rg-mcp-memory/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT_NAME"
```

#### Option B: User-Assigned Managed Identity

```powershell
# Create user-assigned managed identity
az identity create \
  --name mcp-memory-identity \
  --resource-group rg-mcp-memory

# Assign to Function App
az functionapp identity assign \
  --name your-function-app-name \
  --resource-group your-resource-group \
  --identities /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/rg-mcp-memory/providers/Microsoft.ManagedIdentity/userAssignedIdentities/mcp-memory-identity

# Assign Storage role to managed identity
az role assignment create \
  --assignee-object-id $(az identity show --name mcp-memory-identity --resource-group rg-mcp-memory --query principalId -o tsv) \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/rg-mcp-memory/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT_NAME"
```

### 4. Configure Application Settings

Add these settings to your Azure Function App:

```powershell
# Configure Azure Storage for production (managed identity)
az functionapp config appsettings set \
  --name your-function-app-name \
  --resource-group your-resource-group \
  --settings \
    AZURE_STORAGE_ACCOUNT_NAME="$STORAGE_ACCOUNT_NAME" \
    AZURE_STORAGE_CONTAINER_NAME="mcp-memory"
```

### 5. Development Configuration

For local development, you can use connection string or account key:

#### Using Connection String (Development)

```powershell
# Get connection string
$CONNECTION_STRING = az storage account show-connection-string \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group rg-mcp-memory \
  --query connectionString -o tsv

# Add to local.settings.json
```

Update `local.settings.json`:

```json
{
  "Values": {
    "AZURE_STORAGE_ACCOUNT_NAME": "your-storage-account-name",
    "AZURE_STORAGE_CONTAINER_NAME": "mcp-memory",
    "AZURE_STORAGE_CONNECTION_STRING": "your-connection-string"
  }
}
```

#### Using Account Key (Development)

```powershell
# Get account key
$ACCOUNT_KEY = az storage account keys list \
  --account-name $STORAGE_ACCOUNT_NAME \
  --resource-group rg-mcp-memory \
  --query [0].value -o tsv
```

Update `local.settings.json`:

```json
{
  "Values": {
    "AZURE_STORAGE_ACCOUNT_NAME": "your-storage-account-name",
    "AZURE_STORAGE_CONTAINER_NAME": "mcp-memory",
    "AZURE_STORAGE_ACCOUNT_KEY": "your-account-key"
  }
}
```

## Workspace-Specific Memory

The system automatically creates workspace-specific memory files using the following hierarchy:

```text
Container: mcp-memory
├── workspaces/
│   ├── default/
│   │   └── memory.jsonl
│   ├── project-a/
│   │   └── memory.jsonl
│   ├── team-alpha/
│   │   └── memory.jsonl
│   └── workspace-123/
│       └── memory.jsonl
```

## Using Workspace ID

### Via HTTP Headers

Send workspace ID in request headers:

```javascript
// Option 1: x-workspace-id header
headers: {
  'x-workspace-id': 'my-project'
}

// Option 2: x-project-id header
headers: {
  'x-project-id': 'my-project'
}
```

### Via URL Parameters

Include workspace ID in URL:

```http
GET /api/mcp?workspace=my-project
POST /api/mcp?project=my-project
```

### Default Workspace

If no workspace ID is provided, the system uses `'default'` as the workspace ID.

## Security Best Practices

### 1. Managed Identity (Production)

- ✅ **Use managed identity in production**
- ✅ Assign minimal required permissions (Storage Blob Data Contributor)
- ✅ Scope permissions to specific storage account
- ❌ Never use account keys in production

### 2. Network Security

```powershell
# Restrict storage account to Azure services only
az storage account update \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group rg-mcp-memory \
  --default-action Deny \
  --bypass AzureServices
```

### 3. Access Tiers

Configure appropriate access tier for cost optimization:

```powershell
# Set container to Hot tier for frequent access
az storage container set-metadata \
  --name mcp-memory \
  --account-name $STORAGE_ACCOUNT_NAME \
  --metadata tier=hot
```

## Monitoring and Diagnostics

### 1. Enable Storage Analytics

```powershell
# Enable logging and metrics
az storage logging update \
  --account-name $STORAGE_ACCOUNT_NAME \
  --services b \
  --log rwd \
  --retention 7

az storage metrics update \
  --account-name $STORAGE_ACCOUNT_NAME \
  --services b \
  --api true \
  --hour true \
  --minute false \
  --retention 7
```

### 2. Application Insights Integration

The logger automatically integrates with Application Insights when configured in Azure Functions.

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check managed identity permissions
2. **404 Not Found**: Verify storage account and container names
3. **Connection timeout**: Check network security rules

### Debugging Commands

```powershell
# Test managed identity token
az account get-access-token --resource https://storage.azure.com/

# Check storage account access
az storage container list --account-name $STORAGE_ACCOUNT_NAME

# Verify blob permissions
az storage blob list --container-name mcp-memory --account-name $STORAGE_ACCOUNT_NAME
```

## Migration from File Storage

The system automatically handles both storage types. To migrate existing file-based memory:

1. Deploy with Azure Blob Storage configuration
2. The system will use blob storage for new data
3. Existing file data remains accessible as fallback
4. Gradually migrate by workspace as needed

## Cost Optimization

- Use **Standard_LRS** for redundancy balance
- Set **access tier** based on usage patterns
- Implement **lifecycle policies** for old memory data
- Monitor **transaction costs** for high-frequency workspaces

## Examples

### Bicep Template

```bicep
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: 'mcpmemory${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: storageAccount::blobService
  name: 'mcp-memory'
  properties: {
    publicAccess: 'None'
  }
}
```

### Terraform Example

```hcl
resource "azurerm_storage_account" "mcp_memory" {
  name                     = "mcpmemory${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                = azurerm_resource_group.main.location
  account_tier            = "Standard"
  account_replication_type = "LRS"
  
  allow_nested_items_to_be_public = false
  min_tls_version                = "TLS1_2"
}

resource "azurerm_storage_container" "mcp_memory" {
  name                  = "mcp-memory"
  storage_account_name  = azurerm_storage_account.mcp_memory.name
  container_access_type = "private"
}
```
