// electron/main/services/githubOnboarding.service.ts
// Mirrors the structure of jiraOnboarding.service.ts exactly.
// Holds a pendingAccountId in memory between the OAuth connect step
// and the workspace:create call that consumes it.

import {
    startGitHubAuth,
    exchangeGitHubCode,
    storeGitHubTokens,
    getValidGitHubToken,
} from '../auth/github.auth';

import { getGitHubRepos, getGitHubUser } from './github.services';

let pendingGitAccountId: string | null = null;

export const githubOnboardingService = {

    /**
     * Step 1 — open GitHub OAuth in browser, wait for callback,
     * exchange code for token, store it under a new accountId.
     */
    async connect() {
        pendingGitAccountId = `github_account_${Date.now()}`;

        const code = await startGitHubAuth();
        const tokens = await exchangeGitHubCode(code);

        await storeGitHubTokens(pendingGitAccountId, tokens);

        // Also fetch and return the GitHub username for display in the modal
        const login = await getGitHubUser(tokens.access_token);

        return { success: true, login };
    },

    /**
     * Step 2 — fetch the repo list for the just-connected account.
     * pendingGitAccountId must be set (i.e. connect() was called first).
     */
    async getRepos() {
        if (!pendingGitAccountId) {
            throw new Error('No pending GitHub account — call connect() first');
        }

        const token = await getValidGitHubToken(pendingGitAccountId);
        const repos = await getGitHubRepos(token);

        return { repos };
    },

    /**
     * Called by ipcHandlers during workspace:create.
     * Returns the pendingGitAccountId and clears it so it can't be reused.
     */
    consumeAccountId(): string {
        if (!pendingGitAccountId) {
            throw new Error('No pending GitHub account to consume');
        }

        const id = pendingGitAccountId;
        pendingGitAccountId = null;

        return id;
    },
};