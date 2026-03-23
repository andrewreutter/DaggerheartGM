#!/usr/bin/env node
/**
 * Runs N parallel workers; each repeatedly invokes scripts/cursor-v2-ticket.mjs until
 * the tracker has no claimable work (exit code 5).
 *
 * Records wall-clock duration per successful ticket in .cursor-v2-pool-metrics.json and
 * prints rolling ETA from an EMA (time per ticket × remaining gated features, adjusted
 * for parallel workers as a rough lower bound).
 *
 * Each child runs `cursor-v2-ticket.mjs`, which escalates to **Awaiting Human** if
 * validation returns **Needs Fix** too many times in one run (`--max-validation-failures`,
 * env `CURSOR_V2_MAX_VALIDATION_FAILURES`, default 2). Pass the env through your shell
 * if you need a different threshold for pool workers.
 *
 * Usage:
 *   node scripts/cursor-v2-pool.mjs [--workers=10] [--tracker=path] [--reset-metrics]
 *
 * Workers share docs/v2-migration-tracker.md via .cursor-v2-tracker.lock (atomic open).
 */
import { spawn } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { summarizeGatedCollections, loadToReviewText } from './lib/v2-tracker-pipeline.mjs';
import {
  recordCompletedRun,
  formatPoolBanner,
  metricsPath,
} from './lib/cursor-v2-pool-metrics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const TICKET = join(__dirname, 'cursor-v2-ticket.mjs');

function parseArgs(argv) {
  let workers = 10;
  let tracker = null;
  let resetMetrics = false;
  for (const a of argv) {
    if (a.startsWith('--workers=')) workers = Math.max(1, parseInt(a.slice('--workers='.length), 10) || 10);
    else if (a.startsWith('--tracker=')) tracker = a.slice('--tracker='.length);
    else if (a === '--reset-metrics') resetMetrics = true;
  }
  return { workers, tracker, resetMetrics };
}

/** Serialize metrics read/write across parallel workers (same process). */
let metricsGate = Promise.resolve();
function withMetrics(fn) {
  const p = metricsGate.then(() => fn());
  metricsGate = p.catch(() => {});
  return p;
}

function defaultTrackerPath(tracker) {
  return tracker || join(REPO_ROOT, 'docs/v2-migration-tracker.md');
}

function spawnOneTicket(tracker) {
  const args = [TICKET];
  if (tracker) args.push(`--tracker=${tracker}`);
  const t0 = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env },
    });
    child.on('exit', (code) => {
      resolve({ code, durationMs: Date.now() - t0 });
    });
  });
}

async function runWorker(workerId, tracker, trackerPath, workers) {
  for (;;) {
    const { code, durationMs } = await spawnOneTicket(tracker);
    if (code === 5) return;
    if (code !== 0) {
      console.error(`[worker ${workerId}] cursor-v2-ticket exited with ${code}; stopping.`);
      return;
    }
    await withMetrics(async () => {
      const text = readFileSync(trackerPath, 'utf8');
      const { remain } = summarizeGatedCollections(text, loadToReviewText(trackerPath));
      const { line } = recordCompletedRun({
        durationMs,
        remain,
        workers,
        repoRoot: REPO_ROOT,
      });
      console.error(line);
    });
  }
}

async function main() {
  const { workers, tracker, resetMetrics } = parseArgs(process.argv.slice(2));
  const trackerPath = defaultTrackerPath(tracker);

  if (resetMetrics && existsSync(metricsPath(REPO_ROOT))) {
    unlinkSync(metricsPath(REPO_ROOT));
    console.error('Reset pool metrics file.');
  }

  const initialText = readFileSync(trackerPath, 'utf8');
  const { remain: initialRemain } = summarizeGatedCollections(initialText, loadToReviewText(trackerPath));
  console.error(`Starting ${workers} parallel cursor-v2-ticket workers (repo ${REPO_ROOT}).`);
  console.error(formatPoolBanner({ repoRoot: REPO_ROOT, remain: initialRemain, workers }));

  const tasks = [];
  for (let i = 0; i < workers; i++) {
    tasks.push(runWorker(i + 1, tracker, trackerPath, workers));
  }
  await Promise.all(tasks);

  const finalText = readFileSync(trackerPath, 'utf8');
  const { remain: finalRemain } = summarizeGatedCollections(finalText, loadToReviewText(trackerPath));
  console.error(
    `All workers idle (no claimable work). ${finalRemain} gated features remain (not Validated/Reviewed).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
