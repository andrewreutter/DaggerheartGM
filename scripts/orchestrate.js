#!/usr/bin/env node
/**
 * scripts/orchestrate.js
 *
 * Parallel overnight Cursor Cloud Agents orchestrator for DaggerheartGM V2 feature development.
 *
 * Uses a **worker pool** pattern: maintains N concurrent agent slots.  When any agent
 * finishes, its branch is merged (or a PR created) immediately and a new agent is
 * dispatched into the freed slot — no waiting for the slowest agent in a batch.
 *
 * Four agent modes run fully autonomously (finish dependency, not start dependency):
 *   impl    — implement Unclaimed features; branches auto-merged
 *   val     — validate Done features; PRs created for human review
 *   fix     — fix Needs Fix features; branches auto-merged
 *   unblock — implement Open blocked engine extensions; PRs created for human review
 *
 * State is tracked in .orchestrator-state.json (gitignored).  On restart after Ctrl+C,
 * the orchestrator recovers in-flight agents and resumes polling — no duplicate dispatch.
 *
 * Prerequisites:
 *   - CURSOR_API_KEY in .env  (create at https://cursor.com/dashboard/cloud-agents)
 *   - Repo pushed to GitHub (git remote origin = GitHub URL)
 *
 * Usage:
 *   caffeinate -i npm run agents -- --agents 3   (prevents Mac sleep)
 *
 * Options:
 *   --agents N        concurrent agent pool size (default: 3)
 *   --model M         model for impl / fix / unblock (default: claude-4.6-opus-high-thinking)
 *   --val-model M     model for val (default: claude-4.6-opus-high-thinking-fast)
 *
 * Cost estimation (Cloud Agents API only — not IDE Composer):
 *   ORCHESTRATOR_MODEL_COST_USD_JSON — optional JSON map of model id → USD per completed agent
 *     (merged over built-in defaults for the stock --model / --val-model strings). Example:
 *     {"claude-4.6-opus-high-thinking":0.42,"claude-4.6-opus-high-thinking-fast":0.15}
 *   ORCHESTRATOR_DEBUG_AGENT_PAYLOAD=1 — log top-level keys of one GET /v0/agents/:id response (verify usage/cost fields)
 *   --impl-only       only run impl agents
 *   --val-only        only run val agents
 *   --no-fix          skip fix agents this run
 *   --no-unblock      skip unblock agents this run
 *   --max-polls N     safety exit after N poll cycles (~N minutes) (default: 300)
 *   --batch-size N        max features per impl agent batch (default: 5)
 *   --val-batch-size N   max features per val agent batch (default: 5; same as manual validation batches)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  buildModelCostMap,
  estimateOrchestratorCost,
  sumSessionCostUsd,
} from './orchestrator-cost.js';
import {
  useGithubMigrationTracker,
  listAllV2MigrationIssues,
  readTrackerSummaryFromIssues,
  parseFeatureRowsFromIssues,
  parseBlockedRowsFromIssues,
  updateGithubFeatureIssuesByNames,
  writeTrackerSnapshotFile,
  getGithubTokenFromEnv,
  resolveGithubRepository,
} from './lib/github-v2-tracker.mjs';

/**
 * Node's `--env-file` is strict; a single bad line can leave GITHUB_TOKEN unset while
 * other keys load. Parse `.env` ourselves (export prefix, quotes) and fill gaps.
 */
function loadDotEnvManual() {
  const here = dirname(fileURLToPath(import.meta.url));
  const paths = [
    resolve(process.cwd(), '.env'),
    resolve(here, '..', '.env'),
  ];
  const seen = new Set();
  for (const envPath of paths) {
    if (seen.has(envPath) || !existsSync(envPath)) continue;
    seen.add(envPath);
    let text;
    try {
      text = readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('export ')) line = line.slice(7).trim();
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!key) continue;
      const isGithub = key === 'GITHUB_TOKEN' || key === 'GH_TOKEN';
      const cur = process.env[key];
      if (cur === undefined || (isGithub && !String(cur).trim())) {
        process.env[key] = val;
      }
    }
  }
}

loadDotEnvManual();

const ORCH_FILE = fileURLToPath(import.meta.url);
const ORCH_DIR = dirname(ORCH_FILE);
const ORCH_REPO_ROOT = resolve(ORCH_DIR, '..');

const USE_GH_TRACKER = useGithubMigrationTracker();
let githubIssuesCache = null;
function invalidateGithubIssuesCache() {
  githubIssuesCache = null;
}

async function getGithubMigrationIssues() {
  if (githubIssuesCache) return githubIssuesCache;
  const full = resolveGithubRepository();
  if (!full) throw new Error('Could not resolve GitHub owner/repo (origin or GITHUB_REPOSITORY)');
  const [owner, repo] = full.split('/');
  const token = getGithubTokenFromEnv();
  if (!token) throw new Error('GITHUB_TOKEN or GH_TOKEN required for V2 GitHub migration tracker');
  githubIssuesCache = await listAllV2MigrationIssues(owner, repo, token);
  return githubIssuesCache;
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const getArg   = (flag, def) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : def; };
const hasFlag  = (flag) => args.includes(flag);

