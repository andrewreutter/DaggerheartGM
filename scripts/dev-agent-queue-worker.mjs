#!/usr/bin/env node
/**
 * Polls GitHub Issues (dh-agent-queued), runs Cursor CLI on a branch, opens a PR, then watches for merge.
 * Spawned by `npm run dev` when DEV_AGENT_QUEUE_ENABLED=1 (see package.json).
 */
import { readFileSync, openSync, closeSync, unlinkSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO_ROOT } from './lib/repo-root.mjs';
import { runCursorAgent, parseStateWithFallback } from './lib/cursor-agent-runner.mjs';
import {
  buildOpenIssuesSearchQuery,
  closeIssue,
  createIssueComment,
  createPullRequest,
  DEV_AGENT_LABEL_OWNER,
  DEV_AGENT_STATE_LABELS,
  extractPullNumberFromText,
  getDevAgentStateLabel,
  getIssue,
  getGithubTokenFromEnv,
  getPullRequest,
  isGithubIssueWriteForbidden,
  listIssueComments,
  listIssuesByLabels,
  listOpenQueuedDevAgentIssuesForWorker,
  parseDevAgentMetadataFromIssueBody,
  patchIssueLabels,
  repairDroppedDevAgentLabels,
  replaceDevAgentStateLabel,
  resolveGithubRepository,
  searchIssuesByQuery,
} from '../src/dev-agent-github.js';

const LOCK_FILE = join(REPO_ROOT, '.dev-agent-worker.lock');
/** If the process crashed mid-job, the lock file blocks all work forever — reclaim after this age. */
const STALE_LOCK_MS = parseInt(process.env.DEV_AGENT_STALE_LOCK_MS || '', 10) || 15 * 60 * 1000;

let loggedIssueWriteForbiddenHint = false;
function logIssueWriteForbiddenOnce(where) {
  if (loggedIssueWriteForbiddenHint) return;
  loggedIssueWriteForbiddenHint = true;
  console.warn(
    `[dev-agent-worker] ${where}: GitHub 403 — this token cannot write Issues/labels on this repo. ` +
      'Use a classic PAT with `repo` scope, or a fine-grained PAT with Issues Read+Write on this repository. ' +
      'If the org uses SAML SSO, open the token on github.com/settings/tokens and click “Configure SSO” → Authorize. ' +
      'Until then, repair/claim will be skipped (no crash).',
  );
}

if (process.env.DEV_AGENT_QUEUE_ENABLED !== '1') {
  process.exit(0);
}
if (process.env.DEV_AGENT_WORKER === '0') {
  process.exit(0);
}
if (!getGithubTokenFromEnv()) {
  process.exit(0);
}

const BASE_BRANCH = process.env.DEV_AGENT_BASE_BRANCH || 'main';
const MODEL = process.env.DEV_AGENT_MODEL || 'composer-2';
const POLL_MS = Math.max(15_000, parseInt(process.env.DEV_AGENT_POLL_MS || '60000', 10) || 60_000);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function git(cmd, { quiet = true } = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
}

function isRepoDirty() {
  try {
    return git('git status --porcelain', { quiet: true }).trim().length > 0;
  } catch {
    return true;
  }
}

function readSnippet(rel, max = 10_000) {
  try {
    return readFileSync(join(REPO_ROOT, rel), 'utf8').slice(0, max);
  } catch {
    return `(could not read ${rel})`;
  }
}

const ALLOWED = {
  implement: ['Done', 'Blocked', 'In Progress'],
  validate: ['Validated', 'Needs Fix', 'Validating'],
  fix: ['Done', 'Validated', 'Awaiting Human'],
  other: ['Done', 'Blocked', 'In Progress'],
};

