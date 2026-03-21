#!/usr/bin/env node
/**
 * scripts/orchestrate.js
 *
 * Parallel overnight Cursor Cloud Agents orchestrator for DaggerheartGM V2 feature development.
 *
 * Four agent modes run fully autonomously (finish dependency, not start dependency):
 *   impl    — implement Unclaimed features; branches auto-merged
 *   val     — validate Done features; branches auto-merged
 *   fix     — fix Needs Fix features; branches queued for human review
 *   unblock — implement Open blocked engine extensions; branches queued for human review
 *
 * Fix and Unblock agents do all their work and exit.  Their branches are NOT auto-merged —
 * they are listed in the final "Ready for Review" report so you can inspect and merge them
 * when you wake up.
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
 *   --agents N        parallel agents per round (default: 3)
 *   --model M         model for impl / fix / unblock (default: claude-4.6-opus-high-thinking)
 *   --val-model M     model for val (default: claude-4.6-opus-high-thinking-fast)
 *   --impl-only       only run impl agents
 *   --val-only        only run val agents
 *   --no-fix          skip fix agents this run
 *   --no-unblock      skip unblock agents this run
 *   --max-rounds N    safety exit after N rounds (default: 100)
 *   --batch-size N    max features per impl/val agent batch (default: 5)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

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
const MAX_ROUNDS   = parseInt(getArg('--max-rounds', '100'), 10);
const BATCH_SIZE   = parseInt(getArg('--batch-size', '5'),   10);
const POLL_MS      = 60_000;
const STALE_MS     = 4 * 60 * 60 * 1000; // 4 hours — prune agents older than this

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
if (!CURSOR_API_KEY) {
  console.error('Error: CURSOR_API_KEY is not set.  Add it to .env — see .env.example.');
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
  if (!existsSync(STATE_FILE)) return { inFlight: [], reviewQueue: [] };
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { inFlight: [], reviewQueue: [] };
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

// ── Tracker helpers ───────────────────────────────────────────────────────────

const TRACKER = 'docs/v2-migration-tracker.md';

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

const ALL_COLLECTIONS = Object.values(SOURCE_TO_COLLECTION);

const STATUS_KEYS = ['Validated', 'Reviewed', 'Validating', 'Done', 'In Progress',
                     'Unclaimed', 'Needs Fix', 'Fixing', 'Blocked', 'Skipped'];

function collectionFromSourceFile(src) {
  const prefix = (src || '').split('/')[0];
  return SOURCE_TO_COLLECTION[prefix] || null;
}

/** Read the TOTAL row from the Summary table (lines 1-20). */
function readTrackerSummary() {
  const lines = readFileSync(TRACKER, 'utf8').split('\n').slice(0, 20);
  for (const line of lines) {
    if (!line.includes('TOTAL')) continue;
    const cols = line.split('|').map(c => c.trim().replace(/\*\*/g, '')).filter(Boolean);
    return {
      total:      parseInt(cols[1],  10) || 0,
      validated:  parseInt(cols[2],  10) || 0,
      reviewed:   parseInt(cols[3],  10) || 0,
      validating: parseInt(cols[4],  10) || 0,
      done:       parseInt(cols[5],  10) || 0,
      inProgress: parseInt(cols[6],  10) || 0,
      unclaimed:  parseInt(cols[7],  10) || 0,
      needsFix:   parseInt(cols[8],  10) || 0,
      fixing:     parseInt(cols[9],  10) || 0,
      blocked:    parseInt(cols[10], 10) || 0,
      skipped:    parseInt(cols[11], 10) || 0,
    };
  }
  return {};
}

/** Return feature rows matching any status in the filter array. */
function parseFeatureRows(statusFilter) {
  const lines = readFileSync(TRACKER, 'utf8').split('\n');
  const features = [];
  for (const line of lines) {
    if (!line.startsWith('| ') || line.includes('---') || line.includes('Feature Name')
        || line.includes('Resolution') || line.includes('Collection')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 3) continue;
    const [name, sourceFile, status] = cols;
    if (statusFilter.includes(status)) {
      features.push({ name, sourceFile, status, collection: collectionFromSourceFile(sourceFile) });
    }
  }
  return features;
}