const NUM_AGENTS   = parseInt(getArg('--agents',     '3'),   10);
const MODEL        = getArg('--model',     'claude-4.6-opus-high-thinking');
const VAL_MODEL    = getArg('--val-model', 'claude-4.6-opus-high-thinking-fast');
const IMPL_ONLY    = hasFlag('--impl-only');
const VAL_ONLY     = hasFlag('--val-only');
const NO_FIX       = hasFlag('--no-fix');
const NO_UNBLOCK   = hasFlag('--no-unblock');
const MAX_POLLS    = parseInt(getArg('--max-polls', '300'),  10);
const BATCH_SIZE       = parseInt(getArg('--batch-size',     '5'),  10);
const VAL_BATCH_SIZE   = parseInt(getArg('--val-batch-size', '5'), 10);
const POLL_MS          = 60_000;
const STALE_MS     = 4 * 60 * 60 * 1000; // 4 hours — prune agents older than this

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
if (!CURSOR_API_KEY) {
  console.error('Error: CURSOR_API_KEY is not set.  Add it to .env — see .env.example.');
  process.exit(1);
}

if (!USE_GH_TRACKER) {
  console.error(
    'Error: Overnight orchestrator requires GITHUB_TOKEN (or GH_TOKEN) and a GitHub remote (git remote origin or GITHUB_REPOSITORY) for the V2 migration Issues tracker.',
  );
  process.exit(1);
}

// ── Cursor Cloud Agents API ───────────────────────────────────────────────────

const BASE = 'https://api.cursor.com';
const AUTH = 'Basic ' + Buffer.from(CURSOR_API_KEY + ':').toString('base64');

async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: AUTH } });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── Orchestrator state file ───────────────────────────────────────────────────

const STATE_FILE = '.orchestrator-state.json';

function loadState() {
  const empty = { inFlight: [], reviewQueue: [], completionHistory: [] };
  if (!existsSync(STATE_FILE)) return empty;
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    if (!raw.completionHistory) raw.completionHistory = [];
    return raw;
  } catch {
    return empty;
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function addInFlight(state, entry) {
  state.inFlight.push(entry);
  saveState(state);
}

function removeInFlight(state, agentId) {
  state.inFlight = state.inFlight.filter(e => e.agentId !== agentId);
  saveState(state);
}

function getInFlightItemNames(state) {
  const names = new Set();
  for (const entry of state.inFlight) {
    for (const item of (entry.items || [])) names.add(item);
  }
  return names;
}

function getInFlightResolutions(state) {
  const resolutions = new Set();
  for (const entry of state.inFlight) {
    if (entry.mode === 'unblock' && entry.resolution) resolutions.add(entry.resolution);
  }
  return resolutions;
}

const HISTORY_WINDOW = 30; // keep last N completions for adaptive tuning

let modelCostMapCache = null;
function getModelCostMap() {
  if (!modelCostMapCache) modelCostMapCache = buildModelCostMap();
  return modelCostMapCache;
}

/**
 * @param {object} state
 * @param {object} entry — in-flight entry (includes `model` when launched from fillAgentSlots)
 * @param {{ raw?: object } | null} [checkResult] — from checkAgent (full API payload in `raw`)
 */
function recordCompletion(state, entry, checkResult = null) {
  const durationMs = Date.now() - new Date(entry.launchedAt).getTime();
  const batchSize  = (entry.items || []).length || 1;
  const cost = estimateOrchestratorCost({
    entry,
    agentPayload: checkResult?.raw ?? null,
    durationMs,
    implFixUnblockModel: MODEL,
    valModel: VAL_MODEL,
    modelCostMap: getModelCostMap(),
  });
  state.completionHistory.push({
    mode: entry.mode, batchSize, durationMs,
    perItemMs: Math.round(durationMs / batchSize),
    completedAt: new Date().toISOString(),
    model: cost.model,
    estimatedCostUsd: cost.estimatedCostUsd,
    costSource: cost.costSource,
  });
  // Trim to rolling window
  if (state.completionHistory.length > HISTORY_WINDOW) {
    state.completionHistory = state.completionHistory.slice(-HISTORY_WINDOW);
  }
}

/**
 * Compute adaptive impl:val ratio from observed completion times.
 * Returns the number of impl agents per 1 val agent (e.g. 3 means 3:1).
 * Falls back to the default 3:1 when insufficient data.
 */
function getAdaptiveRatio(state) {
  const implTimes = state.completionHistory.filter(h => h.mode === 'impl').map(h => h.durationMs);
  const valTimes  = state.completionHistory.filter(h => h.mode === 'val').map(h => h.durationMs);

  if (implTimes.length < 2 || valTimes.length < 1) return 3; // default

  const avgImpl = implTimes.reduce((a, b) => a + b, 0) / implTimes.length;
  const avgVal  = valTimes.reduce((a, b) => a + b, 0) / valTimes.length;

  // Ratio = how many val agents finish in the time one impl takes
  // Clamp between 1 (equal) and 6 (heavily impl-favored)
  const ratio = Math.round(Math.max(1, Math.min(6, avgImpl / avgVal)));
  return ratio;
}

function formatTimingStats(state) {
  const implTimes = state.completionHistory.filter(h => h.mode === 'impl');
  const valTimes  = state.completionHistory.filter(h => h.mode === 'val');
  if (implTimes.length === 0 && valTimes.length === 0) return '';

  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 1000);
  const parts = [];
  if (implTimes.length > 0) parts.push(`impl avg ${avg(implTimes.map(h => h.durationMs))}s (${implTimes.length} samples)`);
  if (valTimes.length > 0)  parts.push(`val avg ${avg(valTimes.map(h => h.durationMs))}s (${valTimes.length} samples)`);
  parts.push(`ratio ${getAdaptiveRatio(state)}:1`);
  if (state.completionHistory.length > 0) {
    parts.push(`est. session ~$${sumSessionCostUsd(state).toFixed(2)}`);
  }
  return parts.join(' | ');
}

