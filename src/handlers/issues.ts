// SPDX-License-Identifier: Apache-2.0
import { JiraConfig } from '../types.js';
import { buildConnectionParams, createJiraClient, assertOk } from '../utils/api.js';

export interface SearchIssuesArgs {
  jql: string;
  maxResults?: number;
  fields?: string[];
  startAt?: number;
}

export interface GetIssueArgs {
  issueKey: string;
  fields?: string[];
}

export interface CreateIssueArgs {
  projectKey: string;
  summary: string;
  issueType?: string;
  description?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  components?: string[];
}

export interface UpdateIssueArgs {
  issueKey: string;
  summary?: string;
  description?: string;
  priority?: string;
  labels?: string[];
}

export interface AddCommentArgs {
  issueKey: string;
  comment: string;
}

export interface TransitionIssueArgs {
  issueKey: string;
  transitionId: string;
  comment?: string;
}

export interface ListTransitionsArgs {
  issueKey: string;
}

export interface ListProjectsArgs {
  maxResults?: number;
  orderBy?: string;
}

function formatIssue(issue: Record<string, unknown>, verbose = true): string[] {
  const fields = (issue.fields as Record<string, unknown>) ?? {};
  const lines: string[] = [];

  lines.push(`Key:         ${issue.key}`);
  lines.push(`Summary:     ${fields.summary ?? 'N/A'}`);
  lines.push(`Status:      ${(fields.status as Record<string, unknown>)?.name ?? 'N/A'}`);
  lines.push(`Type:        ${(fields.issuetype as Record<string, unknown>)?.name ?? 'N/A'}`);
  lines.push(`Priority:    ${(fields.priority as Record<string, unknown>)?.name ?? 'N/A'}`);
  lines.push(`Assignee:    ${(fields.assignee as Record<string, unknown>)?.displayName ?? 'Unassigned'}`);
  lines.push(`Reporter:    ${(fields.reporter as Record<string, unknown>)?.displayName ?? 'N/A'}`);
  lines.push(`Created:     ${fields.created ?? 'N/A'}`);
  lines.push(`Updated:     ${fields.updated ?? 'N/A'}`);

  const labels = fields.labels as string[] | undefined;
  if (labels?.length) lines.push(`Labels:      ${labels.join(', ')}`);

  if (verbose) {
    // Description
    const desc = fields.description;
    if (desc) {
      const descText = extractText(desc);
      if (descText) {
        lines.push('');
        lines.push('Description:');
        lines.push(descText.length > 1000 ? descText.substring(0, 1000) + '…' : descText);
      }
    }

    // Comments
    const comments = (fields.comment as Record<string, unknown>)?.comments as Record<string, unknown>[] | undefined;
    if (comments?.length) {
      lines.push('');
      lines.push(`Comments (${comments.length}):`);
      for (const c of comments.slice(0, 5)) {
        const author = (c.author as Record<string, unknown>)?.displayName ?? 'Unknown';
        const body = extractText(c.body);
        lines.push(`  [${c.created}] ${author}: ${body.length > 200 ? body.substring(0, 200) + '…' : body}`);
      }
      if (comments.length > 5) lines.push(`  … and ${comments.length - 5} more comments`);
    }
  }

  return lines;
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!content || typeof content !== 'object') return '';
  // Jira API v3 returns Atlassian Document Format (ADF)
  const doc = content as Record<string, unknown>;
  if (doc.type === 'doc' && Array.isArray(doc.content)) {
    return (doc.content as Record<string, unknown>[]).map(extractText).join('\n');
  }
  if (doc.type === 'paragraph' && Array.isArray(doc.content)) {
    return (doc.content as Record<string, unknown>[]).map(extractText).join('');
  }
  if (doc.type === 'text') return String(doc.text ?? '');
  if (doc.type === 'hardBreak') return '\n';
  if (doc.type === 'heading' && Array.isArray(doc.content)) {
    return (doc.content as Record<string, unknown>[]).map(extractText).join('') + '\n';
  }
  if (doc.type === 'bulletList' || doc.type === 'orderedList') {
    return (doc.content as Record<string, unknown>[])?.map(extractText).join('') ?? '';
  }
  if (doc.type === 'listItem' && Array.isArray(doc.content)) {
    return '• ' + (doc.content as Record<string, unknown>[]).map(extractText).join('');
  }
  if (doc.type === 'codeBlock' && Array.isArray(doc.content)) {
    return '```\n' + (doc.content as Record<string, unknown>[]).map(extractText).join('') + '\n```';
  }
  if (Array.isArray(doc.content)) {
    return (doc.content as Record<string, unknown>[]).map(extractText).join('');
  }
  return '';
}