function buildPrompt(mode, { kind, relPath, userMessage }) {
  const guide = readSnippet('docs/feature-authoring-guide.md', 6000);
  const conv = readSnippet('docs/v2-code-conventions.md', 4000);
  const sourcePath = join('src/features-v2', relPath);
  const task = `Feature module path: ${sourcePath}\nUser request:\n${userMessage || '_(none)_'}`;

  if (mode === 'other') {
    return `You are running inside an automated pipeline. Complete the task using repository conventions.

=== Repository ===
${REPO_ROOT}

=== Reference (excerpt) ===
--- feature-authoring-guide ---
${guide.slice(0, 4000)}
--- v2-code-conventions ---
${conv.slice(0, 3000)}

=== Task ===
${task}

=== Rules ===
- Run npm run validate:v2-preflight and relevant unit tests before finishing.
- When your work for this step is complete, print EXACTLY ONE WORD on the LAST line of your response.
- That last line must be one of: Done, Blocked, InProgress
- Use InProgress if you must stop early without finishing.
`.trim();
  }

  const agentMd =
    mode === 'implement'
      ? readSnippet('docs/agent-prompts/implementation-agent.md', 10_000)
      : mode === 'validate'
        ? readSnippet('docs/agent-prompts/validation-agent.md', 10_000)
        : readSnippet('docs/agent-prompts/fixit-agent.md', 10_000);

  return `You are running inside an automated pipeline. Follow the agent instructions below.

=== Repository ===
${REPO_ROOT}

=== MUST READ (instructions) ===
${agentMd}

=== Reference (do not paste back) ===
--- feature-authoring-guide (excerpt) ---
${guide.slice(0, 5000)}
--- v2-code-conventions (excerpt) ---
${conv.slice(0, 4000)}

=== Task ===
${task}
Kind: ${kind} (pipeline mode: ${mode})

=== Hard rules ===
- Run npm run validate:v2-preflight and focused tests (npm run test:unit or vitest on the relevant file) before finishing.
- When your work for this step is complete, print EXACTLY ONE WORD on the LAST line of your response.
- Allowed last-line words for this step: ${ALLOWED[mode].join(', ')}
`.trim();
}

function runAgentStep(mode, ctx) {
  const prompt = buildPrompt(mode, ctx);
  const { code, stdout } = runCursorAgent(prompt, { workspace: REPO_ROOT, model: MODEL });
  if (code !== 0) {
    throw new Error(`cursor agent exited with code ${code}`);
  }
  const parsed = parseStateWithFallback(stdout, ALLOWED[mode], { workspace: REPO_ROOT, model: MODEL });
  if (!parsed) {
    throw new Error('Could not parse agent state (even after interpreter pass)');
  }
  return parsed;
}

function runPipelineForKind(kind, relPath, userMessage) {
  if (kind === 'other') {
    const o = runAgentStep('other', { kind, relPath, userMessage });
    if (o !== 'Done') return { ok: false, reason: `other→${o}` };
    return { ok: true };
  }

  if (kind === 'bug') {
    let f = runAgentStep('fix', { kind, relPath, userMessage });
    if (f === 'Validated') return { ok: true };
    if (f !== 'Done') return { ok: false, reason: `fix→${f}` };
    let rounds = 0;
    let v = runAgentStep('validate', { kind, relPath, userMessage });
    while (v === 'Needs Fix' && rounds < 5) {
      rounds += 1;
      f = runAgentStep('fix', { kind, relPath, userMessage });
      if (f === 'Validated') return { ok: true };
      if (f !== 'Done') return { ok: false, reason: `fix→${f}` };
      v = runAgentStep('validate', { kind, relPath, userMessage });
    }
    if (v !== 'Validated') return { ok: false, reason: `validate→${v}` };
    return { ok: true };
  }

  let s = runAgentStep('implement', { kind, relPath, userMessage });
  if (s === 'Blocked' || s === 'In Progress') return { ok: false, reason: `implement→${s}` };
  if (s !== 'Done') return { ok: false, reason: `implement→${s}` };

  let rounds = 0;
  let v = runAgentStep('validate', { kind, relPath, userMessage });
  while (v === 'Needs Fix' && rounds < 5) {
    rounds += 1;
    const f = runAgentStep('fix', { kind, relPath, userMessage });
    if (f === 'Validated') return { ok: true };
    if (f !== 'Done') return { ok: false, reason: `fix→${f}` };
    v = runAgentStep('validate', { kind, relPath, userMessage });
  }
  if (v !== 'Validated') return { ok: false, reason: `validate→${v}` };
  return { ok: true };
}

function branchNameForIssue(issueNumber, relPath) {
  const slug = relPath
    .replace(/\.js$/, '')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/\//g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48);
  return `dev-agent/${issueNumber}-${slug || 'work'}`;
}

