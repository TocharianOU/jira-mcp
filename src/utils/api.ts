// SPDX-License-Identifier: Apache-2.0
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { JiraConfig, JiraConnectionParams } from '../types.js';

export function buildConnectionParams(config: JiraConfig): JiraConnectionParams {
  const host = config.host ?? process.env.JIRA_HOST ?? '';
  if (!host) throw new Error('JIRA_HOST is required. Set it in env or pass as config.host.');

  const email = config.email ?? process.env.JIRA_EMAIL ?? '';
  const token = config.token ?? process.env.JIRA_TOKEN ?? '';
  if (!token) throw new Error('JIRA_TOKEN is required. Set it in env or pass as config.token.');

  // Basic Auth: email:token for Cloud, or just token for Server/DC PAT
  const authHeader = email
    ? `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    : `Bearer ${token}`;

  const apiVersion = config.apiVersion ?? (process.env.JIRA_API_VERSION as '2' | '3' | undefined) ?? '3';
  const verifySsl = config.verifySsl ?? (process.env.JIRA_VERIFY_SSL !== 'false');
  const timeout = config.timeout ?? Number(process.env.JIRA_TIMEOUT ?? 30000);

  // Normalize host (strip trailing slash)
  const baseUrl = host.replace(/\/$/, '');

  return { baseUrl, authHeader, apiVersion, verifySsl, timeout };
}

export function createJiraClient(params: JiraConnectionParams): AxiosInstance {
  return axios.create({
    baseURL: `${params.baseUrl}/rest/api/${params.apiVersion}`,
    timeout: params.timeout,
    headers: {
      Authorization: params.authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    httpsAgent: new https.Agent({ rejectUnauthorized: params.verifySsl }),
    validateStatus: () => true,
  });
}

export function assertOk(status: number, data: unknown, operation: string): void {
  if (status < 200 || status >= 300) {
    const errorMsg =
      (data as Record<string, unknown>)?.errorMessages ||
      (data as Record<string, unknown>)?.errors ||
      (data as Record<string, unknown>)?.message;
    throw new Error(`${operation} failed (HTTP ${status}): ${JSON.stringify(errorMsg ?? data)}`);
  }
}