function buildDescriptionBody(text: string, apiVersion: '2' | '3'): unknown {
  if (apiVersion === '3') {
    // ADF format for v3
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    };
  }
  // Plain text for v2
  return text;
}

export async function handleSearchIssues(config: JiraConfig, args: SearchIssuesArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const maxResults = Math.min(args.maxResults ?? 50, 100);
  const defaultFields = ['summary', 'status', 'issuetype', 'priority', 'assignee', 'reporter', 'created', 'updated', 'labels'];
  const fields = args.fields ?? defaultFields;

  const resp = await client.get('/search', {
    params: {
      jql: args.jql,
      maxResults,
      startAt: args.startAt ?? 0,
      fields: fields.join(','),
    },
  });
  assertOk(resp.status, resp.data, 'Search issues');

  const data = resp.data as Record<string, unknown>;
  const issues = (data.issues as Record<string, unknown>[]) ?? [];
  const total = data.total as number;

  const lines: string[] = [];
  lines.push(`Jira Issue Search`);
  lines.push(`JQL:     ${args.jql}`);
  lines.push(`Total:   ${total} (showing ${issues.length})`);
  lines.push('');

  if (issues.length === 0) {
    lines.push('No issues found matching the JQL query.');
    return lines.join('\n');
  }

  for (const issue of issues) {
    lines.push('─'.repeat(60));
    lines.push(...formatIssue(issue, false));
  }

  if (total > issues.length) {
    lines.push('');
    lines.push(`Note: ${total - issues.length} more issues. Use startAt to paginate or narrow the JQL.`);
  }

  return lines.join('\n');
}

export async function handleGetIssue(config: JiraConfig, args: GetIssueArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const defaultFields = ['summary', 'status', 'issuetype', 'priority', 'assignee', 'reporter', 'created', 'updated', 'labels', 'description', 'comment'];
  const fieldsParam = (args.fields ?? defaultFields).join(',');

  const resp = await client.get(`/issue/${args.issueKey}`, { params: { fields: fieldsParam } });
  assertOk(resp.status, resp.data, `Get issue ${args.issueKey}`);

  const issue = resp.data as Record<string, unknown>;
  const lines: string[] = [];
  lines.push(`Issue: ${args.issueKey}`);
  lines.push(`URL:   ${params.baseUrl}/browse/${args.issueKey}`);
  lines.push('');
  lines.push(...formatIssue(issue, true));

  return lines.join('\n');
}

export async function handleCreateIssue(config: JiraConfig, args: CreateIssueArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const body: Record<string, unknown> = {
    fields: {
      project: { key: args.projectKey },
      summary: args.summary,
      issuetype: { name: args.issueType ?? 'Task' },
    },
  };

  const fields = body.fields as Record<string, unknown>;

  if (args.description) {
    fields.description = buildDescriptionBody(args.description, params.apiVersion);
  }
  if (args.priority) fields.priority = { name: args.priority };
  if (args.assignee) fields.assignee = { accountId: args.assignee };
  if (args.labels?.length) fields.labels = args.labels;
  if (args.components?.length) fields.components = args.components.map(c => ({ name: c }));

  const resp = await client.post('/issue', body);
  assertOk(resp.status, resp.data, 'Create issue');

  const created = resp.data as Record<string, unknown>;
  const lines: string[] = [];
  lines.push('✅ Issue created successfully');
  lines.push('');
  lines.push(`Key:  ${created.key}`);
  lines.push(`URL:  ${params.baseUrl}/browse/${created.key}`);
  lines.push(`ID:   ${created.id}`);

  return lines.join('\n');
}

