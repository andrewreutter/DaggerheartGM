/**
 * Dev agent queue: GitHub Issues as durable job store + shared helpers (server + worker).
 * @see .cursor/plans/dev-agent-feature-source.plan.md
 */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo root for `git -C` (this file lives in `src/`). */
const GIT_CWD = join(dirname(fileURLToPath(import.meta.url)), '..');

export const DEV_AGENT_LABEL_OWNER = 'dh-dev-agent';

/** Exactly one should be present on an open active job (swap on transition). */
export const DEV_AGENT_STATE_LABELS = {
  queued: 'dh-agent-queued',
  running: 'dh-agent-running',
  awaitingHuman: 'dh-agent-awaiting-human',
  failed: 'dh-agent-failed',
};

const STATE_LABEL_SET = new Set(Object.values(DEV_AGENT_STATE_LABELS));

/**
 * @param {string} body
 * @returns {{ v: number, path: string, kind: string, submittedAt: string } | null}
 */
export function parseDevAgentMetadataFromIssueBody(body) {
  if (typeof body !== 'string' || !body.trim()) return null;
  const trimmed = body.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1].trim() : trimmed.split(/\n\n+/)[0];
  try {
    const obj = JSON.parse(candidate);
    if (obj && obj.v === 1 && typeof obj.path === 'string') {
      return {
        v: 1,
        path: obj.path.replace(/\\/g, '/'),
        kind: typeof obj.kind === 'string' ? obj.kind : 'other',
        submittedAt: typeof obj.submittedAt === 'string' ? obj.submittedAt : '',
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {{ path: string, kind: string, message: string, submittedAt?: string }} p
 */
export function buildDevAgentIssueBody({ path, kind, message, submittedAt }) {
  const meta = {
    v: 1,
    path: path.replace(/\\/g, '/'),
    kind,
    submittedAt: submittedAt || new Date().toISOString(),
  };
  const json = JSON.stringify(meta, null, 0);
  const user = typeof message === 'string' ? message.trim() : '';
  return '```json\n' + json + '\n```\n\n' + (user || '_(no message)_');
}

/**
 * @param {string[]} labelNames
 * @returns {string | null}
 */
export function getDevAgentStateLabel(labelNames) {
  if (!Array.isArray(labelNames)) return null;
  for (const n of labelNames) {
    if (STATE_LABEL_SET.has(n)) return n;
  }
  return null;
}

/**
 * Replace the single dh-agent-* state label (keeps dh-dev-agent and any other labels).
 * @param {string[]} currentLabelNames
 * @param {string | null} newStateLabel — one of DEV_AGENT_STATE_LABELS or null to strip all state labels
 * @returns {string[]}
 */
export function replaceDevAgentStateLabel(currentLabelNames, newStateLabel) {
  const base = (currentLabelNames || []).filter((n) => !STATE_LABEL_SET.has(n));
  if (newStateLabel && STATE_LABEL_SET.has(newStateLabel)) {
    base.push(newStateLabel);
  }
  return base;
}

/**
 * Resolves `owner/repo` for the GitHub REST API.
 *
 * **Prefers `git remote get-url origin`** when the app runs inside a clone (always matches the repo you
 * actually have). `GITHUB_REPOSITORY` is only used when git is unavailable (e.g. some CI) or does not
 * point at github.com — so a wrong `GITHUB_REPOSITORY` in `.env` cannot override a correct origin.
 *
 * @param {string} [env.GITHUB_REPOSITORY] — optional fallback `owner/repo`
 * @returns {string | null}
 */
export function resolveGithubRepository(env = process.env) {
  const fromEnv = (env.GITHUB_REPOSITORY || '').trim();
  const envOk = fromEnv && /^[\w.-]+\/[\w.-]+$/.test(fromEnv);

  try {
    const url = execSync('git remote get-url origin', { encoding: 'utf8', cwd: GIT_CWD }).trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
    if (m) return m[1].replace(/\.git$/, '');
  } catch {
    /* no .git or not a clone */
  }

  if (envOk) return fromEnv;
  return null;
}

export function getGithubTokenFromEnv(env = process.env) {
  const t = (env.GITHUB_TOKEN || env.GH_TOKEN || '').trim();
  return t || null;
}

/** True when GitHub rejected the call with 403 (wrong PAT scopes, fine-grained repo access, or org SSO not authorized). */
export function isGithubIssueWriteForbidden(err) {
  const m = String(err?.message || '');
  return /\b403\b/.test(m) && /not accessible|permission|denied|forbidden/i.test(m);
}

async function ghFetch(path, token, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    const msg = json?.message || text || res.statusText;
    throw new Error(`GitHub ${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

/**
 * @returns {Promise<object[]>}
 */
export async function listIssuesByLabels(owner, repo, token, { labels, state = 'open' }) {
  const labelParam = Array.isArray(labels) ? labels.join(',') : String(labels);
  const out = [];
  let page = 1;
  for (;;) {
    const q = new URLSearchParams({
      state,
      labels: labelParam,
      per_page: '100',
      page: String(page),
      sort: 'created',
      direction: 'asc',
    });
    const path = `/repos/${owner}/${repo}/issues?${q}`;
    const batch = await ghFetch(path, token);
    if (!Array.isArray(batch) || batch.length === 0) break;
    // Exclude pull requests (listed as issues when using issues API)
    const issuesOnly = batch.filter((it) => !it.pull_request);
    out.push(...issuesOnly);
    if (batch.length < 100) break;
    page += 1;
    if (page > 20) break;
  }
  return out;
}

/**
 * Build a GitHub issue search query: open issues in repo with ALL given labels (AND).
 * Prefer {@link searchOpenIssuesInRepo} over REST ?labels= for reliability with custom labels.
 */
export function buildOpenIssuesSearchQuery(owner, repo, labels) {
  const parts = [`repo:${owner}/${repo}`, 'is:issue', 'is:open'];
  for (const lb of labels) {
    const s = String(lb);
    parts.push(/\s/.test(s) ? `label:"${s.replace(/"/g, '\\"')}"` : `label:${s}`);
  }
  return parts.join(' ');
}

/**
 * GitHub Search Issues API (paginated). Excludes PRs.
 * @param {string} q — full search query (e.g. from {@link buildOpenIssuesSearchQuery})
 */
export async function searchIssuesByQuery(token, q) {
  const out = [];
  let page = 1;
  for (;;) {
    const sp = new URLSearchParams({
      q,
      per_page: '100',
      page: String(page),
      sort: 'created',
      order: 'asc',
    });
    const data = await ghFetch(`/search/issues?${sp.toString()}`, token);
    const items = Array.isArray(data?.items) ? data.items : [];
    out.push(...items.filter((it) => !it.pull_request));
    if (items.length < 100) break;
    page += 1;
    if (page > 10) break;
  }
  return out;
}

/**
 * Search API (paginated). Excludes PRs. More reliable than GET /issues?labels= for dev-agent labels.
 */
export async function searchOpenIssuesInRepo(owner, repo, token, labels) {
  const q = buildOpenIssuesSearchQuery(owner, repo, labels);
  return searchIssuesByQuery(token, q);
}

/**
 * Dedupe by issue number; oldest created first.
 * @param {...object[][]} lists
 */
export function mergeIssuesByNumber(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const iss of list || []) {
      if (!iss || iss.pull_request) continue;
      map.set(iss.number, iss);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

/**
 * Open dev-agent issues: labeled `dh-dev-agent` OR title contains `dh-dev-agent` (heals GitHub silently dropping labels on create).
 */
export async function listOpenDevAgentIssuesForApi(owner, repo, token) {
  const labeled = await searchIssuesByQuery(
    token,
    buildOpenIssuesSearchQuery(owner, repo, [DEV_AGENT_LABEL_OWNER]),
  ).catch(() => []);
  const titleMatch = await searchIssuesByQuery(
    token,
    `repo:${owner}/${repo} is:issue is:open in:title dh-dev-agent`,
  ).catch(() => []);
  return mergeIssuesByNumber(labeled, titleMatch);
}

/**
 * Issues that look like dev-agent queue jobs (queued). Labeled path OR title marker + missing labels recovery uses same list sources.
 */
export async function listOpenQueuedDevAgentIssuesForWorker(owner, repo, token) {
  const labeled = await searchIssuesByQuery(
    token,
    buildOpenIssuesSearchQuery(owner, repo, [DEV_AGENT_LABEL_OWNER, DEV_AGENT_STATE_LABELS.queued]),
  ).catch(() => []);
  const titleMatch = await searchIssuesByQuery(
    token,
    `repo:${owner}/${repo} is:issue is:open in:title dh-dev-agent`,
  ).catch(() => []);
  const merged = mergeIssuesByNumber(labeled, titleMatch);
  return merged.filter((iss) => {
    const names = (iss.labels || []).map((l) => l.name);
    if (names.includes(DEV_AGENT_STATE_LABELS.queued)) return true;
    const st = getDevAgentStateLabel(names);
    if (st && st !== DEV_AGENT_STATE_LABELS.queued) return false;
    return (iss.title || '').includes('[dh-dev-agent]') && !st;
  });
}

/**
 * If an open issue has our title/body metadata but is missing `dh-dev-agent` (labels were dropped on create), PATCH labels.
 * When no state label exists, infers `awaiting-human` from a PR link in comments so we do not reset a post-PR issue to `queued`.
 */
export async function repairDroppedDevAgentLabels(owner, repo, issue, token) {
  const names = (issue.labels || []).map((l) => l.name);
  if (names.includes(DEV_AGENT_LABEL_OWNER)) return issue;
  const meta = parseDevAgentMetadataFromIssueBody(issue.body || '');
  if (!meta?.path) return issue;
  if (!(issue.title || '').includes('[dh-dev-agent]')) return issue;

  let state = getDevAgentStateLabel(names);
  if (!state) {
    const comments = await listIssueComments(owner, repo, issue.number, token).catch(() => []);
    const hasPr =
      Array.isArray(comments) &&
      comments.some((c) => extractPullNumberFromText(c.body || '') != null);
    state = hasPr ? DEV_AGENT_STATE_LABELS.awaitingHuman : DEV_AGENT_STATE_LABELS.queued;
  }

  const withOwner = [...names.filter((n) => n !== DEV_AGENT_LABEL_OWNER), DEV_AGENT_LABEL_OWNER];
  const next = replaceDevAgentStateLabel(withOwner, state);
  const patched = await patchIssueLabels(owner, repo, issue.number, token, next);
  return patched;
}

/** @param {string} title */
export function extractDevAgentPathFromIssueTitle(title) {
  if (typeof title !== 'string') return null;
  const m = title.trim().match(/^\[dh-dev-agent\]\s+\w+:\s+(.+)$/i);
  return m ? normalizeDevAgentRelPath(m[1].trim()) : null;
}

export async function getIssue(owner, repo, issueNumber, token) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token);
}

