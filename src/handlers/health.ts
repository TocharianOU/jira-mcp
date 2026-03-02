// SPDX-License-Identifier: Apache-2.0
import { JiraConfig } from '../types.js';
import { buildConnectionParams, createJiraClient } from '../utils/api.js';

export async function handleHealthCheck(config: JiraConfig): Promise<string> {
  const params = buildConnectionParams(config);
  const client = createJiraClient(params);
  const lines: string[] = [];

  lines.push('Jira Connection Health');
  lines.push(`Host: ${params.baseUrl}`);
  lines.push(`API Version: v${params.apiVersion}`);
  lines.push('');

  // Test via /myself
  const myselfResp = await client.get('/myself');
  if (myselfResp.status !== 200) {
    lines.push(`❌ Connection FAILED (HTTP ${myselfResp.status})`);
    const err = myselfResp.data as Record<string, unknown>;
    if (err?.errorMessages) lines.push(`Error: ${JSON.stringify(err.errorMessages)}`);
    lines.push('');
    lines.push('Troubleshooting:');
    lines.push('  • Verify JIRA_HOST (e.g. https://yourorg.atlassian.net)');
    lines.push('  • For Cloud: JIRA_EMAIL (account email) + JIRA_TOKEN (API token from id.atlassian.com)');
    lines.push('  • For Server/DC: JIRA_TOKEN (Personal Access Token), leave JIRA_EMAIL empty');
    lines.push('  • For self-signed certs: set JIRA_VERIFY_SSL=false');
    return lines.join('\n');
  }

  const me = myselfResp.data as Record<string, unknown>;
  lines.push('✅ Connection successful');
  lines.push('');
  lines.push(`Account:      ${me['displayName'] ?? 'unknown'}`);
  lines.push(`Email:        ${me['emailAddress'] ?? 'N/A'}`);
  lines.push(`Account ID:   ${me['accountId'] ?? 'N/A'}`);
  lines.push(`Account Type: ${me['accountType'] ?? 'N/A'}`);
  lines.push('');

  // Get server info
  const infoResp = await client.get('/serverInfo');
  if (infoResp.status === 200) {
    const info = infoResp.data as Record<string, unknown>;
    lines.push(`Jira Version:  ${info['version'] ?? 'unknown'}`);
    lines.push(`Build:         ${info['buildNumber'] ?? 'unknown'}`);
    lines.push(`Deployment:    ${info['deploymentType'] ?? 'unknown'}`);
    lines.push(`Server Title:  ${info['serverTitle'] ?? 'unknown'}`);
    lines.push('');
  }

  lines.push('Use search_issues with JQL to query issues, create_issue to file new security incidents.');
  return lines.join('\n');
}
