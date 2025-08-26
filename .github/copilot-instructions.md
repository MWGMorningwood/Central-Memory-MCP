# Central Memory MCP Server

Model Context Protocol (MCP) memory server built with Azure Functions and TypeScript, providing persistent knowledge graph storage for AI assistants in VS Code.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap, Build, and Test the Repository

```bash
# Install dependencies - takes ~2 seconds
npm install

# Build the project - takes ~2 seconds. NEVER CANCEL.
npm run build

# Install Azure Functions Core Tools v4 (if not already installed)
npm install -g azure-functions-core-tools@4 --unsafe-perm true
# NOTE: May fail due to firewall limitations - see Alternative Setup below
```

### Start the Development Environment

**Prerequisites:**
- Node.js 18+ with npm
- Azure Functions Core Tools v4
- Azurite (for local storage)

**Setup Steps:**

1. **Start Azurite Storage Emulator**
   ```bash
   # Option 1: Use VS Code extension (recommended)
   # Install "Azurite" extension and start from command palette
   
   # Option 2: Command line (if azurite is installed globally)
   azurite --location ./azurite --debug
   # NOTE: May fail due to firewall limitations during installation
   ```

2. **Run the Azure Functions Server**
   ```bash
   # Start the server - NEVER CANCEL. Set timeout to 30+ minutes for first run.
   func start --port 7071 --verbose
   
   # Alternative: Use npm script
   npm start
   ```

3. **Configure VS Code**
   - Install recommended extensions from `.vscode/extensions.json`
   - The `.vscode/mcp.json` configures the MCP connection
   - Use `#memory-test` tools in Copilot chat

### Alternative Setup (Network Restrictions)

If Azure Functions Core Tools or Azurite installation fails due to network/firewall limitations:

1. **Document the limitation**: "Azure Functions Core Tools installation fails due to firewall limitations"
2. **Use Docker alternative**: The repository includes a `Dockerfile` for containerized development
   ```bash
   # Build the container - takes 10+ minutes. NEVER CANCEL. Set timeout to 20+ minutes.
   docker build -t central-memory-mcp .
   
   # Run the container 
   docker run -p 7071:80 central-memory-mcp
   ```
3. **Use health endpoints for validation**: The application provides `/api/health` and `/api/ready` endpoints
4. **Manual testing approach**: Build the project and examine the `dist/` folder structure
5. **Focus on build validation**: Ensure `npm run build` succeeds and produces correct output

## Validation

### Manual Validation Steps

**ALWAYS run through these validation scenarios after making changes:**

1. **Build Validation**
   ```bash
   npm run build
   # Verify dist/ folder is created with proper structure
   ls -la dist/
   ```

2. **Health Check Validation** (if func is available)
   ```bash
   # Start the server (if possible)
   func start --port 7071
   
   # Test health endpoint
   curl http://localhost:7071/api/health
   
   # Test readiness endpoint  
   curl http://localhost:7071/api/ready
   ```

3. **MCP Tools Testing** (in VS Code with Copilot)
   ```text
   # Create an entity
   #memory-test_create_entities workspaceId="my-project" entities={"name": "Alice", "entityType": "Person", "observations": ["Software engineer"]}
   
   # Create a relation
   #memory-test_create_relations workspaceId="my-project" relations={"from": "Alice", "to": "React Project", "relationType": "worksOn"}
   
   # Search entities
   #memory-test_search_entities workspaceId="my-project" name="Alice"
   
   # Read the graph
   #memory-test_read_graph workspaceId="my-project"
   ```

4. **File Structure Validation**
   ```bash
   # Verify all key components are present
   ls -la src/functions/    # mcpTools.ts, health.ts, ready.ts
   ls -la src/services/     # entities.ts, relations.ts, stats.ts, storageService.ts
   ls -la src/types/        # TypeScript definitions
   ```

### CRITICAL Build and Test Timing

- **npm install**: Takes ~2 seconds. NEVER CANCEL.
- **npm run build**: Takes ~2 seconds. NEVER CANCEL.
- **func start**: Takes 30+ seconds for first run. NEVER CANCEL. Set timeout to 30+ minutes.
- **docker build**: Takes 10+ minutes for first build. NEVER CANCEL. Set timeout to 20+ minutes.
- **Health endpoints**: Respond within 5 seconds when running.

