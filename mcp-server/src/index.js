#!/usr/bin/env node
/**
 * Logistics Aggregator MCP server (stdio).
 *
 * Exposes the External Shipment API as MCP tools so an assistant can quote,
 * book, track, edit and cancel shipments directly.
 *
 * Configuration (environment):
 *   LOGISTICS_BASE_URL       API base URL (default https://ops.subsolution.in)
 *   LOGISTICS_CLIENT_ID      lgk_live_... from the portal's Developers page
 *   LOGISTICS_CLIENT_SECRET  sk_live_...  (shown once at creation)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { LogisticsClient } from "./client.js";
import { tools } from "./tools.js";

const baseUrl = process.env.LOGISTICS_BASE_URL || "https://ops.subsolution.in";
const clientId = process.env.LOGISTICS_CLIENT_ID;
const clientSecret = process.env.LOGISTICS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  // stderr only — stdout is the MCP transport and must carry nothing else.
  console.error(
    "logistics-mcp: LOGISTICS_CLIENT_ID and LOGISTICS_CLIENT_SECRET are required.\n" +
      "Create API credentials in the portal under Developers → API Credentials.",
  );
  process.exit(1);
}

const client = new LogisticsClient({ baseUrl, clientId, clientSecret });
const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

const server = new Server(
  { name: "logistics-aggregator", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = toolsByName.get(request.params.name);

  if (!tool) {
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    };
  }

  try {
    const result = await tool.handler(client, request.params.arguments || {});
    return {
      content: [
        { type: "text", text: JSON.stringify(result?.data ?? result, null, 2) },
      ],
    };
  } catch (error) {
    // Surface the API's own error code and request id — they are what makes a
    // failure actionable (and quotable in a support request).
    const parts = [error.message];
    if (error.requestId) parts.push(`request_id: ${error.requestId}`);
    if (error.details) parts.push(`details: ${JSON.stringify(error.details)}`);

    return {
      isError: true,
      content: [{ type: "text", text: parts.join("\n") }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`logistics-mcp: connected (${baseUrl}, client ${clientId})`);
