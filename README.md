# Central Memory MCP Server (Azure Functions)

A centralized Model Context Protocol (MCP) memory server built with Azure Functions, designed to provide persistent knowledge graph storage for multiple developers' LLMs within an organization.

## 🏗️ Architecture

This MCP server is built using:

- **Azure Functions v4** with TypeScript programming model
- **Model Context Protocol (MCP) SDK v1.15.1** for standardized AI tool integration
- **Knowledge Graph** storage using JSON-Lines format for persistence
- **Production-ready** logging, health checks, and error handling
- **Zod** for input validation and type safety

## 📁 Project Structure

```text
├── src/
│   ├── functions/                    # Azure Functions
│   │   ├── mcp.ts                   # Main MCP endpoint (GET/POST /api/mcp)
│   │   ├── health.ts                # Health check endpoint (/api/health)
│   │   └── ready.ts                 # Readiness probe (/api/ready)
│   ├── services/                    # Business logic services
│   │   ├── knowledgeGraphManager.ts # Core knowledge graph operations
│   │   ├── logger.ts                # Centralized logging service
│   │   └── mcpServerService.ts      # MCP server setup (backup)
│   └── types/                       # TypeScript type definitions
│       └── index.ts                 # Entity, Relation, KnowledgeGraph types
├── index.express.backup.ts          # Original Express.js implementation (backup)
├── host.json                        # Azure Functions host configuration
├── local.settings.json              # Local development settings
├── tsconfig.json                    # TypeScript configuration
├── Dockerfile                       # Container deployment option
└── package.json                     # Dependencies and scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Azure Functions Core Tools v4
- Azure account (for deployment)

### Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the project:**

   ```bash
   npm run build
   ```

3. **Start Azure Functions locally:**

   ```bash
   npm start
   ```

4. **Test the server:**

   ```bash
   # Health check
   curl http://localhost:7071/api/health
   
   # Readiness probe
   curl http://localhost:7071/api/ready
   
   # MCP endpoint
   curl -X POST http://localhost:7071/api/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

## 🔧 Available MCP Tools

The server provides these MCP tools for knowledge graph management:

### Core Operations

- **`create_entities`** - Create new entities with observations
- **`create_relations`** - Create relationships between entities  
- **`add_observations`** - Add new observations to existing entities

### Query Operations

- **`read_graph`** - Read the entire knowledge graph
- **`search_nodes`** - Search entities by name, type, or observation content
- **`open_nodes`** - Retrieve specific entities by name
- **`get_stats`** - Get graph statistics (entity count, relation count, etc.)

### Maintenance Operations

- **`delete_entities`** - Remove entities and their relations
- **`delete_observations`** - Remove specific observations from entities
- **`delete_relations`** - Remove specific relationships

## 🌐 API Endpoints

### MCP Endpoint

- **POST/GET** `/api/mcp` - Main MCP endpoint supporting JSON-RPC protocol
- Supports both POST (request body) and GET (query params) per MCP specification

### Health & Monitoring

- **GET** `/api/health` - Health check with knowledge graph statistics
- **GET** `/api/ready` - Readiness probe for container orchestration

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMORY_FILE_PATH` | Path to knowledge graph storage file | `./data/memory.json` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `AzureWebJobsStorage` | Azure Storage connection string | `UseDevelopmentStorage=true` |
| `FUNCTIONS_WORKER_RUNTIME` | Functions runtime | `node` |

### Local Settings

Current `local.settings.json` configuration:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "NODE_ENV": "development",
    "MEMORY_FILE_PATH": "./data/memory.json"
  }
}
```

## 🚀 Deployment Options

### Option 1: Azure Functions

1. **Login to Azure:**

   ```bash
   az login
   ```

2. **Deploy using npm script:**

   ```bash
   npm run deploy
   ```

### Option 2: Container Deployment

The project includes a `Dockerfile` for containerized deployment:

```bash
# Build container
docker build -t central-memory-mcp .

# Run locally
docker run -p 3000:3000 -e MEMORY_FILE_PATH=/tmp/memory.json central-memory-mcp

# Deploy to Azure Container Apps
az containerapp create --name central-memory-mcp --image central-memory-mcp
```

## 🔍 Usage Examples

### Creating Entities

```bash
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_entities",
      "arguments": {
        "entities": [
          {
            "name": "John Doe",
            "entityType": "Person",
            "observations": ["Software developer", "Works on Azure projects"]
          }
        ]
      }
    }
  }'
```

### Searching the Knowledge Graph

```bash
curl -X POST http://localhost:7071/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_nodes",
      "arguments": {
        "query": "Azure"
      }
    }
  }'
```

## 📋 Data Storage

- **Format**: JSON-Lines (JSONL) for easy parsing and debugging
- **Location**: Configurable via `MEMORY_FILE_PATH` environment variable
- **Structure**: Each line contains either an entity or relation object with type indicator
- **Persistence**: File-based storage with automatic directory creation

## 🎯 KISS Principles Applied

This implementation follows **Keep It Simple, Stupid** principles:

- **Single Responsibility**: Each function and service has one clear purpose
- **Minimal Dependencies**: Only essential packages (@azure/functions, MCP SDK, zod)
- **Clear Structure**: Logical separation of functions, services, and types
- **Simple Storage**: JSON-Lines format for easy debugging and migration
- **Straightforward API**: Standard MCP protocol implementation

## 🔒 Production Considerations

### Security

- Add Azure AD authentication for production deployment
- Implement API key validation for public endpoints
- Consider request rate limiting

### Storage

- **Development**: Local file storage (`./data/memory.json`)
- **Production**: Consider Azure Blob Storage or Cosmos DB for scalability
- **Backup**: Implement automated backup strategy for knowledge graph data

### Monitoring

- Leverage Application Insights for telemetry and monitoring
- Azure Functions provides built-in metrics and logging
- Health endpoint returns graph statistics for monitoring

### Scaling

- Azure Functions auto-scale based on demand
- Consider connection pooling for high-throughput scenarios
- Monitor memory usage for large knowledge graphs

## 🔧 Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch mode for development
- `npm start` - Start Azure Functions locally (runs build first)
- `npm run deploy` - Deploy to Azure Functions

### File Structure Details

- **Functions**: Each Azure Function is in its own file with proper registration
- **Services**: Business logic separated from HTTP handling
- **Types**: Comprehensive TypeScript interfaces for type safety
- **Backup**: Original Express.js implementation preserved as `index.express.backup.ts`

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:

- Check Azure Functions documentation
- Review MCP specification at [modelcontextprotocol.io](https://modelcontextprotocol.io)
- Open an issue in this repository
