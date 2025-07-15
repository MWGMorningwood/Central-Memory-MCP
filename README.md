# Central Memory MCP Server

A centralized Model Cont## 📁 Project Structurext Protocol (MCP) memory server built with Azure Functions and TypeScript, providing persistent knowledge graph storage for AI assistants in VS Code.

## 🚀 Quick Start

```bash
npm install
func start
```

### VS Code Integration

1. **Install recommended extensions** from `.vscode/extensions.json`
2. **MCP configuration** is ready in `.vscode/mcp.json`
3. **Use `#memory-test` tools** in VS Code Copilot chat

### Test the Server

```bash
# Health check
curl http://localhost:7071/api/health

# Use in VS Code Copilot:
# #memory-test_create_entities
# #memory-test_read_graph
# #memory-test_search_entities
```

## 🔧 MCP Tools

**Core Operations:**

- `create_entities` - Create entities with observations
- `create_relations` - Create relationships between entities
- `read_graph` - Read the entire knowledge graph
- `search_entities` / `search_relations` - Search by name/type
- `add_observation` - Add observations to existing entities
- `get_stats` - Get workspace statistics
- `clear_memory` - Clear all workspace data

**Advanced Features:**

- `get_temporal_events` - Time-based activity tracking
- `merge_entities` - Merge duplicate entities
- `detect_duplicate_entities` - Find potential duplicates
- `execute_batch_operations` - Batch multiple operations

## 🏗️ Architecture

Built with:

- **Azure Functions v4** with TypeScript
- **Azure Table Storage** for persistent data (via Azurite locally)
- **Model Context Protocol (MCP)** for VS Code integration
- **Workspace isolation** - each project gets separate storage

## � Project Structure

```text
src/
├── functions/           # Azure Functions endpoints
├── services/           # Business logic (storage, entities, relations)
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
