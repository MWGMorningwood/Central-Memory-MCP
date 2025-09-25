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

**Recommended workflow for best results:**

```text
1. First, check existing data:
#memory-test_read_graph workspaceId="my-project"

2. Search for existing entities:
#memory-test_search_entities workspaceId="my-project" name="Alice"

3. Create entities (auto-updates existing ones):
#memory-test_create_entities workspaceId="my-project" entities={"name": "Alice", "entityType": "Person", "observations": ["Software engineer"]}

4. Create relationships (auto-creates missing entities):
#memory-test_create_relations workspaceId="my-project" relations={"from": "Alice", "to": "React Project", "relationType": "worksOn"}

5. Add observations (auto-creates entity if missing):
#memory-test_add_observation workspaceId="my-project" entityName="Alice" observation="Leads the frontend team" entityType="Person"
```

**Key Features for Better LLM Usability:**
- ✅ Auto-creation of missing entities when adding observations or relations
- ✅ Helpful error messages with examples when validation fails  
- ✅ Workflow guidance to view graph first, then search, then create
- ✅ Clear parameter descriptions with expected formats
- ✅ Reduced friction - tools handle common edge cases automatically

## 🔧 MCP Tools

**Core Operations:**

- `read_graph` - **RECOMMENDED FIRST STEP**: View the entire knowledge graph to understand existing data
- `create_entities` - Create entities with auto-update of existing ones
- `create_relations` - Create relationships with auto-creation of missing entities  
- `search_entities` / `search_relations` - Search and verify existing data
- `add_observation` - Add observations with auto-creation of missing entities
- `update_entity` - Update entity observations and metadata
- `delete_entity` - Remove entity and all its relations
- `get_stats` - Get workspace statistics
- `clear_memory` - Clear all workspace data

**Recommended Workflow:**
1. Use `read_graph` to understand existing data
2. Use `search_entities` to check for existing entities
3. Use `create_entities` to add new entities
4. Use `create_relations` to connect entities
5. Use `add_observation` to add new information

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