export async function handleUpdateIssue(config: JiraConfig, args: UpdateIssueArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const fields: Record<string, unknown> = {};
  if (args.summary) fields.summary = args.summary;
  if (args.description) fields.description = buildDescriptionBody(args.description, params.apiVersion);
  if (args.priority) fields.priority = { name: args.priority };
  if (args.labels) fields.labels = args.labels;

  const resp = await client.put(`/issue/${args.issueKey}`, { fields });
  if (resp.status === 204 || resp.status === 200) {
    return `✅ Issue ${args.issueKey} updated successfully.\nURL: ${params.baseUrl}/browse/${args.issueKey}`;
  }
  assertOk(resp.status, resp.data, `Update issue ${args.issueKey}`);
  return '';
}

export async function handleAddComment(config: JiraConfig, args: AddCommentArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const body = {
    body: buildDescriptionBody(args.comment, params.apiVersion),
  };

  const resp = await client.post(`/issue/${args.issueKey}/comment`, body);
  assertOk(resp.status, resp.data, `Add comment to ${args.issueKey}`);

  const comment = resp.data as Record<string, unknown>;
  return `✅ Comment added to ${args.issueKey}\nComment ID: ${comment.id}\nURL: ${params.baseUrl}/browse/${args.issueKey}`;
}

export async function handleListTransitions(config: JiraConfig, args: ListTransitionsArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const resp = await client.get(`/issue/${args.issueKey}/transitions`);
  assertOk(resp.status, resp.data, `List transitions for ${args.issueKey}`);

  const data = resp.data as Record<string, unknown>;
  const transitions = (data.transitions as Record<string, unknown>[]) ?? [];

  const lines: string[] = [];
  lines.push(`Available Transitions for ${args.issueKey}`);
  lines.push('');

  if (transitions.length === 0) {
    lines.push('No transitions available (check permissions).');
    return lines.join('\n');
  }

  for (const t of transitions) {
    const to = (t.to as Record<string, unknown>)?.name ?? 'Unknown';
    lines.push(`ID: ${t.id}  →  ${t.name}  (to: ${to})`);
  }
  lines.push('');
  lines.push('Use transition_issue with the ID above to change the issue status.');

  return lines.join('\n');
}

export async function handleTransitionIssue(config: JiraConfig, args: TransitionIssueArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const body: Record<string, unknown> = {
    transition: { id: args.transitionId },
  };

  if (args.comment) {
    body.update = {
      comment: [{ add: { body: buildDescriptionBody(args.comment, params.apiVersion) } }],
    };
  }

  const resp = await client.post(`/issue/${args.issueKey}/transitions`, body);
  if (resp.status === 204 || resp.status === 200) {
    return `✅ Issue ${args.issueKey} transitioned successfully.\nURL: ${params.baseUrl}/browse/${args.issueKey}`;
  }
  assertOk(resp.status, resp.data, `Transition issue ${args.issueKey}`);
  return '';
}

export async function handleListProjects(config: JiraConfig, args: ListProjectsArgs): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);

  const maxResults = Math.min(args.maxResults ?? 50, 100);
  const resp = await client.get('/project/search', {
    params: {
      maxResults,
      orderBy: args.orderBy ?? 'name',
      expand: 'description',
    },
  });
  assertOk(resp.status, resp.data, 'List projects');

  const data = resp.data as Record<string, unknown>;
  const projects = (data.values as Record<string, unknown>[]) ?? [];

  const lines: string[] = [];
  lines.push('Jira Projects');
  lines.push(`Total: ${data.total ?? projects.length}`);
  lines.push('');

  if (projects.length === 0) {
    lines.push('No projects found (check permissions).');
    return lines.join('\n');
  }

  for (const p of projects) {
    const type = (p.projectTypeKey as string) ?? 'unknown';
    lines.push(`${p.key}  ${p.name}  [${type}]`);
    if (p.description) {
      const desc = String(p.description).trim();
      if (desc) lines.push(`      ${desc.length > 100 ? desc.substring(0, 100) + '…' : desc}`);
    }
  }

  return lines.join('\n');
}
