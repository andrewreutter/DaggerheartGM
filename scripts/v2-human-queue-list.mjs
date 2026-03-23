#!/usr/bin/env node
/**
 * Lists human-pending rows for the Human approval queue agent:
 * - Active **Blocked / API Extension Requests** table rows (design approval)
 * - Gated feature rows with Status `Awaiting Human` (fix approval)
 *
 * Cursor agents run this — not an interactive human CLI.
 *
 * Usage:
 *   npm run v2:human-queue
 *   node scripts/v2-human-queue-list.mjs [--json] [--tracker=path]
 */
import { readFileSync } from 'fs';

import {
  collectActiveBlockedApiRows,
  collectFeatureRowsWithLines,
  loadToReviewText,
  trackerPathFromOpts,
} from './lib/v2-tracker-pipeline.mjs';

function parseArgs(argv) {
  let json = false;
  let tracker = null;
  for (const a of argv) {
    if (a === '--json') json = true;
    else if (a.startsWith('--tracker=')) tracker = a.slice('--tracker='.length);
  }
  return { json, tracker };
}

/**
 * @param {string} text — full tracker markdown
 * @returns {Array<
 *   | { kind: 'blocked-api'; approvalType: 'design'; line: number; resolution: string; features: string; srdRequirement: string; status: string; agent: string; notes: string }
 *   | { kind: 'awaiting-human'; approvalType: 'fix'; line: number; sourceFile: string; status: string; domain: string | null; tier: number | null; section: string }
 * >}
 */
export function buildHumanApprovalQueue(text, toReviewText = '') {
  const blockedApi = collectActiveBlockedApiRows(text).map((r) => ({
    kind: 'blocked-api',
    approvalType: 'design',
    line: r.line,
    resolution: r.resolution,
    features: r.cells[1] ?? '',
    srdRequirement: r.cells[2] ?? '',
    status: r.status,
    agent: r.cells[4] ?? '',
    notes: r.cells[5] ?? '',
  }));

  const awaiting = collectFeatureRowsWithLines(text, toReviewText)
    .filter((r) => r.status === 'Awaiting Human')
    .map((r) => ({
      kind: 'awaiting-human',
      approvalType: 'fix',
      line: r.line,
      sourceFile: r.sourceFile,
      status: r.status,
      domain: r.domain,
      tier: r.tier,
      section: r.section,
    }));

  return [...blockedApi, ...awaiting];
}

function main() {
  const { json, tracker: trackerOpt } = parseArgs(process.argv.slice(2));
  const trackerPath = trackerPathFromOpts({ tracker: trackerOpt });
  const text = readFileSync(trackerPath, 'utf8');
  const toReview = loadToReviewText(trackerPath);
  const queue = buildHumanApprovalQueue(text, toReview);

  if (json) {
    console.log(
      JSON.stringify(
        {
          trackerPath,
          count: queue.length,
          rows: queue,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (queue.length === 0) {
    console.log(
      'No pending human approvals: no active Blocked/API rows (Open / In Progress) and no gated rows with Status `Awaiting Human` in docs/v2-migration-tracker.md.',
    );
    console.log('(Also Grep docs/v2-migration-to-review.md for `Awaiting Human` if you use it there.)');
    return;
  }

  let n = 1;
  for (const r of queue) {
    if (r.kind === 'blocked-api') {
      console.log(
        `${n}. [DESIGN] ${r.resolution} — ${r.features} (line ${r.line})`,
      );
    } else {
      const loc =
        r.section === 'abilities' && r.tier != null
          ? `[Tier ${r.tier}] ${r.domain ?? '—'}`
          : r.section;
      console.log(`${n}. [FIX] ${loc} — ${r.sourceFile} (line ${r.line})`);
    }
    n++;
  }
}

main();