**NEVER CANCEL BUILDS OR LONG-RUNNING COMMANDS** - Azure Functions may take several minutes to start properly.

## Common Tasks

### Repository Structure

```text
├── .docs/              # Comprehensive documentation
│   ├── ARCHITECTURE.md # Technical design patterns
│   ├── API.md         # Complete MCP tools reference  
│   ├── STORAGE.md     # Storage configuration guide
│   └── DEPLOYMENT.md  # Production deployment options
├── .github/           # GitHub configuration
├── .vscode/           # VS Code integration config
│   ├── extensions.json # Recommended extensions
│   └── mcp.json       # MCP server configuration
├── src/
│   ├── functions/     # Azure Functions endpoints
│   │   ├── mcpTools.ts # 16 MCP tools for knowledge graph
│   │   ├── health.ts   # Health check endpoint
│   │   └── ready.ts    # Readiness probe
│   ├── services/      # Business logic
│   │   ├── entities.ts    # Entity operations
│   │   ├── relations.ts   # Relationship operations  
│   │   ├── stats.ts       # Graph statistics and batch ops
│   │   ├── storageService.ts # Azure Table Storage abstraction
│   │   ├── logger.ts      # Structured logging
│   │   └── utils.ts       # Utility functions
│   ├── types/         # TypeScript definitions
│   └── index.ts       # Main entry point
├── dist/              # Compiled JavaScript (after build)
├── package.json       # Dependencies and scripts
├── host.json          # Azure Functions configuration
├── tsconfig.json      # TypeScript configuration
└── Dockerfile         # Container deployment
```

### Key Configuration Files

**package.json scripts:**
- `build` - Compile TypeScript to JavaScript
- `start` - Start Azure Functions runtime

**Environment Variables (Development):**
```bash
AzureWebJobsStorage=UseDevelopmentStorage=true
```

**Environment Variables (Production):**
```bash
AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=myaccount;AccountKey=...
AZURE_STORAGE_ACCOUNT_NAME=mystorageaccount
```

### Frequently Used Commands

```bash
# Quick development cycle
npm install && npm run build

# Check application structure  
find src -name "*.ts" | head -15

# Verify build output
ls -la dist/functions/

# Check package info
cat package.json | grep -E "(name|version|scripts)"
```

### Important Code Locations

- **MCP Tools Registration**: `src/functions/mcpTools.ts` - All 16 MCP tools with object parameters
- **Storage Layer**: `src/services/storageService.ts` - Azure Table Storage with workspace isolation
- **Entity Operations**: `src/services/entities.ts` - Create, search, update entities
- **Relation Operations**: `src/services/relations.ts` - Create, search relations  
- **Health Endpoints**: `src/functions/health.ts` and `src/functions/ready.ts`

### Development Notes

- **Workspace Isolation**: Each project gets separate storage via workspaceId parameter
- **MCP Integration**: All tools use object parameters (not JSON strings) for better type safety
- **Storage**: Uses Azure Table Storage with Azurite for local development
- **Logging**: Structured logging with correlation IDs throughout the application
- **Error Handling**: Comprehensive error handling with proper MCP protocol responses

### Troubleshooting

**Build Issues:**
- Ensure Node.js 18+ is installed
- Run `npm install` before `npm run build`
- Check `tsconfig.json` for TypeScript configuration

**Runtime Issues:**
- Verify Azurite is running for local development
- Check `host.json` for function timeout settings (currently 5 minutes)
- Use health endpoints to verify service status

**Network/Firewall Issues:**
- Azure Functions Core Tools installation may fail - document the limitation: "Azure Functions Core Tools installation fails due to firewall/network limitations"
- Azurite installation may fail - use Docker alternative or document limitation  
- Health endpoint testing may not be possible - focus on build validation
- **WORKAROUND**: If `func start` is not available, validate by examining build output in `dist/` folder and ensuring TypeScript compilation succeeds

**Always check handler.ts after making changes to any service files in src/services/.**