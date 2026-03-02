// SPDX-License-Identifier: Apache-2.0
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JiraConfig } from './src/types.js';
import { handleHealthCheck } from './src/handlers/health.js';
import {
  handleSearchIssues,
  handleGetIssue,
  handleCreateIssue,
  handleUpdateIssue,
  handleAddComment,
  handleListTransitions,
  handleTransitionIssue,
  handleListProjects,
} from './src/handlers/issues.js';
import { checkTokenLimit } from './src/utils/token-limiter.js';

const DEFAULT_MAX_TOKENS = Number(process.env.MAX_TOKEN_CALL ?? 20000);

export function registerJiraTools(server: McpServer, config: JiraConfig) {
  // ── jira_health_check ─────────────────────────────────────────────────────
  server.tool(
    'jira_health_check',
    'Test the Jira connection. Returns authenticated account info (display name, email, account ID) and Jira server version/deployment type. Run first to verify credentials and connectivity.',
    {
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ max_tokens, break_token_rule }) => {
      try {
        const result = await handleHealthCheck(config);
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── search_issues ─────────────────────────────────────────────────────────
  server.tool(
    'search_issues',
    'Search Jira issues using JQL (Jira Query Language). Returns key, summary, status, type, priority, assignee, reporter, created/updated dates and labels. Use for finding security incidents, open vulnerabilities, or tracking remediation tasks. Examples: `project = SEC AND status != Done`, `assignee = currentUser() AND priority = High`, `labels = security-incident ORDER BY created DESC`.',
    {
      jql: z.string().describe('JQL query string. Examples: "project=SEC AND status=Open", "priority=Critical AND labels=security-incident ORDER BY created DESC"'),
      max_results: z.number().optional().describe('Maximum issues to return (default: 50, max: 100). Reduce if token limit hit.'),
      fields: z.array(z.string()).optional().describe('Specific fields to return. Default: summary,status,issuetype,priority,assignee,reporter,created,updated,labels. Add "description" for full text.'),
      start_at: z.number().optional().describe('Pagination offset (default: 0). Use with max_results to paginate large result sets.'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ jql, max_results, fields, start_at, max_tokens, break_token_rule }) => {
      try {
        const result = await handleSearchIssues(config, { jql, maxResults: max_results, fields, startAt: start_at });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── get_issue ─────────────────────────────────────────────────────────────
  server.tool(
    'get_issue',
    'Get full details of a single Jira issue by key (e.g. SEC-123). Returns description, all comments, status, priority, assignee, reporter, labels, and timestamps. Use after search_issues to inspect a specific issue in depth.',
    {
      issue_key: z.string().describe('Jira issue key (e.g. SEC-123, INFRA-456, PROJ-789).'),
      fields: z.array(z.string()).optional().describe('Specific fields to fetch. Default includes description and all comments.'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ issue_key, fields, max_tokens, break_token_rule }) => {
      try {
        const result = await handleGetIssue(config, { issueKey: issue_key, fields });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── create_issue ──────────────────────────────────────────────────────────
  server.tool(
    'create_issue',
    'Create a new Jira issue. Use to file security incidents, vulnerabilities, or remediation tasks. Returns the new issue key and URL. Common issue types: Task, Bug, Story, Incident, Security Incident (depends on project configuration).',
    {
      project_key: z.string().describe('Jira project key where the issue will be created (e.g. SEC, INFRA, OPS).'),
      summary: z.string().describe('Issue summary/title (one-line description of the incident or task).'),
      issue_type: z.string().optional().describe('Issue type name (default: Task). Examples: Task, Bug, Story, Incident. Must match a type available in the project.'),
      description: z.string().optional().describe('Full description of the issue. Plain text; will be formatted for Jira API version automatically.'),
      priority: z.string().optional().describe('Priority name. Examples: Critical, High, Medium, Low.'),
      assignee: z.string().optional().describe('Assignee Jira accountId (use search_issues to find accountIds or check with jira_health_check for your own).'),
      labels: z.array(z.string()).optional().describe('Labels to attach. Examples: ["security-incident", "ransomware", "P1"].'),
      components: z.array(z.string()).optional().describe('Component names to associate. Must match existing components in the project.'),
    },
    async ({ project_key, summary, issue_type, description, priority, assignee, labels, components }) => {
      try {
        const result = await handleCreateIssue(config, { projectKey: project_key, summary, issueType: issue_type, description, priority, assignee, labels, components });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── update_issue ──────────────────────────────────────────────────────────
  server.tool(
    'update_issue',
    'Update fields of an existing Jira issue (summary, description, priority, labels). Use to enrich a security incident with investigation findings. To change status, use transition_issue instead.',
    {
      issue_key: z.string().describe('Jira issue key to update (e.g. SEC-123).'),
      summary: z.string().optional().describe('New summary/title.'),
      description: z.string().optional().describe('New description text. Overwrites existing description.'),
      priority: z.string().optional().describe('New priority. Examples: Critical, High, Medium, Low.'),
      labels: z.array(z.string()).optional().describe('New labels array. Replaces existing labels entirely.'),
    },
    async ({ issue_key, summary, description, priority, labels }) => {
      try {
        const result = await handleUpdateIssue(config, { issueKey: issue_key, summary, description, priority, labels });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── add_comment ───────────────────────────────────────────────────────────
  server.tool(
    'add_comment',
    'Add a comment to a Jira issue. Use to record investigation steps, evidence, findings, or remediation actions directly on the ticket. Preserves the full audit trail of the security response.',
    {
      issue_key: z.string().describe('Jira issue key to comment on (e.g. SEC-123).'),
      comment: z.string().describe('Comment text. Markdown-like formatting is supported (bold, lists, code blocks will render in Jira).'),
    },
    async ({ issue_key, comment }) => {
      try {
        const result = await handleAddComment(config, { issueKey: issue_key, comment });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── list_transitions ──────────────────────────────────────────────────────
  server.tool(
    'list_transitions',
    'List all available status transitions for a Jira issue. Returns transition IDs and target status names. Use before transition_issue to find the correct transition ID (e.g. "In Progress", "Resolved", "Closed").',
    {
      issue_key: z.string().describe('Jira issue key (e.g. SEC-123).'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ issue_key, max_tokens, break_token_rule }) => {
      try {
        const result = await handleListTransitions(config, { issueKey: issue_key });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── transition_issue ──────────────────────────────────────────────────────
  server.tool(
    'transition_issue',
    'Move a Jira issue to a new status using a transition ID. Use list_transitions first to discover available transition IDs. Optionally attach a comment explaining the status change (e.g. "Closed: investigation complete, no compromise confirmed").',
    {
      issue_key: z.string().describe('Jira issue key to transition (e.g. SEC-123).'),
      transition_id: z.string().describe('Transition ID from list_transitions (e.g. "31" for "In Progress", "41" for "Done").'),
      comment: z.string().optional().describe('Optional comment to attach when transitioning (e.g. rationale for closing or escalating).'),
    },
    async ({ issue_key, transition_id, comment }) => {
      try {
        const result = await handleTransitionIssue(config, { issueKey: issue_key, transitionId: transition_id, comment });
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );

  // ── list_projects ─────────────────────────────────────────────────────────
  server.tool(
    'list_projects',
    'List all accessible Jira projects with their keys, names, and types. Use to find the correct project key before creating issues or running JQL queries scoped to a specific project.',
    {
      max_results: z.number().optional().describe('Maximum projects to return (default: 50, max: 100).'),
      max_tokens: z.number().optional().describe(`Max output tokens. Default: ${DEFAULT_MAX_TOKENS}.`),
      break_token_rule: z.boolean().optional().describe('Bypass token limit check.'),
    },
    async ({ max_results, max_tokens, break_token_rule }) => {
      try {
        const result = await handleListProjects(config, { maxResults: max_results });
        const check = checkTokenLimit(result, max_tokens ?? DEFAULT_MAX_TOKENS, break_token_rule);
        if (!check.allowed) return { content: [{ type: 'text', text: check.error! }], isError: true };
        return { content: [{ type: 'text', text: result }] };
      } catch (err: unknown) {
        return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true };
      }
    }
  );
}
