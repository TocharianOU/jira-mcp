// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod';

export const JiraConfigSchema = z.object({
  host: z.string().optional().describe('Jira Cloud base URL (e.g. https://yourorg.atlassian.net). Overrides JIRA_HOST env var.'),
  email: z.string().optional().describe('Atlassian account email for Basic Auth. Overrides JIRA_EMAIL env var.'),
  token: z.string().optional().describe('Atlassian API token (Cloud) or Personal Access Token (Server/DC). Overrides JIRA_TOKEN env var.'),
  apiVersion: z.enum(['2', '3']).optional().describe('Jira REST API version. Use "3" for Jira Cloud (default), "2" for Jira Server/Data Center.'),
  verifySsl: z.boolean().optional().describe('Verify SSL certificate (default: true). Set false for self-signed certs.'),
  timeout: z.number().optional().describe('HTTP request timeout in ms (default: 30000).'),
});

export type JiraConfig = z.infer<typeof JiraConfigSchema>;

export interface JiraConnectionParams {
  baseUrl: string;
  authHeader: string;
  apiVersion: '2' | '3';
  verifySsl: boolean;
  timeout: number;
}