function logSessionCostSummary(state) {
  if (state.completionHistory.length > 0) {
    console.log(
      `\nEstimated session cost (cloud agents, this process): ~$${sumSessionCostUsd(state).toFixed(2)} USD`
    );
  }
}

// ── Git helpers ───────────────────────────────────────────────────────────────

function git(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: opts.quiet ? 'pipe' : 'inherit', ...opts });
}

function getGitRemote() {
  let url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim().replace(/\.git$/, '');
  url = url.replace(/^git@([^:]+):/, 'https://$1/');
  return url;
}

function getGitBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
}

// ── Tracker helpers (GitHub Issues only) ────────────────────────────────────

const TRACKER_SNAPSHOT = 'docs/v2-migration-tracker-snapshot.md';

const SOURCE_TO_COLLECTION = {
  ancestries:        'Ancestries (features)',
  communities:       'Communities (features)',
  weapon_properties: 'Weapon Properties',
  armor_properties:  'Armor Properties',
  classes:           'Classes (features)',
  subclasses:        'Subclasses (features)',
  abilities:         'Abilities',
  beastforms:        'Beastforms',
  items:             'Items',
  consumables:       'Consumables',
};

function collectionFromSourceFile(src) {
  const prefix = (src || '').split('/')[0];
  return SOURCE_TO_COLLECTION[prefix] || null;
}

async function readTrackerSummaryAsync() {
  const issues = await getGithubMigrationIssues();
  return readTrackerSummaryFromIssues(issues);
}

async function parseFeatureRowsAsync(statusFilter) {
  const issues = await getGithubMigrationIssues();
  return parseFeatureRowsFromIssues(issues, statusFilter);
}

async function parseBlockedRowsAsync() {
  const issues = await getGithubMigrationIssues();
  return parseBlockedRowsFromIssues(issues);
}

// ── Batch assignment ──────────────────────────────────────────────────────────

function assignBatches(features, numAgents, batchSize = BATCH_SIZE) {
  const groups = {};
  for (const f of features) {
    const key = f.collection || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  const chunks = [];
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    for (let i = 0; i < group.length; i += batchSize) {
      chunks.push({ collection: key, features: group.slice(i, i + batchSize) });
    }
  }
  return chunks.slice(0, numAgents);
}

function batchLabel(batch) {
  const names = batch.features.map(f => f.name).join(', ');
  return `[${batch.collection}] ${names}`;
}

/** Unique `test/unit/features-v2/<collection>` dirs from tracker Source File paths (e.g. ancestries/Foo.js). */
function vitestDirsFromFeatures(features) {
  const cols = [...new Set(features.map(f => f.sourceFile.split('/')[0]).filter(Boolean))];
  return cols.map(c => `test/unit/features-v2/${c}`);
}

/** One shell line: targeted vitest dirs, or full suite if none parsed. */
function vitestRunLineForFeatures(features) {
  const dirs = vitestDirsFromFeatures(features);
  if (dirs.length)
    return `npx vitest run ${dirs.join(' ')}`;
  return 'npm run test:unit  # no collection segments in Source File — run full suite';
}

// ── Agent prompt builders ─────────────────────────────────────────────────────

function buildImplPrompt(features) {
  const list = features.map(f => `- ${f.name} (${f.sourceFile})`).join('\n');
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/implementation-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned features (do NOT claim other features):
${list}

If any feature in your list is already In Progress, Done, or otherwise not Unclaimed when you check it, skip it and continue with the remaining features.  Do NOT re-run mode selection or claim replacement features.

OVERRIDE 2 — Do NOT edit GitHub Issue labels / JSON body for features outside your assigned list. Only update the matching Issue rows for the features above. The orchestrator regenerates docs/v2-migration-tracker-snapshot.md after merges.

OVERRIDE 3 — Tests (streamlined — same collections as this batch):
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run validate:v2-preflight
  ${vitestRunLineForFeatures(features)}
  If preflight or targeted Vitest fails, run \`npm run test:unit\` once for full-suite context before fixing.

Now read docs/agent-prompts/implementation-agent.md and implement each feature above.`;
}

function buildValPrompt(features) {
  const list = features.map(f => `- ${f.name} (${f.sourceFile})`).join('\n');
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/validation-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned features to validate (do NOT claim other features):
${list}

If any feature in your list is already Validating, Validated, or otherwise not in Done status when you check it, skip it and continue with the remaining features.  Do NOT re-run mode selection or claim replacement features.

OVERRIDE 2 — Do NOT edit GitHub Issue labels / JSON body for features outside your assigned list. Only update the matching Issue rows for the features above. The orchestrator regenerates docs/v2-migration-tracker-snapshot.md after merges.

OVERRIDE 3 — Tests (streamlined — collections in this batch):
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run validate:v2-preflight
  ${vitestRunLineForFeatures(features)}
  If preflight or targeted Vitest fails, run \`npm run test:unit\` once for full-suite context.

Now read docs/agent-prompts/validation-agent.md and validate each feature above.`;
}

