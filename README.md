# Jira MCP Server

[![npm version](https://img.shields.io/npm/v/@tocharianou/jira-mcp)](https://www.npmjs.com/package/@tocharianou/jira-mcp)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for Jira — issue search, creation, updates, comments, status transitions, and project listing. Purpose-built for security incident management and SOC workflows.

## Quick Start

### Claude Desktop (stdio)

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@tocharianou/jira-mcp"],
      "env": {
        "JIRA_HOST": "https://yourorg.atlassian.net",
        "JIRA_EMAIL": "you@company.com",
        "JIRA_TOKEN": "<your-api-token>"
      }
    }
  }
}
```

Get your Jira API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).

### HTTP / Streamable mode

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3002 JIRA_HOST=https://yourorg.atlassian.net JIRA_EMAIL=you@company.com JIRA_TOKEN=<token> npx @tocharianou/jira-mcp
```

Then point your MCP client at `http://localhost:3002/mcp`.

## Features

- **Issue search** — JQL-powered queries for incidents, vulnerabilities, and tasks
- **Issue management** — create, update, comment, and transition issues
- **Incident tracking** — open security tickets directly from investigation findings
- **Project discovery** — list all accessible Jira projects
- **Token limiting** — built-in `MAX_TOKEN_CALL` guard prevents context overflow

## Configuration

| Environment variable | Required | Description |
|---|---|---|
| `JIRA_HOST` | ✓ | Jira Cloud: `https://yourorg.atlassian.net` / Server: `https://jira.company.com` |
| `JIRA_EMAIL` | ✓* | Atlassian account email (Cloud only; leave empty for Server/DC) |
| `JIRA_TOKEN` | ✓ | API token (Cloud) or Personal Access Token (Server/Data Center) |
| `JIRA_API_VERSION` | – | `3` for Cloud (default), `2` for Server/Data Center |
| `JIRA_VERIFY_SSL` | – | `true`/`false` (default: `true`) |
| `MAX_TOKEN_CALL` | – | Token limit per tool response (default: `20000`) |
| `MCP_TRANSPORT` | – | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | – | HTTP server port (default: `3002`) |
| `MCP_HTTP_HOST` | – | HTTP server host (default: `localhost`) |

\* `JIRA_EMAIL` is required for Jira Cloud. Leave empty for Jira Server / Data Center (use PAT only).

## Available Tools

| Tool | Description |
|------|-------------|
| `jira_health_check` | Test connection, verify account info and server version |
| `search_issues` | Search issues using JQL — find incidents, open vulnerabilities, remediation tasks |
| `get_issue` | Get full details of a single issue including comments and history |
| `create_issue` | Create a new issue (incident, task, bug, etc.) |
| `update_issue` | Update summary, description, priority, or labels |
| `add_comment` | Add a comment to record investigation findings |
| `list_transitions` | List available status transitions for an issue |
| `transition_issue` | Move an issue to a new status (e.g. In Progress, Resolved, Closed) |
| `list_projects` | List all accessible Jira projects with keys and types |

## Example Queries

- *"Search for all open critical security incidents in the SEC project"*
- *"Create a Jira ticket for the suspicious login activity from 192.168.1.100"*
- *"Get the full details of ticket SEC-1234 including all comments"*
- *"Move SEC-1234 to Resolved and add a closing comment with my findings"*
- *"List all Jira projects I have access to"*

## Debugging

Use the MCP Inspector to test and debug:

```bash
npm run inspector
```

Server logs are written to **stderr** so they do not interfere with the MCP JSON-RPC stream on stdout.

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| `401 Unauthorized` | Invalid `JIRA_TOKEN` or wrong `JIRA_EMAIL` |
| `403 Forbidden` | Insufficient permissions on the project |
| `404 Not Found` | Issue key or project does not exist |
| `ECONNREFUSED` | Wrong `JIRA_HOST` or Jira server not reachable |
| SSL errors | Set `JIRA_VERIFY_SSL=false` for self-signed certs (Server/DC only) |
| Token limit exceeded | Reduce `max_results` or set `break_token_rule: true` |

## Development

```bash
git clone https://github.com/TocharianOU/jira-mcp.git
cd jira-mcp
npm install --ignore-scripts
npm run build
cp .env.example .env   # fill in your credentials
npm start
```

## Release

See [RELEASE.md](RELEASE.md) for the full release process.

## License

Apache 2.0 — Copyright © 2024 TocharianOU Contributors
