/**
 * Dev agent queue API (GitHub Issues backend). Requires admin or QA (see server `requireAdminOrQa`).
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { safeResolveUnderFeaturesRoot } from '../sanitize-feature-source-path.js';
import {
  buildDevAgentIssueBody,
  createIssue,
  extractDevAgentPathFromIssueTitle,
  filterIssuesByDevAgentPath,
  getDevAgentStateLabel,
  getGithubTokenFromEnv,
  isGithubIssueWriteForbidden,
  getPullRequest,
  extractPullNumberFromText,
  listIssueComments,
  listOpenDevAgentIssuesForApi,
  parseDevAgentMetadataFromIssueBody,
  patchIssueLabels,
  resolveGithubRepository,
  DEV_AGENT_LABEL_OWNER,
  DEV_AGENT_STATE_LABELS,
} from '../dev-agent-github.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FEATURES_V2_ROOT = join(__dirname, '..', 'features-v2');

export function isDevAgentQueueEnabled() {
  return process.env.DEV_AGENT_QUEUE_ENABLED === '1';
}

function devAgentDisabled(res) {
  return res.status(404).json({ error: 'Dev agent queue is not enabled' });
}

function githubNotConfigured(res) {
  return res.status(503).json({ error: 'GitHub is not configured (GITHUB_REPOSITORY + GITHUB_TOKEN or GH_TOKEN)' });
}

/**
 * @param {import('express').Application} app
 * @param {{ requireAuth: Function, requireAdminOrQa: Function }} mw
 */
export function registerDevAgentRoutes(app, { requireAuth, requireAdminOrQa }) {
  app.post('/api/dev-agent/queue', requireAuth, requireAdminOrQa, async (req, res) => {
    if (!isDevAgentQueueEnabled()) return devAgentDisabled(res);

    const token = getGithubTokenFromEnv();
    const repoFull = resolveGithubRepository();
    if (!token || !repoFull) return githubNotConfigured(res);

    const pathRaw = typeof req.body?.path === 'string' ? req.body.path : '';
    const kind = req.body?.kind;
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    const allowedKinds = new Set(['bug', 'feature', 'other']);
    if (!allowedKinds.has(kind)) {
      return res.status(400).json({ error: 'kind must be bug, feature, or other' });
    }

    const abs = safeResolveUnderFeaturesRoot(FEATURES_V2_ROOT, pathRaw);
    if (!abs) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const normalizedPath = pathRaw.trim().replace(/\\/g, '/');

    const [owner, repo] = repoFull.split('/');
    const title = `[dh-dev-agent] ${kind}: ${normalizedPath}`;
    const body = buildDevAgentIssueBody({
      path: normalizedPath,
      kind,
      message,
      submittedAt: new Date().toISOString(),
    });

    try {
      const issue = await createIssue(owner, repo, token, {
        title,
        body,
        labels: [DEV_AGENT_LABEL_OWNER, DEV_AGENT_STATE_LABELS.queued],
      });
      // GitHub may silently drop labels if the token lacks permission; PATCH so list/search finds the issue.
      const names = (issue.labels || []).map((l) => l.name);
      const hasBoth =
        names.includes(DEV_AGENT_LABEL_OWNER) && names.includes(DEV_AGENT_STATE_LABELS.queued);
      if (!hasBoth) {
        await patchIssueLabels(owner, repo, issue.number, token, [
          DEV_AGENT_LABEL_OWNER,
          DEV_AGENT_STATE_LABELS.queued,
        ]);
      }
      return res.json({
        issueUrl: issue.html_url,
        issueNumber: issue.number,
      });
    } catch (err) {
      if (isGithubIssueWriteForbidden(err)) {
        return res.status(403).json({
          error:
            'GitHub denied writing issues/labels with this token. Use a classic PAT with `repo` scope, or a fine-grained PAT with Issues Read+Write on this repository. If the org uses SSO, authorize the token for the org (GitHub → Settings → Developer settings → token → Configure SSO).',
        });
      }
      console.error('POST /api/dev-agent/queue failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to create issue' });
    }
  });

  app.get('/api/dev-agent/issues', requireAuth, requireAdminOrQa, async (req, res) => {
    if (!isDevAgentQueueEnabled()) return devAgentDisabled(res);

    const token = getGithubTokenFromEnv();
    const repoFull = resolveGithubRepository();
    if (!token || !repoFull) return githubNotConfigured(res);

    const pathFilter =
      typeof req.query.path === 'string' && req.query.path.trim()
        ? req.query.path.trim().replace(/\\/g, '/')
        : null;

    const [owner, repo] = repoFull.split('/');

    try {
      const issues = await listOpenDevAgentIssuesForApi(owner, repo, token);
      const filtered = pathFilter ? filterIssuesByDevAgentPath(issues, pathFilter) : issues;

      const out = [];
      for (const iss of filtered) {
        const meta = parseDevAgentMetadataFromIssueBody(iss.body || '');
        const names = (iss.labels || []).map((l) => l.name).filter(Boolean);
        const stateLabel = getDevAgentStateLabel(names);

        let prNumber = null;
        let prUrl = null;
        let merged = null;

        const rawComments = await listIssueComments(owner, repo, iss.number, token).catch(() => []);
        const comments = Array.isArray(rawComments) ? rawComments : [];
        for (const c of comments) {
          const n = extractPullNumberFromText(c.body || '');
          if (n != null) {
            prNumber = n;
            prUrl = `https://github.com/${owner}/${repo}/pull/${n}`;
            break;
          }
        }
        if (prNumber != null) {
          try {
            const pr = await getPullRequest(owner, repo, prNumber, token);
            merged = pr.merged === true;
            prUrl = pr.html_url || prUrl;
          } catch {
            merged = null;
          }
        }

        out.push({
          number: iss.number,
          htmlUrl: iss.html_url,
          title: iss.title,
          stateLabel,
          state: iss.state,
          path: meta?.path ?? extractDevAgentPathFromIssueTitle(iss.title || '') ?? null,
          kind: meta?.kind ?? null,
          submittedAt: meta?.submittedAt ?? null,
          prNumber,
          prUrl,
          merged,
        });
      }

      return res.json({ issues: out });
    } catch (err) {
      console.error('GET /api/dev-agent/issues failed:', err);
      return res.status(500).json({ error: err?.message || 'Failed to list issues' });
    }
  });
}