export async function patchIssueLabels(owner, repo, issueNumber, token, labelNames) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token, {
    method: 'PATCH',
    body: { labels: labelNames },
  });
}

/**
 * @param {Record<string, unknown>} body — e.g. { labels, body, state, title }
 */
export async function patchIssue(owner, repo, issueNumber, token, body) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token, {
    method: 'PATCH',
    body,
  });
}

export async function createIssue(owner, repo, token, { title, body, labels }) {
  return ghFetch(`/repos/${owner}/${repo}/issues`, token, {
    method: 'POST',
    body: { title, body, labels },
  });
}

export async function createPullRequest(owner, repo, token, { title, body, head, base }) {
  return ghFetch(`/repos/${owner}/${repo}/pulls`, token, {
    method: 'POST',
    body: { title, body, head, base },
  });
}

export async function getPullRequest(owner, repo, pullNumber, token) {
  return ghFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, token);
}

export async function createIssueComment(owner, repo, issueNumber, token, body) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, token, {
    method: 'POST',
    body: { body },
  });
}

export async function closeIssue(owner, repo, issueNumber, token) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token, {
    method: 'PATCH',
    body: { state: 'closed' },
  });
}

export async function listIssueComments(owner, repo, issueNumber, token) {
  return ghFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`, token);
}

/**
 * Extract PR number from GitHub pull URL in text.
 * @param {string} text
 * @returns {number | null}
 */
export function extractPullNumberFromText(text) {
  if (typeof text !== 'string') return null;
  const full = text.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/i);
  if (full) return parseInt(full[1], 10);
  const rel = text.match(/\bpull\/(\d+)\b/i);
  return rel ? parseInt(rel[1], 10) : null;
}

/** Normalize relative path under `src/features-v2/` for comparisons (slashes, trim). */
export function normalizeDevAgentRelPath(p) {
  if (typeof p !== 'string') return '';
  return p.replace(/\\/g, '/').trim().replace(/^\.?\//, '');
}

/**
 * @param {object[]} issues — GitHub issue objects
 * @param {string | undefined} normalizedPath — forward-slash path under features-v2
 */
export function filterIssuesByDevAgentPath(issues, normalizedPath) {
  if (!normalizedPath) return issues || [];
  const want = normalizeDevAgentRelPath(normalizedPath);
  return (issues || []).filter((iss) => {
    const meta = parseDevAgentMetadataFromIssueBody(iss.body || '');
    const fromMeta = meta?.path ? normalizeDevAgentRelPath(meta.path) : null;
    const fromTitle = extractDevAgentPathFromIssueTitle(iss.title || '');
    const got = fromMeta || fromTitle;
    if (!got) return false;
    return got.toLowerCase() === want.toLowerCase();
  });
}
