// electron/main/services/jira.services.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrappers around the Jira REST API v3.
// All functions are stateless — callers pass in the access token and cloudId.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';

const isDev = process.env.NODE_ENV !== 'production';

function jiraBase(cloudId: string): string {
    return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

// ── Projects ──────────────────────────────────────────────────────────────────

export interface JiraProject {
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    avatarUrls: Record<string, string>;
}

/**
 * Returns all projects the token has access to.
 * Used during onboarding to let the user pick their project.
 */
export async function getProjects(accessToken: string, cloudId: string): Promise<JiraProject[]> {
    if (isDev) console.log('[jira.services] getProjects cloudId:', cloudId);

    const res = await axios.get(`${jiraBase(cloudId)}/project/search`, {
        headers: authHeaders(accessToken),
        params: { maxResults: 100, orderBy: 'name' },
    });

    return (res.data.values ?? []).map((p: any): JiraProject => ({
        id: p.id,
        key: p.key,
        name: p.name,
        projectTypeKey: p.projectTypeKey,
        avatarUrls: p.avatarUrls ?? {},
    }));
}

// ── Issues ────────────────────────────────────────────────────────────────────

/**
 * Fetches all issues for the given project key using JQL.
 * Paginates automatically until all issues are retrieved.
 * Returns raw Jira issue objects — mapping to the Issue type happens in
 * stories.service.ts so that service owns the shape.
 */
export async function getJiraIssues(
    accessToken: string,
    cloudId: string,
    projectKey: string,
): Promise<any[]> {
    if (isDev) console.log('[jira.services] getJiraIssues project:', projectKey);

    const allIssues: any[] = [];
    const pageSize = 100;
    let nextPageToken: string | undefined = undefined;

    while (true) {
        const body: Record<string, any> = {
            jql: `project = "${projectKey}" ORDER BY updated DESC`,
            maxResults: pageSize,
            fields: [
                'summary',
                'status',
                'priority',
                'issuetype',
                'parent',
                'subtasks',
            ],
        };

        // Only include nextPageToken when paginating — omit it on the first request
        if (nextPageToken) {
            body.nextPageToken = nextPageToken;
        }

        const res = await axios.post(
            `${jiraBase(cloudId)}/search/jql`,
            body,
            {
                headers: {
                    ...authHeaders(accessToken),
                    'Content-Type': 'application/json',
                },
            },
        );

        const issues: any[] = res.data.issues ?? [];
        allIssues.push(...issues);

        // Stop when there's no next page token or we got a short page
        nextPageToken = res.data.nextPageToken;
        if (!nextPageToken || issues.length < pageSize) break;
    }

    if (isDev) console.log('[jira.services] fetched', allIssues.length, 'issues');
    return allIssues;
}