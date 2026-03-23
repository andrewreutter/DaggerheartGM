#!/usr/bin/env node
/**
 * Single-ticket runner: claims one row in docs/v2-migration-tracker.md, then drives
 * Cursor CLI `agent` steps until a terminal state (Validated, Awaiting Human, Blocked, …).
 *
 * Prerequisites: `cursor` on PATH, CURSOR_API_KEY (or `cursor login`), network for API.
 *
 * Usage:
 *   node scripts/cursor-v2-ticket.mjs [--dry-run] [--tracker=path] [--max-validation-failures=N]
 *
 * If **validate** returns **Needs Fix** at least **N** times in one ticket run (Done↔Needs Fix
 * loop), the row is set to **Awaiting Human** with a Fix Notes line instead of Needs Fix.
 * Default N=2. Override with `--max-validation-failures=` or env `CURSOR_V2_MAX_VALIDATION_FAILURES`.
 *
 * Prints gated-collection stats (abilities + beastforms + items + consumables): total,
 * validated, reviewed, blocked, and remain (not Validated/Reviewed) after claim, on exit,
 * and on dry-run / no-work paths.
 *
 * Exit codes:
 *   0 — finished one ticket through a terminal state (or dry-run ok)
 *   5 — no claimable work
 *   1 — error (spawn failure, unparseable state after retry)
 */
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  REPO_ROOT,
  trackerPathFromOpts,
  toReviewPathFromTrackerPath,
  findNextWorkItem,
  claimWorkItem,
  applyTrackerUpdate,
  loadTracker,
  loadToReviewText,
  saveTracker,
  normalizeStateToken,
  extractLastStateLine,
  withFileLock,
  randomAgentId,
  summarizeGatedCollections,
  formatTrackerStatsLine,
} from './lib/v2-tracker-pipeline.mjs';

const EXIT_NO_WORK = 5;
const EXIT_ERR = 1;

const TERMINAL = new Set(['Validated', 'Awaiting Human', 'Reviewed', 'Blocked', 'Skipped']);

function parseArgs(argv) {
  let dryRun = false;
  let tracker = null;
  let maxValidationFailures = 2;
  const envN = process.env.CURSOR_V2_MAX_VALIDATION_FAILURES;
  if (envN != null && envN !== '') {
    const n = parseInt(envN, 10);
    if (Number.isFinite(n) && n >= 1) maxValidationFailures = n;
  }
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--tracker=')) tracker = a.slice('--tracker='.length);
    else if (a.startsWith('--max-validation-failures=')) {
      const n = parseInt(a.slice('--max-validation-failures='.length), 10);
      if (Number.isFinite(n) && n >= 1) maxValidationFailures = n;
    }
  }
  return { dryRun, tracker, maxValidationFailures };
}

function readSnippet(rel, max = 8000) {
  try {
    return readFileSync(join(REPO_ROOT, rel), 'utf8').slice(0, max);
  } catch {
    return `(could not read ${rel})`;
  }
}

function modeFromFeatureStatus(status) {
  if (status === 'In Progress') return 'implement';
  if (status === 'Done') return 'validate';
  if (status === 'Validating') return 'validate';
  if (status === 'Fixing') return 'fix';
  if (status === 'Needs Fix') return 'fix';
  return null;
}

function allowedTokensForMode(mode) {
  switch (mode) {
    case 'implement':
      return ['Done', 'Blocked', 'InProgress'];
    case 'validate':
      return ['Validated', 'NeedsFix', 'Validating'];
    case 'fix':
      return ['Done', 'Validated', 'AwaitingHuman'];
    case 'unblock':
      return ['Done', 'AwaitingHuman', 'InProgress'];
    default:
      return [];
  }
}

function promptFileForMode(mode) {
  switch (mode) {
    case 'implement':
      return 'docs/agent-prompts/implementation-agent.md';
    case 'validate':
      return 'docs/agent-prompts/validation-agent.md';
    case 'fix':
      return 'docs/agent-prompts/fixit-agent.md';
    case 'unblock':
      return 'docs/agent-prompts/unblocking-agent.md';
    default:
      return 'docs/agent-prompts/implementation-agent.md';
  }
}

