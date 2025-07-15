# Deployment Guide

## Overview

The Central Memory MCP Server can be deployed in multiple ways, from local development to production Azure environments.

## Local Development

### Prerequisites

- Node.js 18+ with npm
- Azure Functions Core Tools v4
- Azurite (for local storage)

### Setup Steps

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd Central-Memory-MCP
   npm install
   ```

2. **Start Azurite**

   ```bash
   # Option 1: Use VS Code extension (recommended)
   # Install "Azurite" extension and start from command palette
   
   # Option 2: Command line
   azurite --location ./azurite --debug
   ```

3. **Run the Server**

   ```bash
   func start --port 7071
   ```

4. **Configure VS Code**
   - Install recommended extensions from `.vscode/extensions.json`
   - The `.vscode/mcp.json` configures the MCP connection
   - Use `#memory-test` tools in Copilot chat

### Environment Configuration

Create a `local.settings.json` file:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AZURE_STORAGE_CONNECTION_STRING": "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;"
  }
}
```

## Azure Functions Deployment

### Prerequisites

- Azure subscription
- Azure CLI installed and configured
- Resource group and storage account

### Deployment Steps

1. **Create Azure Resources**

   ```bash
   # Create resource group
   az group create --name myResourceGroup --location eastus
   
   # Create storage account
   az storage account create --name mystorageaccount --resource-group myResourceGroup --location eastus --sku Standard_LRS
   
   # Create function app
   az functionapp create --name mymemoryserver --resource-group myResourceGroup --consumption-plan-location eastus --runtime node --runtime-version 18 --functions-version 4 --storage-account mystorageaccount
   ```

2. **Configure Application Settings**

   ```bash
   # Set storage connection
   az functionapp config appsettings set --name mymemoryserver --resource-group myResourceGroup --settings "AzureWebJobsStorage=<storage-connection-string>"
   
   # Set storage account name
   az functionapp config appsettings set --name mymemoryserver --resource-group myResourceGroup --settings "AZURE_STORAGE_ACCOUNT_NAME=mystorageaccount"
   ```

3. **Deploy Function Code**

   ```bash
   # Build the project
   npm run build
   
   # Deploy to Azure
   func azure functionapp publish mymemoryserver
   ```

### Managed Identity Setup

1. **Enable System-Assigned Identity**

   ```bash
   az functionapp identity assign --name mymemoryserver --resource-group myResourceGroup
   ```

2. **Grant Storage Permissions**

   ```bash
   # Get the principal ID
   PRINCIPAL_ID=$(az functionapp identity show --name mymemoryserver --resource-group myResourceGroup --query principalId --output tsv)
   
   # Get storage account resource ID
   STORAGE_ID=$(az storage account show --name mystorageaccount --resource-group myResourceGroup --query id --output tsv)
   
   # Assign Storage Table Data Contributor role
   az role assignment create --assignee $PRINCIPAL_ID --role "Storage Table Data Contributor" --scope $STORAGE_ID
   ```

## Container Deployment

### Docker Build

1. **Create Dockerfile**

   ```dockerfile
   FROM mcr.microsoft.com/azure-functions/node:4-node18-appservice
   
   ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
       AzureFunctionsJobHost__Logging__Console__IsEnabled=true
   
   COPY . /home/site/wwwroot
   
   RUN cd /home/site/wwwroot && \
       npm install --production
   ```

2. **Build and Push**

   ```bash
   # Build image
   docker build -t mymemoryserver .
   
   # Tag for registry
   docker tag mymemoryserver myregistry.azurecr.io/mymemoryserver:latest
   
   # Push to registry
   docker push myregistry.azurecr.io/mymemoryserver:latest
   ```

### Container Apps Deployment

1. **Create Container App**

   ```bash
   # Create container app environment
   az containerapp env create --name myenvironment --resource-group myResourceGroup --location eastus
   
   # Deploy container app
   az containerapp create \
     --name mymemoryserver \
     --resource-group myResourceGroup \
     --environment myenvironment \
     --image myregistry.azurecr.io/mymemoryserver:latest \
     --target-port 80 \
     --ingress external \
     --env-vars "AzureWebJobsStorage=<storage-connection-string>" "AZURE_STORAGE_ACCOUNT_NAME=mystorageaccount"
   ```

## Production Considerations

### Security

1. **Network Security**
   - Use private endpoints for storage accounts
   - Configure firewall rules to restrict access
   - Enable VNet integration for function apps

2. **Authentication**
   - Use managed identity instead of connection strings
   - Implement Azure AD authentication for API access
   - Configure CORS policies appropriately

3. **Secrets Management**
   - Use Azure Key Vault for sensitive configuration
   - Avoid hardcoded secrets in source code
   - Rotate keys and certificates regularly

### Monitoring

1. **Application Insights**

   ```bash
   # Enable Application Insights
   az functionapp config appsettings set --name mymemoryserver --resource-group myResourceGroup --settings "APPINSIGHTS_INSTRUMENTATIONKEY=<instrumentation-key>"
   ```

2. **Health Checks**
   - Configure health check endpoints
   - Set up monitoring alerts
   - Implement custom metrics

3. **Logging**
   - Configure structured logging
   - Set appropriate log levels
   - Enable diagnostic settings

### Performance

1. **Scaling Configuration**

   ```bash
   # Configure auto-scaling
   az functionapp config set --name mymemoryserver --resource-group myResourceGroup --always-on true
   
   # Set concurrent executions
   az functionapp config appsettings set --name mymemoryserver --resource-group myResourceGroup --settings "FUNCTIONS_WORKER_PROCESS_COUNT=4"
   ```

2. **Storage Optimization**
   - Use premium storage for better performance
   - Configure connection pooling
   - Implement caching strategies

### Backup and Recovery

1. **Function App Backup**

   ```bash
   # Create backup configuration
   az functionapp config backup create --name mymemoryserver --resource-group myResourceGroup --storage-account-url <backup-url>
   ```

2. **Storage Backup**
   - Enable geo-redundant storage
   - Configure backup retention policies
   - Test recovery procedures

## CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Azure Functions

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build project
      run: npm run build
    
    - name: Deploy to Azure Functions
      uses: Azure/functions-action@v1
      with:
        app-name: mymemoryserver
        package: .
        publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

### Azure DevOps

Create `azure-pipelines.yml`:

```yaml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: NodeTool@0
  inputs:
    versionSpec: '18.x'
  displayName: 'Install Node.js'

- script: |
    npm install
    npm run build
  displayName: 'Install dependencies and build'

- task: AzureFunctionApp@1
  inputs:
    azureSubscription: 'Azure-Service-Connection'
    appType: 'functionApp'
    appName: 'mymemoryserver'
    package: '$(System.DefaultWorkingDirectory)'
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Verify storage account connection strings
   - Check managed identity permissions
   - Validate network connectivity

2. **Performance Issues**
   - Monitor function execution times
   - Check storage throttling
   - Optimize query patterns

3. **Deployment Failures**
   - Verify build output
   - Check function app settings
   - Review deployment logs

### Debug Tools

1. **Local Debugging**

   ```bash
   # Start with verbose logging
   func start --verbose
   
   # Enable debug mode
   export DEBUG=*
   func start
   ```

2. **Remote Debugging**
   - Use Application Insights for tracing
   - Enable remote debugging in Azure
   - Check function app logs

### Support Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Azure Table Storage Documentation](https://docs.microsoft.com/azure/storage/tables/)
- [Model Context Protocol Specification](https://github.com/microsoft/vscode-mcp)
