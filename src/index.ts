import { app } from '@azure/functions';

app.setup({
    enableHttpStream: true,
});

// Import all MCP tools to register them
import './functions/mcpTools.js';