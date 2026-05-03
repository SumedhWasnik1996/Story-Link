import {
    startJiraAuth,
    exchangeCode,
    storeTokens,
    getValidAccessToken,
    getCloudId,
} from '../auth/jira.auth';

import { getProjects } from './jira.services';

let pendingAccountId: string | null = null;

export const jiraOnboardingService = {

    async connect() {
        pendingAccountId = `jira_account_${Date.now()}`;

        const code = await startJiraAuth();
        const tokens = await exchangeCode(code);

        await storeTokens(pendingAccountId, tokens);

        return { success: true };
    },

    async getProjects() {
        if (!pendingAccountId) {
            throw new Error('No pending account');
        }

        const token = await getValidAccessToken(pendingAccountId);
        const cloudId = await getCloudId(token);

        const projects = await getProjects(token, cloudId);

        return { projects };
    },

    consumeAccountId() {
        if (!pendingAccountId) {
            throw new Error('No pending account');
        }

        const id = pendingAccountId;
        pendingAccountId = null;

        return id;
    },
};