function buildPrompt({ mode, sourcePath, resolution, allowedWords }) {
  const guide = readSnippet('docs/feature-authoring-guide.md', 12000);
  const conv = readSnippet('docs/v2-code-conventions.md', 8000);
  const agentMd = readSnippet(promptFileForMode(mode), 10000);

  const target =
    mode === 'unblock'
      ? `Blocked / API resolution (see tracker table): ${resolution}\nImplement or progress per unblocking-agent instructions; touch engine files under src/features-v2/engine/ as needed.`
      : `Feature source: ${sourcePath}\nRegister in src/features-v2/abilities/index.js (or the appropriate registry) when adding a new ability file.`;

  return `You are running inside an automated pipeline. Follow the agent instructions below.

=== Repository ===
${REPO_ROOT}

=== MUST READ (instructions) ===
${agentMd}

=== Reference (do not paste back) ===
--- feature-authoring-guide (excerpt) ---
${guide.slice(0, 6000)}
--- v2-code-conventions (excerpt) ---
${conv.slice(0, 4000)}

=== Task ===
${target}

=== Hard rules ===
- Do NOT read or edit docs/v2-migration-tracker.md (the shell script updates it).
- Run npm run validate:v2-preflight and focused tests (npm run test:unit or vitest on the relevant file) before finishing.
- When your work for this step is complete, print EXACTLY ONE WORD on the LAST line of your response.
- That last line must be one of: ${allowedWords.join(', ')}
- Use InProgress if you must stop early without finishing (leaves the row In Progress).
- Use AwaitingHuman when code is done but a human must merge/review before promotion (fix/unblock paths).
`.trim();
}

function runCursorAgent(prompt, { timeoutMs = 0 } = {}) {
  const args = [
    'agent',
    '--print',
    '--trust',
    '--force',
    '--workspace',
    REPO_ROOT,
    prompt,
  ];
  const r = spawnSync('cursor', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: timeoutMs || undefined,
    env: { ...process.env },
    shell: false,
  });
  const stdout = (r.stdout || '') + (r.stderr ? `\n${r.stderr}` : '');
  return { code: r.status ?? r.signal ? 1 : 0, stdout, error: r.error };
}

function parseStateWithFallback(stdout, allowedCanonical) {
  const allowedSet = new Set(allowedCanonical);
  let s = extractLastStateLine(stdout);
  if (s && allowedSet.has(s)) return s;

  const interpList = [...allowedCanonical].join(', ');
  const interpPrompt = `The previous model output ended with unclear state. Extract the workflow state.

Previous output (tail):
---
${stdout.slice(-6000)}
---

Reply with EXACTLY ONE WORD from: ${interpList}
Nothing before or after that word.`;
  const r2 = runCursorAgent(interpPrompt);
  if (r2.code !== 0) return null;
  const t = extractLastStateLine(r2.stdout);
  if (t && allowedSet.has(t)) return t;
  return null;
}

function canonicalAllowed(mode) {
  const raw = allowedTokensForMode(mode);
  return raw.map((w) => normalizeStateToken(w)).filter(Boolean);
}

function runPipelineStep(mode, ctx) {
  const allowedCanon = canonicalAllowed(mode);
  const allowedWords = allowedTokensForMode(mode);
  const prompt = buildPrompt({
    mode,
    sourcePath: ctx.sourcePath,
    resolution: ctx.resolution,
    allowedWords,
  });
  const r = runCursorAgent(prompt);
  if (r.error) {
    console.error(r.error);
    return null;
  }
  if (r.code !== 0) {
    console.error('cursor agent exited non-zero:', r.code);
    return null;
  }
  const parsed = parseStateWithFallback(r.stdout, allowedCanon);
  return parsed;
}

function defaultLockFile() {
  return join(REPO_ROOT, '.cursor-v2-tracker.lock');
}

