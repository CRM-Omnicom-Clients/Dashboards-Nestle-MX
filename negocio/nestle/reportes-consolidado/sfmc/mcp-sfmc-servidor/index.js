import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import 'dotenv/config';

import { contentBuilderTools } from './src/tools/content_builder.js';
import { journeyBuilderTools } from './src/tools/journey_builder.js';
import { dataExtensionTools } from './src/tools/data_extensions.js';
import { trackingTools } from './src/tools/tracking.js';
import { automationTools } from './src/tools/automations.js';

const server = new McpServer({
  name: 'mcp-sfmc',
  version: '1.0.0',
});

const allTools = [
  ...contentBuilderTools,
  ...journeyBuilderTools,
  ...dataExtensionTools,
  ...trackingTools,
  ...automationTools,
];

for (const tool of allTools) {
  // Convertir inputSchema JSON Schema → zod schema plano
  const props = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  const zodShape = {};
  for (const [key, def] of Object.entries(props)) {
    let zType;
    if (def.type === 'number') {
      zType = z.number();
    } else if (def.type === 'boolean') {
      zType = z.boolean();
    } else if (def.type === 'array') {
      zType = z.array(z.any());
    } else if (def.type === 'object') {
      zType = z.record(z.any());
    } else {
      zType = z.string();
    }

    if (def.description) zType = zType.describe(def.description);
    if (!required.includes(key)) zType = zType.optional();
    zodShape[key] = zType;
  }

  server.tool(tool.name, tool.description, zodShape, async (args) => {
    try {
      const result = await tool.handler(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err.message;
      return {
        content: [{ type: 'text', text: `ERROR: ${msg}` }],
        isError: true,
      };
    }
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