/** Return Open blocked resolution rows (for dispatching Unblock agents and the report). */
function parseBlockedRows() {
  const content = readFileSync(TRACKER, 'utf8');
  const items = [];
  let inBlocked = false;
  for (const line of content.split('\n')) {
    if (line.startsWith('## Blocked')) { inBlocked = true; continue; }
    if (!inBlocked) continue;
    if (!line.startsWith('| ') || line.includes('---') || line.includes('Resolution')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 4) continue;
    const [resolution, features, srdReq, status, , notes] = cols;
    if (status === 'Open') items.push({ resolution, features, srdReq: srdReq || '', notes: notes || '' });
  }
  return items;
}

/** Recount every feature row and rewrite the Summary table in-place. */
function regenerateSummaryTable() {
  const content = readFileSync(TRACKER, 'utf8');
  const lines = content.split('\n');

  const counts = {};
  for (const c of ALL_COLLECTIONS) { counts[c] = {}; for (const s of STATUS_KEYS) counts[c][s] = 0; }

  let inBlocked = false;
  for (const line of lines) {
    if (line.startsWith('## Blocked')) { inBlocked = true; continue; }
    if (inBlocked) continue;
    if (!line.startsWith('| ') || line.includes('---') || line.includes('Feature Name')
        || line.includes('Collection')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 3) continue;
    const coll = collectionFromSourceFile(cols[1]);
    const status = cols[2];
    if (coll && counts[coll] && STATUS_KEYS.includes(status)) counts[coll][status]++;
  }

  const totals = {};
  for (const s of STATUS_KEYS) totals[s] = 0;

  const newRows = [];
  for (const coll of ALL_COLLECTIONS) {
    const c = counts[coll];
    const total = STATUS_KEYS.reduce((sum, s) => sum + c[s], 0);
    for (const s of STATUS_KEYS) totals[s] += c[s];
    newRows.push(
      `| ${coll} | ${total} | ${c.Validated} | ${c.Reviewed} | ${c.Validating} | ${c.Done} | ${c['In Progress']} | ${c.Unclaimed} | ${c['Needs Fix']} | ${c.Fixing} | ${c.Blocked} | ${c.Skipped} |`
    );
  }
  const grand = STATUS_KEYS.reduce((sum, s) => sum + totals[s], 0);
  newRows.push(
    `| **TOTAL** | **${grand}** | **${totals.Validated}** | **${totals.Reviewed}** | **${totals.Validating}** | **${totals.Done}** | **${totals['In Progress']}** | **${totals.Unclaimed}** | **${totals['Needs Fix']}** | **${totals.Fixing}** | **${totals.Blocked}** | **${totals.Skipped}** |`
  );

  const headerLine = '| Collection | Total | Validated | Reviewed | Validating | Done | In Progress | Unclaimed | Needs Fix | Fixing | Blocked | Skipped |';
  const hIdx = content.indexOf(headerLine);
  if (hIdx === -1) { console.error('  regenerate: could not find Summary table header'); return; }

  const afterHeader = content.indexOf('\n', hIdx) + 1;
  const afterSep    = content.indexOf('\n', afterHeader) + 1;
  const dividerIdx  = content.indexOf('\n---', afterSep);
  if (dividerIdx === -1) { console.error('  regenerate: could not find section divider'); return; }

  const newContent = content.slice(0, afterSep) + newRows.join('\n') + '\n' + content.slice(dividerIdx);
  writeFileSync(TRACKER, newContent, 'utf8');
  console.log('  Summary table regenerated.');
}

// ── Batch assignment ──────────────────────────────────────────────────────────

function assignBatches(features, numAgents) {
  const groups = {};
  for (const f of features) {
    const key = f.collection || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  const chunks = [];
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    for (let i = 0; i < group.length; i += BATCH_SIZE) {
      chunks.push({ collection: key, features: group.slice(i, i + BATCH_SIZE) });
    }
  }
  return chunks.slice(0, numAgents);
}

function batchLabel(batch) {
  const names = batch.features.map(f => f.name).join(', ');
  return `[${batch.collection}] ${names}`;
}

// ── Agent prompt builders ─────────────────────────────────────────────────────