async function markFailed(owner, repo, issueNumber, token, err) {
  try {
    const issue = await getIssue(owner, repo, issueNumber, token);
    const names = (issue.labels || []).map((l) => l.name);
    const next = replaceDevAgentStateLabel(names, DEV_AGENT_STATE_LABELS.failed);
    await patchIssueLabels(owner, repo, issueNumber, token, next);
    await createIssueComment(
      owner,
      repo,
      issueNumber,
      token,
      `Dev agent failed: ${String(err?.message || err)}`,
    );
  } catch (e) {
    console.error('[dev-agent-worker] markFailed:', e);
  }
}

async function markAwaitingHuman(owner, repo, issueNumber, token, prUrl) {
  const issue = await getIssue(owner, repo, issueNumber, token);
  const names = (issue.labels || []).map((l) => l.name);
  const next = replaceDevAgentStateLabel(names, DEV_AGENT_STATE_LABELS.awaitingHuman);
  await patchIssueLabels(owner, repo, issueNumber, token, next);
  await createIssueComment(
    owner,
    repo,
    issueNumber,
    token,
    `Dev agent opened PR: ${prUrl}\n\n(Poll merge: worker will close this issue when the PR merges.)`,
  );
}

async function processMergedIssues(owner, repo, token) {
  let issues;
  try {
    issues = await searchIssuesByQuery(
      token,
      buildOpenIssuesSearchQuery(owner, repo, [DEV_AGENT_LABEL_OWNER, DEV_AGENT_STATE_LABELS.awaitingHuman]),
    );
  } catch {
    issues = await listIssuesByLabels(owner, repo, token, {
      labels: [DEV_AGENT_LABEL_OWNER, DEV_AGENT_STATE_LABELS.awaitingHuman],
      state: 'open',
    });
  }
  for (const iss of issues) {
    const comments = await listIssueComments(owner, repo, iss.number, token);
    let prNum = null;
    for (const c of comments) {
      prNum = extractPullNumberFromText(c.body || '');
      if (prNum != null) break;
    }
    if (prNum == null) continue;
    try {
      const pr = await getPullRequest(owner, repo, prNum, token);
      if (!pr.merged) continue;
      await createIssueComment(owner, repo, iss.number, token, `PR #${prNum} merged — closing.`);
      await closeIssue(owner, repo, iss.number, token);
      console.log(`[dev-agent-worker] Closed issue #${iss.number} (PR #${prNum} merged)`);
    } catch (e) {
      console.error(`[dev-agent-worker] merge check #${iss.number}:`, e?.message || e);
    }
  }
}

