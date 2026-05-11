// electron/main/services/githubOnboarding.service.ts
import {
    startGitHubAuth,
    exchangeGitHubCode,
    storeGitHubTokens,
    getValidGitHubToken,
    getGitHubHost,
} from '../auth/github.auth';
import { getAllRepos, getGitHubUser } from './github.services';

let pendingGitAccountId: string | null = null;

export const githubOnboardingService = {

    async connect(hostname?: string) {
        const host = (hostname?.trim() || 'github.com').toLowerCase();
        pendingGitAccountId = `github_account_${Date.now()}`;

        const code = await startGitHubAuth();
        const tokens = await exchangeGitHubCode(code);
        await storeGitHubTokens(pendingGitAccountId, tokens, host);

        const login = await getGitHubUser(tokens.access_token, host);
        return { success: true, login, host };
    },

    async getRepos() {
        if (!pendingGitAccountId) throw new Error('No pending GitHub account — call connect() first');

        const token = await getValidGitHubToken(pendingGitAccountId);
        const host = await getGitHubHost(pendingGitAccountId);
        const login = await getGitHubUser(token, host);
        const all = await getAllRepos(token, host);

        const mine = all.filter(r => r.fullName.startsWith(`${login}/`));
        const orgs = all.filter(r => !r.fullName.startsWith(`${login}/`));

        return { repos: all, mine, orgs, login, host };
    },

    // Returns accountId WITHOUT clearing it — used by github:getRepoByUrl
    // so the user can validate a repo URL before committing to workspace:create.
    peekAccountId(): string {
        if (!pendingGitAccountId) throw new Error('No pending GitHub account');
        return pendingGitAccountId;
    },

    // Returns accountId AND clears it — called once during workspace:create.
    consumeAccountId(): string {
        if (!pendingGitAccountId) throw new Error('No pending GitHub account to consume');
        const id = pendingGitAccountId;
        pendingGitAccountId = null;
        return id;
    },
};