function buildImplPrompt(features) {
  const list = features.map(f => `- ${f.name} (${f.sourceFile})`).join('\n');
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/implementation-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned features (do NOT claim other features):
${list}

If any feature in your list is already In Progress, Done, or otherwise not Unclaimed when you check it, skip it and continue with the remaining features.  Do NOT re-run mode selection or claim replacement features.

OVERRIDE 2 — Do NOT update the Summary table in docs/v2-migration-tracker.md (lines 7-19).  Only update the specific feature rows listed above.  The orchestrator regenerates the Summary table after merging all branches.

OVERRIDE 3 — Before running tests, ensure dependencies are installed:
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run test:unit

Now read docs/agent-prompts/implementation-agent.md and implement each feature above.`;
}

function buildValPrompt(features) {
  const list = features.map(f => `- ${f.name} (${f.sourceFile})`).join('\n');
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/validation-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned features to validate (do NOT claim other features):
${list}

If any feature in your list is already Validating, Validated, or otherwise not in Done status when you check it, skip it and continue with the remaining features.  Do NOT re-run mode selection or claim replacement features.

OVERRIDE 2 — Do NOT update the Summary table in docs/v2-migration-tracker.md (lines 7-19).  Only update the specific feature rows listed above.  The orchestrator regenerates the Summary table after merging all branches.

OVERRIDE 3 — Before running tests:
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run test:unit

Now read docs/agent-prompts/validation-agent.md and validate each feature above.`;
}