function buildFixPrompt(feature) {
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/fixit-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned feature to fix:
- ${feature.name} (${feature.sourceFile})

If this feature is not in Needs Fix status when you check it, exit immediately without making any changes.

OVERRIDE 2 — After fixing the code and passing tests, update the GitHub Issue:
  - Set v2-status to "Done" (not "Fixing" or "Validated" — back to Done so the val agent re-validates it)
  - Write a brief summary of what you changed in the Issue body / notes
  Do NOT stop and wait for human verification.  The orchestrator will auto-merge your branch and the val agent will pick it up next round.  The human will review the code naturally when promoting Validated → Reviewed.

OVERRIDE 3 — Do not bulk-edit unrelated Issues; snapshot regeneration is orchestrator-owned.

OVERRIDE 4 — Tests (streamlined — this feature's collection):
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run validate:v2-preflight
  ${vitestRunLineForFeatures([feature])}
  If preflight or targeted Vitest fails, run \`npm run test:unit\` once for full-suite context.

Now read docs/agent-prompts/fixit-agent.md and fix the feature above.`;
}

function buildUnblockPrompt(resolution) {
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/unblocking-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned resolution to implement:
  Resolution:      ${resolution.resolution}
  Affects:         ${resolution.features}
  SRD Requirement: ${resolution.srdReq}
  Notes:           ${resolution.notes}

If this resolution row is not in Open status when you check it, exit immediately without making any changes.

OVERRIDE 2 — Do NOT stop and wait for human verification.  After implementing the engine change, updating the authoring guide, and running tests, do all of the following and then exit:
  a. Update affected feature rows in the feature checklists: set Status from Blocked to Done (so the val agent picks them up after the human merges your branch).  Follow the same eligibility check as Step 5: only promote a feature if no OTHER active Blocked row still lists it.
  b. Write a brief summary of what you changed in the Notes column of the resolution row.
  c. Leave the resolution Issue in **Open** status on GitHub — do NOT archive it in docs/v2-blocked-resolutions-done.md.  The human will archive it after reviewing and merging your branch.
  The orchestrator will present your branch for human sign-off before merging.

OVERRIDE 3 — Do not bulk-edit unrelated Issues; snapshot regeneration is orchestrator-owned.

OVERRIDE 4 — Before running tests:
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run test:unit

Now read docs/agent-prompts/unblocking-agent.md and implement the resolution above.`;
}

// ── Cloud agent lifecycle ─────────────────────────────────────────────────────

async function launchAgent(prompt, branchName, repo, model = MODEL, baseBranch = 'main') {
  const body = {
    prompt: { text: prompt },
    model,
    source: { repository: repo, ref: baseBranch },
    target: { branchName, autoCreatePr: false },
  };
  const res = await apiPost('/v0/agents', body);
  return res.id;
}

/** Log top-level keys once (when ORCHESTRATOR_DEBUG_AGENT_PAYLOAD=1) to inspect billing/usage fields. */
let debugAgentPayloadLogged = false;

/**
 * Check a single agent's status via the API.
 * Returns { status: 'RUNNING'|'FINISHED'|'ERROR', url?, summary?, raw }
 */
async function checkAgent(agentId) {
  const agent = await apiGet(`/v0/agents/${agentId}`);
  if (process.env.ORCHESTRATOR_DEBUG_AGENT_PAYLOAD === '1' && !debugAgentPayloadLogged && agent && typeof agent === 'object') {
    debugAgentPayloadLogged = true;
    console.log('[orchestrator] sample GET /v0/agents/:id top-level keys:', Object.keys(agent).sort().join(', '));
  }
  return {
    status:     agent.status,
    url:        agent.target?.url ?? null,
    branchName: agent.target?.branchName ?? null,
    summary:    agent.summary ?? '',
    raw:        agent,
  };
}

/**
 * Poll a set of agents until all reach a terminal state.
 * Calls onFinished(entry, result) / onFailed(entry) for each.
 */
async function pollAgents(entries, { onFinished, onFailed } = {}) {
  const pending = new Map(entries.map(e => [e.agentId, e]));
  const done    = new Map();
  const failed  = new Set();

  while (pending.size > 0) {
    await sleep(POLL_MS);

    for (const [id, entry] of pending) {
      try {
        const result = await checkAgent(id);
        if (result.status === 'FINISHED') {
          pending.delete(id);
          done.set(id, result);
          console.log(`\n  ✓ ${id} (${result.branchName ?? '?'}) FINISHED`);
          if (onFinished) await onFinished(entry, result);
        } else if (result.status === 'ERROR') {
          pending.delete(id);
          failed.add(id);
          console.log(`\n  ✗ ${id} ERROR: ${result.summary ?? 'no summary'}`);
          if (onFailed) onFailed(entry);
        } else {
          process.stdout.write('.');
        }
      } catch (err) {
        console.error(`\n  Poll error for ${id}: ${err.message}`);
      }
    }

    if (pending.size > 0) {
      console.log(`\n  ${done.size + failed.size}/${entries.length} terminal (${done.size} done, ${failed.size} failed)`);
    }
  }

  return { done, failed };
}

// ── Pull request creation ─────────────────────────────────────────────────────

/** Read at call time (not module load) so `node --env-file=.env` is reliable; support GH CLI's GH_TOKEN. */
function getGithubToken() {
  const raw = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  return raw.trim() || null;
}

async function createPullRequest(branchName, baseBranch, entry, repo) {
  const githubToken = getGithubToken();
  if (!githubToken) {
    console.error(
      '    ✗ No GitHub token — cannot create PR. Set GITHUB_TOKEN (or GH_TOKEN) in .env in the repo root, ' +
        'with no surrounding quotes unless the value needs them. Run via `npm run agents` ' +
        '(uses `node --env-file=.env`). Do not use a leading `export` on the line — Node\'s env-file parser ignores it.'
    );
    return null;
  }

  // Extract owner/repo from HTTPS URL: https://github.com/owner/repo
  const match = repo.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) {
    console.error(`    ✗ Could not parse owner/repo from ${repo}`);
    return null;
  }
  const ownerRepo = match[1];

  const mode  = entry.mode.toUpperCase();
  const title = `[${mode}] ${entry.label}`;
  const features = entry.items?.join(', ') || entry.resolution || '—';
  const body  = `## ${mode === 'VAL' ? 'Validation' : 'Unblock'} — ready for review\n\n` +
    `**Mode:** ${entry.mode}\n` +
    `**Features:** ${features}\n` +
    `**Branch:** \`${branchName}\`\n\n` +
    `Merge this PR to promote to Reviewed.`;

  try {
    const res = await fetch(`https://api.github.com/repos/${ownerRepo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({ title, body, head: branchName, base: baseBranch }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`    ✗ PR creation failed (${res.status}): ${errText}`);
      return null;
    }
    const pr = await res.json();
    console.log(`    PR created: ${pr.html_url}`);
    return pr.html_url;
  } catch (err) {
    console.error(`    ✗ PR creation failed: ${err.message}`);
    return null;
  }
}

// ── Branch merging ────────────────────────────────────────────────────────────

async function mergeBranches(entries, baseBranch) {
  const branches = entries.map(e => typeof e === 'string' ? e : e.branchName);
  console.log('\n── Merging branches ────────────────────────────────────────');

  try { git(`git pull origin ${baseBranch} --no-rebase`, { quiet: true }); } catch (_) {}
  try { git('git fetch origin', { quiet: true }); } catch (e) { console.error('git fetch failed:', e.message); }

  for (const branch of branches) {
    console.log(`  Merging origin/${branch}...`);
    try {
      // First try: auto-resolve conflicts favoring the agent's changes
      git(`git merge -X theirs origin/${branch} --no-edit -m "chore: merge agent branch ${branch}"`, { quiet: true });
    } catch (_) {
      // -X theirs still leaves conflicts for adds/deletes and renames.
      // Fall back to per-file resolution: tracker stays ours, everything else theirs.
      console.log(`  Conflict in ${branch} — resolving per-file...`);
      try {
        const conflicted = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' })
          .trim().split('\n').filter(Boolean);
        if (conflicted.length === 0) {
          // No unmerged files — merge may have partially succeeded; just commit what we have
          git(`git commit --no-edit --allow-empty -m "chore: merge ${branch}"`, { quiet: true });
        } else {
          for (const file of conflicted) {
            const keepOurs = file === TRACKER_SNAPSHOT;
            execSync(`git checkout ${keepOurs ? '--ours' : '--theirs'} "${file}"`, { encoding: 'utf8' });
            execSync(`git add "${file}"`, { encoding: 'utf8' });
          }
          // --allow-empty handles the case where resolution matches HEAD exactly
          git(`git commit --allow-empty -m "chore: merge ${branch} (conflict resolved)"`, { quiet: true });
        }
        console.log(`  Resolved.`);
      } catch (e2) {
        console.error(`  Could not resolve merge for ${branch}: ${e2.message}`);
        try { git('git merge --abort', { quiet: true }); } catch (_) {}
      }
    }
  }

  // Merge conflict resolution uses --ours for the tracker, discarding agent status updates.
  // Re-apply them from the orchestrator's knowledge of what was assigned to each agent.
  const mergedFeatureNames = entries
    .filter(e => typeof e === 'object' && (e.mode === 'impl' || e.mode === 'fix'))
    .flatMap(e => e.items || []);
  if (mergedFeatureNames.length > 0) {
    const full = resolveGithubRepository();
    const [owner, repo] = full.split('/');
    const token = getGithubTokenFromEnv();
    const count = await updateGithubFeatureIssuesByNames(owner, repo, token, mergedFeatureNames, 'Done');
    invalidateGithubIssuesCache();
    if (count > 0) console.log(`  Updated ${count} GitHub migration issue(s) to Done.`);
  }

  {
    const full = resolveGithubRepository();
    const [owner, repo] = full.split('/');
    const token = getGithubTokenFromEnv();
    await writeTrackerSnapshotFile(owner, repo, token, resolve(ORCH_REPO_ROOT, TRACKER_SNAPSHOT));
    console.log(`  Wrote ${TRACKER_SNAPSHOT} from GitHub Issues.`);
  }

  try {
    git(`git add ${TRACKER_SNAPSHOT}`, { quiet: true });
    git('git commit -m "chore: regenerate v2 migration snapshot from GitHub" --allow-empty', { quiet: true });
  } catch (_) {}

  try {
    git(`git push origin ${baseBranch}`, { quiet: true });
    console.log(`  Pushed to ${baseBranch} ✓`);
  } catch (e) {
    console.error('  Push failed:', e.message);
  }

  for (const branch of branches) {
    try { execSync(`git push origin --delete ${branch}`, { encoding: 'utf8', stdio: 'pipe' }); } catch (_) {}
  }
}

// ── Final report ──────────────────────────────────────────────────────────────

async function printFinalReport(reviewQueue) {
  const line    = '═'.repeat(56);
  const summary = await readTrackerSummaryAsync();

  const valPRs     = reviewQueue.filter(r => r.mode === 'val');
  const unblockPRs = reviewQueue.filter(r => r.mode === 'unblock');

  if (valPRs.length > 0) {
    console.log(`\n${line}`);
    console.log(`VALIDATED — PULL REQUESTS READY FOR YOUR REVIEW`);
    console.log(`${valPRs.length} PR${valPRs.length !== 1 ? 's' : ''} — review code, then merge to promote to Reviewed`);
    console.log(line);
    for (const item of valPRs) {
      console.log(`  • ${item.label}`);
      if (item.url) console.log(`    ${item.url}`);
    }
  }

  if (unblockPRs.length > 0) {
    console.log(`\n${line}`);
    console.log(`ENGINE CHANGES — PULL REQUESTS READY FOR YOUR REVIEW`);
    console.log(`${unblockPRs.length} PR${unblockPRs.length !== 1 ? 's' : ''} need sign-off before merge`);
    console.log(line);
    for (const item of unblockPRs) {
      console.log(`  • ${item.label}`);
      if (item.url) console.log(`    ${item.url}`);
    }
  }

  if ((summary.validated ?? 0) > 0 && valPRs.length === 0) {
    console.log(`\n${line}`);
    console.log(`VALIDATED — READY FOR YOUR REVIEW`);
    console.log(`${summary.validated} feature${summary.validated !== 1 ? 's' : ''} passed validation (from previous runs)`);
    console.log(`Promote each to Reviewed after you've looked at the code.`);
    console.log(line);
  }

  const needsFix = await parseFeatureRowsAsync(['Needs Fix']);
  const blocked  = await parseBlockedRowsAsync();

  if (needsFix.length === 0 && blocked.length === 0 && reviewQueue.length === 0) {
    if ((summary.validated ?? 0) === 0) {
      console.log(`\n${line}`);
      console.log('ALL DONE — pipeline is completely clear!');
      console.log('Every feature is Validated or Reviewed.');
      console.log(line);
    }
    return;
  }

  if (needsFix.length > 0 || blocked.length > 0) {
    console.log(`\n${line}`);
    const total = needsFix.length + blocked.length;
    console.log(`COULD NOT FINISH AUTONOMOUSLY — ${total} item${total !== 1 ? 's' : ''}`);
    console.log(line);

    if (needsFix.length > 0) {
      console.log(`\nNEEDS FIX (${needsFix.length}) — fix agents could not process these:`);
      for (const item of needsFix) {
        console.log(`  • ${item.name.padEnd(24)} ${item.sourceFile}`);
      }
      console.log(`  → Open a Cursor chat and say "Fix features"`);
    }

    if (blocked.length > 0) {
      console.log(`\nOPEN BLOCKED (${blocked.length}) — unblock agents could not process these:`);
      for (const item of blocked) {
        const res = item.resolution.length > 56 ? item.resolution.slice(0, 56) + '…' : item.resolution;
        console.log(`  • ${res}`);
        if (item.features) console.log(`    Affects: ${item.features}`);
      }
      console.log(`  → Open a Cursor chat and say "Unblock features"`);
    }

    console.log(line);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function formatSummary(s) {
  return `unclaimed=${s.unclaimed} done=${s.done} needsFix=${s.needsFix} fixing=${s.fixing} blocked=${s.blocked}`;
}

// ── Worker pool: dynamic work selection and slot filling ──────────────────────

/**
 * Pick the single highest-priority work item that isn't already in-flight.
 * Priority: fix (1 at a time) > unblock (1 at a time) > impl/val (balanced).
 * Returns { mode, label, prompt, model, items, resolution } or null.
 */
async function pickNextWork(state) {
  const inFlightNames       = getInFlightItemNames(state);
  const inFlightResolutions = getInFlightResolutions(state);
  const summary             = await readTrackerSummaryAsync();

  // Priority 1: Fix (at most 1 in-flight at a time)
  if (!NO_FIX && !IMPL_ONLY && !VAL_ONLY && summary.needsFix > 0) {
    const inFlightFix = state.inFlight.filter(e => e.mode === 'fix').length;
    if (inFlightFix === 0) {
      const fix = (await parseFeatureRowsAsync(['Needs Fix'])).find(f => !inFlightNames.has(f.name));
      if (fix) return {
        mode: 'fix', label: `${fix.name} (${fix.sourceFile})`,
        prompt: buildFixPrompt(fix), model: MODEL,
        items: [fix.name], resolution: null,
      };
    }
  }

  // Priority 2: Unblock (at most 1 in-flight at a time)
  if (!NO_UNBLOCK && !IMPL_ONLY && !VAL_ONLY && summary.blocked > 0) {
    const inFlightUnblock = state.inFlight.filter(e => e.mode === 'unblock').length;
    if (inFlightUnblock === 0) {
      const ub = (await parseBlockedRowsAsync()).find(r => !inFlightResolutions.has(r.resolution));
      if (ub) return {
        mode: 'unblock', label: ub.resolution,
        prompt: buildUnblockPrompt(ub), model: MODEL,
        items: [], resolution: ub.resolution,
      };
    }
  }

  // Priority 3: Impl and Val
  // Ratio auto-tunes from observed completion times (default 3:1 impl:val).
  // Val batch size matches manual validation-agent default (VAL_BATCH_SIZE).
  const hasImpl = !VAL_ONLY && summary.unclaimed > 0;
  const hasVal  = !IMPL_ONLY && summary.done > 0;

  const inFlightImpl = state.inFlight.filter(e => e.mode === 'impl').length;
  const inFlightVal  = state.inFlight.filter(e => e.mode === 'val').length;

  const targetRatio = getAdaptiveRatio(state);
  const implHeavy = inFlightImpl > inFlightVal * targetRatio;
  const tryOrder = (hasImpl && hasVal)
    ? (implHeavy ? ['val', 'impl'] : ['impl', 'val'])
    : hasImpl ? ['impl'] : hasVal ? ['val'] : [];

  for (const mode of tryOrder) {
    if (mode === 'impl') {
      const features = (await parseFeatureRowsAsync(['Unclaimed'])).filter(f => !inFlightNames.has(f.name));
      const batch = assignBatches(features, 1)[0];
      if (batch) return {
        mode: 'impl', label: batchLabel(batch),
        prompt: buildImplPrompt(batch.features), model: MODEL,
        items: batch.features.map(f => f.name), resolution: null,
      };
    } else {
      const features = (await parseFeatureRowsAsync(['Done'])).filter(f => !inFlightNames.has(f.name));
      const batch = assignBatches(features, 1, VAL_BATCH_SIZE)[0];
      if (batch) return {
        mode: 'val', label: batchLabel(batch),
        prompt: buildValPrompt(batch.features), model: VAL_MODEL,
        items: batch.features.map(f => f.name), resolution: null,
      };
    }
  }

  return null;
}

/**
 * Launch agents into all free pool slots.  Pulls latest main before each
 * dispatch so new agents start from the freshest merged state.
 */
async function fillAgentSlots(state, baseBranch, repo) {
  let pulled = false;

  while (state.inFlight.length < NUM_AGENTS) {
    if (!pulled) {
      try { git(`git pull origin ${baseBranch} --no-rebase`, { quiet: true }); } catch (_) {}
      pulled = true;
    }

    const work = await pickNextWork(state);
    if (!work) break;

    const ts     = timestamp();
    const suffix = Math.random().toString(36).slice(2, 6);
    const branchName = `orchestrate/${work.mode}-${ts}-${suffix}`;
    console.log(`  [${work.mode.toUpperCase().padEnd(7)}] ${work.label.slice(0, 100)}`);

    try {
      const id = await launchAgent(work.prompt, branchName, repo, work.model, baseBranch);
      console.log(`    → Agent ${id}`);
      addInFlight(state, {
        agentId: id, branchName, mode: work.mode, label: work.label,
        items: work.items, resolution: work.resolution,
        batchSize: work.items?.length || 1,
        launchedAt: new Date().toISOString(),
        model: work.model,
      });
    } catch (err) {
      console.error(`    ✗ Launch failed: ${err.message}`);
      break;
    }

    await sleep(3_000);
  }
}

// ── Recovery: resume in-flight agents from a previous run ─────────────────────

async function recoverInFlightAgents(state, baseBranch, repo) {
  if (state.inFlight.length === 0) return;

  const now = Date.now();
  const stale = state.inFlight.filter(e => now - new Date(e.launchedAt).getTime() > STALE_MS);
  if (stale.length > 0) {
    console.log(`  Pruning ${stale.length} stale agent(s) (>4h old):`);
    for (const e of stale) {
      console.log(`    • ${e.agentId} [${e.mode}] ${e.label}`);
      removeInFlight(state, e.agentId);
    }
  }

  if (state.inFlight.length === 0) return;

  console.log(`\n── Recovering ${state.inFlight.length} in-flight agent(s) from previous run ──`);

  // Check each agent's current status
  const stillRunning = [];
  const autoMergeEntries = [];

  for (const entry of [...state.inFlight]) {
    try {
      const result = await checkAgent(entry.agentId);
      if (result.status === 'FINISHED') {
        console.log(`  ✓ ${entry.agentId} [${entry.mode}] FINISHED`);
        recordCompletion(state, entry, result);
        removeInFlight(state, entry.agentId);
        if (entry.mode === 'val' || entry.mode === 'unblock') {
          const prUrl = await createPullRequest(entry.branchName, baseBranch, entry, repo);
          state.reviewQueue.push({
            mode: entry.mode, label: entry.label,
            branchName: entry.branchName, url: prUrl || result.url,
          });
          saveState(state);
        } else {
          autoMergeEntries.push(entry);
        }
      } else if (result.status === 'ERROR') {
        console.log(`  ✗ ${entry.agentId} [${entry.mode}] ERROR: ${result.summary}`);
        removeInFlight(state, entry.agentId);
      } else {
        console.log(`  ⟳ ${entry.agentId} [${entry.mode}] still running — will resume polling`);
        stillRunning.push(entry);
      }
    } catch (err) {
      console.error(`  ? ${entry.agentId} — could not check: ${err.message}`);
      stillRunning.push(entry);
    }
  }

  // Merge any branches that finished while we were away
  if (autoMergeEntries.length > 0) {
    await mergeBranches(autoMergeEntries, baseBranch);
  }

  // Poll remaining running agents
  if (stillRunning.length > 0) {
    console.log(`\n  Resuming poll of ${stillRunning.length} running agent(s)...`);
    await pollAgents(stillRunning, {
      async onFinished(entry, result) {
        recordCompletion(state, entry, result);
        removeInFlight(state, entry.agentId);
        if (entry.mode === 'val' || entry.mode === 'unblock') {
          const prUrl = await createPullRequest(entry.branchName, baseBranch, entry, repo);
          state.reviewQueue.push({
            mode: entry.mode, label: entry.label,
            branchName: entry.branchName, url: prUrl || result.url,
          });
          saveState(state);
        }
      },
      onFailed(entry) {
        removeInFlight(state, entry.agentId);
      },
    });

    // Merge auto-mergeable branches from the just-finished poll
    const justFinished = stillRunning.filter(
      e => !state.inFlight.some(s => s.agentId === e.agentId) && e.mode !== 'unblock' && e.mode !== 'val'
    );
    if (justFinished.length > 0) {
      await mergeBranches(justFinished, baseBranch);
    }
  }

  console.log('  Recovery complete.\n');
}

// ── Main orchestration loop ───────────────────────────────────────────────────

async function main() {
  const divider = '═'.repeat(60);
  console.log(`\n${divider}`);
  console.log('DaggerheartGM Overnight Agent Orchestrator');
  console.log(`Agents: ${NUM_AGENTS} | Impl/Fix/Unblock model: ${MODEL} | Val model: ${VAL_MODEL}`);
  console.log(`Impl batch: ${BATCH_SIZE} | Val batch: ${VAL_BATCH_SIZE} | Max poll cycles: ${MAX_POLLS} | Impl:Val target ~3:1`);

  const modeFlags = [];
  if (IMPL_ONLY)   modeFlags.push('impl-only');
  if (VAL_ONLY)    modeFlags.push('val-only');
  if (NO_FIX)      modeFlags.push('no-fix');
  if (NO_UNBLOCK)  modeFlags.push('no-unblock');
  if (modeFlags.length) console.log(`Flags: ${modeFlags.join(', ')}`);

  console.log(divider);

  const repo       = getGitRemote();
  const baseBranch = getGitBranch();
  console.log(`Repo:   ${repo}`);
  console.log(`Branch: ${baseBranch}\n`);

  // Preflight: verify the branch exists on the remote
  console.log('Checking remote branch...');
  try {
    const remoteBranches = execSync('git ls-remote --heads origin', { encoding: 'utf8' });
    const branchRef = `refs/heads/${baseBranch}`;
    if (!remoteBranches.includes(branchRef)) {
      console.error(`\nError: branch "${baseBranch}" does not exist on the remote.`);
      console.error(`Push it first:  git push -u origin ${baseBranch}`);
      process.exit(1);
    }
    console.log('Remote branch verified ✓\n');
  } catch (e) {
    console.error(`\nWarning: could not verify remote branch (${e.message}). Continuing anyway.`);
  }

  // Load persistent state
  const state = loadState();
  if (state.reviewQueue.length > 0) {
    console.log(`Loaded ${state.reviewQueue.length} review-queue item(s) from previous run.`);
  }

  // Recover in-flight agents from a previous interrupted run
  await recoverInFlightAgents(state, baseBranch, repo);

  // ── Worker pool: fill slots, poll, merge/PR, refill ────────────────────────

  console.log('\n── Filling initial agent pool ──────────────────────────────');
  const summary = await readTrackerSummaryAsync();
  console.log(`  Tracker: ${formatSummary(summary)}`);

  await fillAgentSlots(state, baseBranch, repo);

  if (state.inFlight.length === 0) {
    console.log('  No dispatchable work found.');
    logSessionCostSummary(state);
    await printFinalReport(state.reviewQueue);
  } else {
    console.log(`\n── Pool active: ${state.inFlight.length}/${NUM_AGENTS} slots ──────────────────────`);
    console.log(`  Polling every ${POLL_MS / 1000}s...`);

    for (let poll = 1; poll <= MAX_POLLS && state.inFlight.length > 0; poll++) {
      await sleep(POLL_MS);

      const autoMergeEntries = [];
      let slotsFreed = false;

      for (const entry of [...state.inFlight]) {
        try {
          const result = await checkAgent(entry.agentId);
          if (result.status === 'FINISHED') {
            const dur = Math.round((Date.now() - new Date(entry.launchedAt).getTime()) / 1000);
            console.log(`\n  ✓ [${entry.mode}] ${entry.label.slice(0, 60)} — ${dur}s`);
            recordCompletion(state, entry, result);
            removeInFlight(state, entry.agentId);
            slotsFreed = true;
            if (entry.mode === 'val' || entry.mode === 'unblock') {
              const prUrl = await createPullRequest(entry.branchName, baseBranch, entry, repo);
              state.reviewQueue.push({
                mode: entry.mode, label: entry.label,
                branchName: entry.branchName, url: prUrl || result.url,
              });
              saveState(state);
            } else {
              autoMergeEntries.push(entry);
            }
          } else if (result.status === 'ERROR') {
            console.log(`\n  ✗ ${entry.agentId} [${entry.mode}] ERROR: ${result.summary ?? 'no summary'}`);
            removeInFlight(state, entry.agentId);
            slotsFreed = true;
          } else {
            process.stdout.write('.');
          }
        } catch (err) {
          console.error(`\n  Poll error for ${entry.agentId}: ${err.message}`);
        }
      }

      // Batch-merge all auto-mergeable branches that finished this cycle
      if (autoMergeEntries.length > 0) {
        await mergeBranches(autoMergeEntries, baseBranch);
      }

      // Fill any freed slots with new work
      if (slotsFreed) {
        await fillAgentSlots(state, baseBranch, repo);
      }

      if (state.inFlight.length > 0) {
        const modes = {};
        for (const e of state.inFlight) modes[e.mode] = (modes[e.mode] || 0) + 1;
        const modeStr = Object.entries(modes).map(([m, n]) => `${n} ${m}`).join(', ');
        const timing  = formatTimingStats(state);
        console.log(`\n  [${state.inFlight.length}/${NUM_AGENTS} slots: ${modeStr}]${timing ? `  ${timing}` : ''}`);
      }
    }

    logSessionCostSummary(state);
    await printFinalReport(state.reviewQueue);
  }

  // Clear the state file on clean exit
  saveState({ inFlight: [], reviewQueue: [] });

  console.log('\nOrchestrator finished.');
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
