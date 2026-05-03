// electron/main/services/jira.services.ts
import axios from 'axios';

const isDev = process.env.NODE_ENV !== 'production';

export async function getJiraIssues(
    accessToken: string,
    cloudId: string,
    projectKey: string
) {
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql`;

    if (isDev) {
        console.log('[jira.services] getJiraIssues URL:', url);
        console.log('[jira.services] projectKey:', projectKey);
    }

    try {
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
                jql: `project = ${projectKey} ORDER BY created DESC`,
                maxResults: 50,
                fields: 'summary,status,assignee,priority,issuetype',
            },
        });

        if (isDev) console.log('[jira.services] getIssues status:', res.status, '— issues returned:', res.data.issues?.length);

        return res.data.issues ?? [];

    } catch (err: any) {
        if (isDev) {
            console.error('[jira.services] getIssues FAILED');
            console.error('[jira.services] status :', err.response?.status);
            console.error('[jira.services] data   :', JSON.stringify(err.response?.data, null, 2));
        }
        throw err;
    }
}

export async function getProjects(
    accessToken: string,
    cloudId: string
) {
    const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`;

    if (isDev) console.log('[jira.services] getProjects URL:', url);

    try {
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (isDev) console.log('[jira.services] getProjects — returned:', res.data?.length, 'projects');

        return res.data;

    } catch (err: any) {
        if (isDev) {
            console.error('[jira.services] getProjects FAILED');
            console.error('[jira.services] status:', err.response?.status);
            console.error('[jira.services] data  :', JSON.stringify(err.response?.data, null, 2));
        }
        throw err;
    }
}