function splitMdRow(line) {
  if (!line.startsWith('|')) return [];
  return line
    .split('|')
    .map((c) => c.trim())
    .slice(1, -1);
}

function readFeatureStatus(line, sourceFile) {
  const cells = splitMdRow(line);
  if (cells[2] === sourceFile && sourceFile.includes('abilities/')) return cells[3] ?? '';
  if (cells[1] === sourceFile) return cells[2] ?? '';
  return '';
}

function readBlockedStatus(line, resolution) {
  const cells = splitMdRow(line);
  if (cells[0] === resolution) return cells[3] ?? '';
  return '';
}

function logGatedStats(trackerPath, prelude) {
  try {
    const s = summarizeGatedCollections(loadTracker(trackerPath), loadToReviewText(trackerPath));
    if (prelude) console.log(prelude);
    console.log(formatTrackerStatsLine(s));
  } catch (e) {
    console.error('(tracker stats unavailable)', e?.message ?? e);
  }
}

function exitWithGatedStats(trackerPath, code, prelude) {
  logGatedStats(trackerPath, prelude);
  process.exit(code);
}

function main() {
  const { dryRun, tracker: trackerOpt, maxValidationFailures } = parseArgs(process.argv.slice(2));
  const trackerPath = trackerPathFromOpts({ tracker: trackerOpt });
  const lockFile = defaultLockFile();
  const runId = randomAgentId('run');

  if (dryRun) {
    const text = loadTracker(trackerPath);
    const toReview = loadToReviewText(trackerPath);
    const w = findNextWorkItem(text, toReview);
    if (!w) {
      console.error('No claimable work.');
      exitWithGatedStats(trackerPath, EXIT_NO_WORK, '');
      return;
    }
    const cp = claimWorkItem(text, w, runId);
    console.log('Dry run — would claim:', JSON.stringify(w, null, 2));
    console.log('Would set status / agent:', cp.status, cp.agent);
    logGatedStats(trackerPath, 'Current snapshot:');
    process.exit(0);
  }

  let work = null;
  let claimPatch = null;

  withFileLock(lockFile, () => {
    const text = loadTracker(trackerPath);
    const toReview = loadToReviewText(trackerPath);
    work = findNextWorkItem(text, toReview);
    if (!work) return;
    claimPatch = claimWorkItem(text, work, runId);
    const next = applyTrackerUpdate(text, toReview, {
      kind: claimPatch.kind,
      row: claimPatch.row,
      status: claimPatch.status,
      agent: claimPatch.agent,
    });
    saveTracker(trackerPath, next.trackerText);
    saveTracker(toReviewPathFromTrackerPath(trackerPath), next.toReviewText);
  });

  if (!work) {
    console.error('No claimable work (skipped Validated, Reviewed, Blocked, Awaiting Human, in-flight rows).');
    exitWithGatedStats(trackerPath, EXIT_NO_WORK, '');
    return;
  }

  console.log('Claimed:', work.kind, work.kind === 'feature' ? work.row.sourceFile : work.row.resolution, '→', claimPatch.status, runId);
  logGatedStats(trackerPath, 'After claim:');

  let currentText = loadTracker(trackerPath);
  let toReviewText = loadToReviewText(trackerPath);
  const toReviewPath = toReviewPathFromTrackerPath(trackerPath);
  const lineForFeatureRow = (row) =>
    (row.file === 'to-review' ? toReviewText : currentText).split(/\r?\n/)[row.line - 1];

  let rowRef = work.row;
  let kind = work.kind;
  /** Counts validate-step results of Needs Fix in this process (resets each ticket run). */
  let validationNeedsFixCount = 0;

  for (;;) {
    let mode;
    let sourcePath;
    let resolution;

    if (kind === 'feature') {
      const line = lineForFeatureRow(rowRef);
      const st = readFeatureStatus(line, rowRef.sourceFile);
      if (TERMINAL.has(st) || st === 'Awaiting Human') {
        console.log('Terminal status on tracker:', st);
        exitWithGatedStats(trackerPath, 0, 'Done:');
        return;
      }
      mode = modeFromFeatureStatus(st);
      sourcePath = join('src/features-v2', rowRef.sourceFile);
      resolution = null;
    } else {
      const line = currentText.split(/\r?\n/)[rowRef.line - 1];
      const st = readBlockedStatus(line, rowRef.resolution);
      if (st === 'Done' || st === 'Awaiting Human') {
        console.log('Blocked resolution terminal:', st);
        exitWithGatedStats(trackerPath, 0, 'Done:');
        return;
      }
      mode = 'unblock';
      sourcePath = null;
      resolution = rowRef.resolution;
    }

    if (!mode) {
      console.error('Could not derive agent mode from row status');
      logGatedStats(trackerPath, 'Snapshot:');
      process.exit(EXIT_ERR);
    }

    const newStatus = runPipelineStep(mode, { sourcePath, resolution });
    if (!newStatus) {
      console.error('Could not parse agent state (even after interpreter pass).');
      logGatedStats(trackerPath, 'Snapshot:');
      process.exit(EXIT_ERR);
    }

    let writeStatus = newStatus;
    let fixNotesAppend = null;
    if (kind === 'feature' && mode === 'validate' && newStatus === 'Needs Fix') {
      validationNeedsFixCount += 1;
      if (validationNeedsFixCount >= maxValidationFailures) {
        writeStatus = 'Awaiting Human';
        fixNotesAppend = `**cursor-v2-ticket:** validation returned Needs Fix ${validationNeedsFixCount}× in one run (Done↔Needs Fix loop); escalated ${new Date().toISOString().slice(0, 10)}. Use **Human approval queue** in Cursor after resolving.`;
        console.error(
          `Escalating to Awaiting Human: validation→Needs Fix reached ${validationNeedsFixCount} (threshold ${maxValidationFailures}).`,
        );
      }
    }

    withFileLock(lockFile, () => {
      const t = loadTracker(trackerPath);
      const tr = loadToReviewText(trackerPath);
      if (kind === 'feature') {
        const next = applyTrackerUpdate(t, tr, {
          kind: 'feature',
          row: rowRef,
          status: writeStatus,
          agent: runId,
          fixNotesAppend,
        });
        saveTracker(trackerPath, next.trackerText);
        saveTracker(toReviewPath, next.toReviewText);
      } else {
        const next = applyTrackerUpdate(t, tr, {
          kind: 'blocked',
          row: rowRef,
          status: newStatus,
          agent: runId,
        });
        saveTracker(trackerPath, next.trackerText);
        saveTracker(toReviewPath, next.toReviewText);
      }
    });

    console.log('Updated tracker →', writeStatus);

    currentText = loadTracker(trackerPath);
    toReviewText = loadToReviewText(trackerPath);

    if (TERMINAL.has(writeStatus)) {
      exitWithGatedStats(trackerPath, 0, 'Done:');
      return;
    }
    if (newStatus === 'In Progress' && mode === 'implement') {
      console.log('Implementer stopped In Progress; halting pipeline.');
      exitWithGatedStats(trackerPath, 0, 'Stopped:');
      return;
    }
    if (kind === 'blocked') {
      rowRef = { ...rowRef, status: newStatus };
      continue;
    }

    const lineAfter = lineForFeatureRow(rowRef);
    const stAfter = readFeatureStatus(lineAfter, rowRef.sourceFile);

    if (stAfter === 'Done' && mode === 'fix') {
      withFileLock(lockFile, () => {
        const t = loadTracker(trackerPath);
        const tr = loadToReviewText(trackerPath);
        const next = applyTrackerUpdate(t, tr, {
          kind: 'feature',
          row: rowRef,
          status: 'Validating',
          agent: runId,
        });
        saveTracker(trackerPath, next.trackerText);
        saveTracker(toReviewPath, next.toReviewText);
      });
      currentText = loadTracker(trackerPath);
      toReviewText = loadToReviewText(trackerPath);
      continue;
    }
  }
}

main();
