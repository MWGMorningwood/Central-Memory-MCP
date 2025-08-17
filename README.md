# Central Memory MCP Server
[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/MWGMorningwood/Central-Memory-MCP)](https://archestra.ai/mcp-catalog/mwgmorningwood__central-memory-mcp)

Model Context Protocol (MCP) memory server built with Azure Functions and TypeScript, providing persistent knowledge graph storage for AI assistants in VS Code.  
Inspired by and forked from [`@modelcontextprotocol/server-memory`](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)

## 🚀 Quick Start

```bash
npm install
func start
```

### VS Code Integration

1. **Install recommended extensions** from `.vscode/extensions.json`
2. **MCP configuration** is ready in `.vscode/mcp.json`
3. **Use `#memory-test` tools** in VS Code Copilot chat

> **Note**: All MCP tools now use object parameters instead of JSON strings for better type safety and ease of use.

### Test the Server

```bash
# Health check
curl http://localhost:7071/api/health

# Use in VS Code Copilot with object parameters:
# #memory-test_create_entities
# #memory-test_read_graph
# #memory-test_search_entities
```

### Example Usage in VS Code Copilot

```text
Create an entity:
#memory-test_create_entities workspaceId="my-project" entities={"name": "Alice", "entityType": "Person", "observations": ["Software engineer"]}

Create a relation:
#memory-test_create_relations workspaceId="my-project" relations={"from": "Alice", "to": "React Project", "relationType": "worksOn"}

Search entities:
#memory-test_search_entities workspaceId="my-project" name="Alice"
```

## 🔧 MCP Tools

**Core Operations:**

- `create_entities` - Create single entity with observations
- `create_relations` - Create single relationship between entities
- `read_graph` - Read the entire knowledge graph
- `search_entities` / `search_relations` - Search by name/type
- `add_observation` - Add observations to existing entities
- `update_entity` - Update entity observations and metadata
- `delete_entity` - Remove entity and all its relations
- `get_stats` - Get workspace statistics
- `clear_memory` - Clear all workspace data

**Advanced Features:**

- `get_temporal_events` - Time-based activity tracking
- `merge_entities` - Merge duplicate entities
- `detect_duplicate_entities` - Find potential duplicates
- `execute_batch_operations` - Batch multiple operations
- `get_user_stats` - Get user-specific statistics
- `search_relations_by_user` - Find relations by user

## 🏗️ Architecture

Built with:

- **Azure Functions v4** with TypeScript
- **Azure Table Storage** for persistent data (via Azurite locally)
- **Model Context Protocol (MCP)** for VS Code integration
- **Workspace isolation** - each project gets separate storage

## � Project Structure

```text
src/
├── functions/         # Azure Functions endpoints
├── services/          # Business logic (storage, entities, relations)
├── types/             # TypeScript definitions
└── index.ts           # Main entry point
```

## 📚 Documentation

For detailed information, see the `.docs/` folder:

- **[Architecture Guide](.docs/ARCHITECTURE.md)** - Technical design and patterns
- **[API Reference](.docs/API.md)** - Complete endpoint documentation
- **[Storage Guide](.docs/STORAGE.md)** - Storage configuration and workspace management
- **[Deployment Guide](.docs/DEPLOYMENT.md)** - Production deployment options

## 🔒 Production Notes

- Uses Azure Table Storage with managed identity for security
- Workspace isolation prevents data leakage between projects
- Health endpoints for monitoring and container orchestration
- Automatic fallback to local storage for development

## 📝 License

MIT License - see LICENSE file for details.