function buildFixPrompt(feature) {
  return `AUTONOMOUS ORCHESTRATOR MODE

You are running as part of a parallel overnight batch.  Read and follow docs/agent-prompts/fixit-agent.md with these overrides:

OVERRIDE 1 — Pre-assigned feature to fix:
- ${feature.name} (${feature.sourceFile})

If this feature is not in Needs Fix status when you check it, exit immediately without making any changes.

OVERRIDE 2 — After fixing the code and passing tests, update the tracker row:
  - Set Status to "Done" (not "Fixing" or "Validated" — back to Done so the val agent re-validates it)
  - Write a brief summary of what you changed in the Fix Notes column
  Do NOT stop and wait for human verification.  The orchestrator will auto-merge your branch and the val agent will pick it up next round.  The human will review the code naturally when promoting Validated → Reviewed.

OVERRIDE 3 — Do NOT update the Summary table in docs/v2-migration-tracker.md (lines 7-19).

OVERRIDE 4 — Before running tests:
  export PATH="/Users/andrewreutter/.nvm/versions/node/v25.2.1/bin:$PATH"
  npm install
  npm run test:unit

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
  c. Leave the resolution row in the ACTIVE Blocked table — do NOT move it to docs/v2-blocked-resolutions-done.md.  The human will archive it after reviewing and merging your branch.
  The orchestrator will present your branch for human sign-off before merging.

OVERRIDE 3 — Do NOT update the Summary table in docs/v2-migration-tracker.md (lines 7-19).

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

/**
 * Check a single agent's status via the API.
 * Returns { status: 'RUNNING'|'FINISHED'|'ERROR', url?, summary? }
 */
async function checkAgent(agentId) {
  const agent = await apiGet(`/v0/agents/${agentId}`);
  return {
    status:     agent.status,
    url:        agent.target?.url ?? null,
    branchName: agent.target?.branchName ?? null,
    summary:    agent.summary ?? '',
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

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function createPullRequest(branchName, baseBranch, entry, repo) {
  if (!GITHUB_TOKEN) {
    console.error('    ✗ GITHUB_TOKEN not set — cannot create PR. Add it to .env.');
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
        Authorization: `Bearer ${GITHUB_TOKEN}`,
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

function mergeBranches(branches, baseBranch) {
  console.log('\n── Merging branches ────────────────────────────────────────');

  try { git(`git pull origin ${baseBranch} --no-rebase`, { quiet: true }); } catch (_) {}
  try { git('git fetch origin', { quiet: true }); } catch (e) { console.error('git fetch failed:', e.message); }

  for (const branch of branches) {
    console.log(`  Merging origin/${branch}...`);
    try {
      git(`git merge origin/${branch} --no-edit -m "chore: merge agent branch ${branch}"`, { quiet: true });
    } catch (_) {
      console.log(`  Conflict in ${branch} — auto-resolving...`);
      try {
        const conflicted = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' })
          .trim().split('\n').filter(Boolean);
        for (const file of conflicted) {
          execSync(`git checkout ${file === TRACKER ? '--ours' : '--theirs'} "${file}"`, { encoding: 'utf8' });
          execSync(`git add "${file}"`, { encoding: 'utf8' });
        }
        git(`git commit -m "chore: merge ${branch} (conflict resolved)"`, { quiet: true });
        console.log(`  Resolved.`);
      } catch (e2) {
        console.error(`  Could not resolve merge for ${branch}: ${e2.message}`);
        try { git('git merge --abort', { quiet: true }); } catch (_) {}
      }
    }
  }

  regenerateSummaryTable();

  try {
    git(`git add ${TRACKER}`, { quiet: true });
    git('git commit -m "chore: regenerate tracker Summary table" --allow-empty', { quiet: true });
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

function printFinalReport(reviewQueue) {
  const line    = '═'.repeat(56);
  const summary = readTrackerSummary();

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

  const needsFix = parseFeatureRows(['Needs Fix']);
  const blocked  = parseBlockedRows();

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
  const autoMergeable = [];

  for (const entry of [...state.inFlight]) {
    try {
      const result = await checkAgent(entry.agentId);
      if (result.status === 'FINISHED') {
        console.log(`  ✓ ${entry.agentId} [${entry.mode}] FINISHED`);
        removeInFlight(state, entry.agentId);
        if (entry.mode === 'val' || entry.mode === 'unblock') {
          const prUrl = await createPullRequest(entry.branchName, baseBranch, entry, repo);
          state.reviewQueue.push({
            mode: entry.mode, label: entry.label,
            branchName: entry.branchName, url: prUrl || result.url,
          });
          saveState(state);
        } else {
          autoMergeable.push(entry.branchName);
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
  if (autoMergeable.length > 0) {
    mergeBranches(autoMergeable, baseBranch);
  }

  // Poll remaining running agents
  if (stillRunning.length > 0) {
    console.log(`\n  Resuming poll of ${stillRunning.length} running agent(s)...`);
    await pollAgents(stillRunning, {
      async onFinished(entry, result) {
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
    const justFinished = stillRunning
      .filter(e => !state.inFlight.some(s => s.agentId === e.agentId) && e.mode !== 'unblock' && e.mode !== 'val')
      .map(e => e.branchName);
    if (justFinished.length > 0) {
      mergeBranches(justFinished, baseBranch);
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
  console.log(`Batch size: ${BATCH_SIZE} | Max rounds: ${MAX_ROUNDS}`);

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

  let reportPrinted = false;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    try { git(`git pull origin ${baseBranch} --no-rebase`, { quiet: true }); } catch (_) {}

    const summary    = readTrackerSummary();
    const hasImplWork = !VAL_ONLY   && summary.unclaimed > 0;
    const hasVal      = !IMPL_ONLY  && summary.done > 0;
    const hasFix      = !NO_FIX    && !IMPL_ONLY && !VAL_ONLY && summary.needsFix > 0;
    const hasUnblock  = !NO_UNBLOCK && !IMPL_ONLY && !VAL_ONLY && summary.blocked > 0;

    console.log(`\n── Round ${round} ──────────────────────────────────────────`);
    console.log(`  Tracker: ${formatSummary(summary)}`);

    const anyWork = hasImplWork || hasVal || hasFix || hasUnblock;

    if (!anyWork) {
      printFinalReport(state.reviewQueue);
      reportPrinted = true;
      break;
    }

    // Build sets of in-flight item names/resolutions for dedup
    const inFlightNames       = getInFlightItemNames(state);
    const inFlightResolutions = getInFlightResolutions(state);

    if (inFlightNames.size > 0 || inFlightResolutions.size > 0) {
      console.log(`  In-flight: ${inFlightNames.size} feature(s), ${inFlightResolutions.size} resolution(s)`);
    }

    // Allocate agents: Fix > Unblock > Val/Impl
    let remaining = NUM_AGENTS;
    let numFix     = 0, numUnblock = 0, numVal = 0, numImpl = 0;

    if (hasFix && remaining > 0)     { numFix = 1;     remaining--; }
    if (hasUnblock && remaining > 0) { numUnblock = 1; remaining--; }

    if (hasImplWork && hasVal && remaining > 0) {
      numImpl = Math.ceil(remaining / 2);
      numVal  = remaining - numImpl;
    } else if (hasImplWork && remaining > 0) {
      numImpl = remaining;
    } else if (hasVal && remaining > 0) {
      numVal = remaining;
    }

    console.log(`  Dispatching: ${numFix} fix, ${numUnblock} unblock, ${numVal} val, ${numImpl} impl`);

    // Gather work items, filtering out anything already in-flight
    const fixFeatures  = hasFix
      ? parseFeatureRows(['Needs Fix']).filter(f => !inFlightNames.has(f.name)).slice(0, numFix) : [];
    const unblockItems = hasUnblock
      ? parseBlockedRows().filter(r => !inFlightResolutions.has(r.resolution)).slice(0, numUnblock) : [];
    const valFeatures  = hasVal
      ? parseFeatureRows(['Done']).filter(f => !inFlightNames.has(f.name)) : [];
    const implFeatures = hasImplWork
      ? parseFeatureRows(['Unclaimed']).filter(f => !inFlightNames.has(f.name)) : [];

    const valBatches  = assignBatches(valFeatures,  numVal);
    const implBatches = assignBatches(implFeatures, numImpl);

    // Build the full dispatch list
    const ts = timestamp();
    const roundEntries = []; // state entries for this round's new agents

    const dispatches = [
      ...fixFeatures.map(   (f, i) => ({ mode: 'fix',     label: `${f.name} (${f.sourceFile})`,               data: f,                idx: i + 1 })),
      ...unblockItems.map(  (r, i) => ({ mode: 'unblock', label: r.resolution,                                data: r,                idx: i + 1 })),
      ...valBatches.map(    (b, i) => ({ mode: 'val',     label: batchLabel(b),  data: b.features, idx: i + 1 })),
      ...implBatches.map(   (b, i) => ({ mode: 'impl',    label: batchLabel(b),  data: b.features, idx: i + 1 })),
    ];

    for (const { mode, label, data, idx } of dispatches) {
      const branchName = `orchestrate/${mode}-${idx}-${ts}`;
      console.log(`  [${mode.toUpperCase().padEnd(7)}] ${label.slice(0, 100)}`);

      let prompt, agentModel;
      if      (mode === 'impl')    { prompt = buildImplPrompt(data);    agentModel = MODEL; }
      else if (mode === 'val')     { prompt = buildValPrompt(data);     agentModel = VAL_MODEL; }
      else if (mode === 'fix')     { prompt = buildFixPrompt(data);     agentModel = MODEL; }
      else                         { prompt = buildUnblockPrompt(data); agentModel = MODEL; }

      try {
        const id = await launchAgent(prompt, branchName, repo, agentModel, baseBranch);
        console.log(`    → Agent ${id}`);

        // Build the state entry with item names for dedup
        const items = mode === 'unblock'
          ? []
          : (Array.isArray(data) ? data : [data]).map(f => f.name);
        const entry = {
          agentId: id, branchName, mode, label,
          items,
          resolution: mode === 'unblock' ? data.resolution : null,
          launchedAt: new Date().toISOString(),
        };
        addInFlight(state, entry);
        roundEntries.push(entry);
      } catch (err) {
        console.error(`    ✗ Launch failed: ${err.message}`);
      }

      await sleep(3_000);
    }

    if (roundEntries.length === 0) {
      console.error('No agents launched this round.  Aborting.');
      break;
    }

    // Poll until all agents in this round reach a terminal state
    console.log(`\n  Polling ${roundEntries.length} agent(s) every ${POLL_MS / 1000}s...`);

    const autoMergeableBranches = [];

    await pollAgents(roundEntries, {
      async onFinished(entry, result) {
        removeInFlight(state, entry.agentId);
        if (entry.mode === 'val' || entry.mode === 'unblock') {
          const prUrl = await createPullRequest(entry.branchName, baseBranch, entry, repo);
          state.reviewQueue.push({
            mode: entry.mode, label: entry.label,
            branchName: entry.branchName, url: prUrl || result.url,
          });
          saveState(state);
        } else {
          autoMergeableBranches.push(entry.branchName);
        }
      },
      onFailed(entry) {
        removeInFlight(state, entry.agentId);
      },
    });

    // Auto-merge impl/fix branches (val and unblock go to PRs)
    if (autoMergeableBranches.length > 0) {
      mergeBranches(autoMergeableBranches, baseBranch);
    }
  }

  if (!reportPrinted) printFinalReport(state.reviewQueue);

  // Clear the state file on clean exit
  saveState({ inFlight: [], reviewQueue: [] });

  console.log('\nOrchestrator finished.');
}

main().catch(err => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
