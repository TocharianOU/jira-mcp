# Release Notes

## v1.0.0

Initial release.

### Tools
- `jira_health_check` – Test connection and verify Jira account/server info
- `search_issues` – JQL-based issue search
- `get_issue` – Full issue detail including description and comments
- `create_issue` – Create issues (incidents, tasks, bugs)
- `update_issue` – Update summary, description, priority, labels
- `add_comment` – Add investigation notes as comments
- `list_transitions` – Discover available status transitions
- `transition_issue` – Move issues through workflow states
- `list_projects` – List accessible Jira projects

### Authentication
- Jira Cloud: Email + API token (Basic Auth)
- Jira Server / Data Center: Personal Access Token (Bearer)