async function processOneJob(owner, repo, token) {
  const queued = await listOpenQueuedDevAgentIssuesForWorker(owner, repo, token);
  if (queued.length === 0) return;

  const issue = queued[0];
  let fresh = await getIssue(owner, repo, issue.number, token);
  let names = (fresh.labels || []).map((l) => l.name);
  if (!names.includes(DEV_AGENT_STATE_LABELS.queued)) {
    const st = getDevAgentStateLabel(names);
    if (!st && parseDevAgentMetadataFromIssueBody(fresh.body || '')) {
      try {
        await patchIssueLabels(
          owner,
          repo,
          issue.number,
          token,
          replaceDevAgentStateLabel(names, DEV_AGENT_STATE_LABELS.queued),
        );
      } catch (e) {
        if (isGithubIssueWriteForbidden(e)) {
          logIssueWriteForbiddenOnce(`restore queued on #${issue.number}`);
          return;
        }
        throw e;
      }
      fresh = await getIssue(owner, repo, issue.number, token);
      names = (fresh.labels || []).map((l) => l.name);
    }
    if (!names.includes(DEV_AGENT_STATE_LABELS.queued)) return;
  }

  const meta = parseDevAgentMetadataFromIssueBody(fresh.body || '');
  if (!meta?.path) {
    await markFailed(owner, repo, issue.number, token, new Error('Missing metadata in issue body'));
    return;
  }

  const relPath = meta.path.replace(/\\/g, '/');
  const userMessage = (fresh.body || '').split(/\n\n+/).slice(1).join('\n\n').trim() || '';

  const nextLabels = replaceDevAgentStateLabel(names, DEV_AGENT_STATE_LABELS.running);
  try {
    await patchIssueLabels(owner, repo, issue.number, token, nextLabels);
  } catch (e) {
    if (isGithubIssueWriteForbidden(e)) {
      logIssueWriteForbiddenOnce(`claim #${issue.number}`);
      return;
    }
    console.error('[dev-agent-worker] claim failed (race?):', e?.message || e);
    return;
  }

  console.log(`[dev-agent-worker] Claimed issue #${issue.number} (${meta.kind}) ${relPath}`);

  if (isRepoDirty()) {
    await markFailed(
      owner,
      repo,
      issue.number,
      token,
      new Error('Working tree is dirty — commit or stash before running the dev-agent worker'),
    );
    return;
  }

  const branch = branchNameForIssue(issue.number, relPath);

  try {
    try {
      git(`git fetch origin ${BASE_BRANCH}`, { quiet: true });
    } catch {
      /* ignore */
    }
    git(`git checkout ${BASE_BRANCH}`, { quiet: true });
    try {
      git(`git pull origin ${BASE_BRANCH} --no-rebase`, { quiet: true });
    } catch {
      /* ignore */
    }
    try {
      git(`git branch -D ${branch}`, { quiet: true });
    } catch {
      /* ignore */
    }
    git(`git checkout -b ${branch}`, { quiet: true });

    const result = runPipelineForKind(meta.kind, relPath, userMessage);
    if (!result.ok) {
      throw new Error(result.reason || 'pipeline failed');
    }

    git(`git push -u origin ${branch}`, { quiet: false });

    const pr = await createPullRequest(owner, repo, token, {
      title: `[dh-dev-agent] ${meta.kind}: ${relPath} (#${issue.number})`,
      body:
        `Automated dev-agent run for issue #${issue.number}.\n\n` +
        `- Path: \`src/features-v2/${relPath}\`\n` +
        `- Kind: ${meta.kind}\n`,
      head: branch,
      base: BASE_BRANCH,
    });

    const prUrl = pr.html_url;
    await markAwaitingHuman(owner, repo, issue.number, token, prUrl);
    console.log(`[dev-agent-worker] Opened PR for #${issue.number}: ${prUrl}`);

    git(`git checkout ${BASE_BRANCH}`, { quiet: true });
  } catch (err) {
    console.error('[dev-agent-worker] job failed:', err);
    try {
      git(`git checkout ${BASE_BRANCH}`, { quiet: true });
    } catch {
      /* ignore */
    }
    await markFailed(owner, repo, issue.number, token, err);
  }
}

async function repairIssuesMissingLabels(owner, repo, token) {
  let candidates = [];
  try {
    candidates = await searchIssuesByQuery(
      token,
      `repo:${owner}/${repo} is:issue is:open in:title dh-dev-agent`,
    );
  } catch {
    return;
  }
  for (const iss of candidates) {
    try {
      const full = await getIssue(owner, repo, iss.number, token);
      await repairDroppedDevAgentLabels(owner, repo, full, token);
    } catch (e) {
      if (isGithubIssueWriteForbidden(e)) {
        logIssueWriteForbiddenOnce(`repair #${iss.number}`);
      } else {
        console.error(`[dev-agent-worker] repair #${iss.number}:`, e?.message || e);
      }
    }
  }
}

function tryAcquireWorkerLock() {
  try {
    return openSync(LOCK_FILE, 'wx');
  } catch {
    try {
      const st = statSync(LOCK_FILE);
      if (Date.now() - st.mtimeMs > STALE_LOCK_MS) {
        unlinkSync(LOCK_FILE);
        return openSync(LOCK_FILE, 'wx');
      }
    } catch {
      /* race */
    }
    return null;
  }
}

async function tick(owner, repo, token) {
  await repairIssuesMissingLabels(owner, repo, token);
  await processMergedIssues(owner, repo, token);

  const lockFd = tryAcquireWorkerLock();
  if (lockFd == null) {
    return;
  }
  try {
    await processOneJob(owner, repo, token);
  } finally {
    try {
      closeSync(lockFd);
      unlinkSync(LOCK_FILE);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const repoFull = resolveGithubRepository();
  const token = getGithubTokenFromEnv();
  if (!repoFull || !token) {
    process.exit(0);
  }
  const [owner, repo] = repoFull.split('/');

  console.log('[dev-agent-worker] Started (poll', POLL_MS, 'ms, base', BASE_BRANCH + ')');

  for (;;) {
    await sleep(POLL_MS);
    try {
      await tick(owner, repo, token);
    } catch (e) {
      console.error('[dev-agent-worker] tick error:', e);
    }
  }
}

main();
