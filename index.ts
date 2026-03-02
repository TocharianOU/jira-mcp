#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { JiraConfig } from './src/types.js';
import { registerJiraTools } from './jira-tools.js';

const SERVER_NAME = 'jira-mcp';
const SERVER_VERSION = '1.0.0';

function buildConfig(): JiraConfig {
  return {
    host: process.env.JIRA_HOST,
    email: process.env.JIRA_EMAIL,
    token: process.env.JIRA_TOKEN,
    apiVersion: (process.env.JIRA_API_VERSION as '2' | '3') ?? '3',
    verifySsl: process.env.JIRA_VERIFY_SSL !== 'false',
    timeout: process.env.JIRA_TIMEOUT ? Number(process.env.JIRA_TIMEOUT) : 30000,
  };
}

async function main() {
  const config = buildConfig();
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerJiraTools(server, config);

  const transport = process.env.MCP_TRANSPORT ?? 'stdio';

  if (transport === 'http') {
    const port = Number(process.env.MCP_HTTP_PORT ?? 3009);
    const app = express();
    app.use(express.json());
    const httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => `session-${Date.now()}`,
    });
    app.all('/mcp', async (req, res) => { await httpTransport.handleRequest(req, res); });
    await server.connect(httpTransport);
    app.listen(port, () => {
      process.stderr.write(`[jira-mcp] HTTP transport listening on port ${port}\n`);
    });
  } else {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    process.stderr.write(`[jira-mcp] stdio transport ready\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`[jira-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
