#!/usr/bin/env node
/**
 * Prints the next V2 implementation queue derived from docs/v2-migration-tracker.md.
 * See docs/agent-prompts/implementation-agent.md (Cross-collection priority, Domain tier order).
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

import {
  parseTrackerMarkdown,
  buildQueueReport,
  formatQueueText,
  injectQueueSection,
  QUEUE_MARKERS,
} from './lib/v2-migration-queue-parse.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_TRACKER = join(ROOT, 'docs/v2-migration-tracker.md');

function parseArgs(argv) {
  let json = false;
  let write = false;
  let limit = 15;
  let trackerPath = DEFAULT_TRACKER;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--write') write = true;
    else if (a === '--limit' && argv[i + 1]) {
      limit = parseInt(argv[++i], 10);
      if (Number.isNaN(limit) || limit < 1) limit = 15;
    } else if (a.startsWith('--tracker=')) {
      trackerPath = a.slice('--tracker='.length);
    } else if (a === '--help' || a === '-h') {
      console.error(`Usage: node scripts/v2-migration-queue.mjs [--json] [--write] [--limit N] [--tracker=path]

  --json       Print machine-readable JSON
  --write      Replace ${QUEUE_MARKERS.start} … ${QUEUE_MARKERS.end} in the tracker (if present)
  --limit N    Max rows to list (default 15)
  --tracker=   Alternate path to v2-migration-tracker.md`);
      process.exit(0);
    }
  }
  return { json, write, limit, trackerPath };
}

function main() {
  const { json, write, limit, trackerPath } = parseArgs(process.argv);
  const text = readFileSync(trackerPath, 'utf8');
  const parsed = parseTrackerMarkdown(text);
  const report = buildQueueReport(parsed, { limit });

  if (json) {
    console.log(JSON.stringify({ ...report, limit }, null, 2));
  } else if (!write) {
    console.log(formatQueueText(report, { limit }));
  }

  if (write) {
    if (!text.includes(QUEUE_MARKERS.start) || !text.includes(QUEUE_MARKERS.end)) {
      console.error('Refusing --write: tracker missing v2-queue markers. Add:');
      console.error(`  ${QUEUE_MARKERS.start}`);
      console.error(`  ${QUEUE_MARKERS.end}`);
      process.exit(1);
    }
    const body = formatQueueText(report, { limit });
    const md = `## Implementation queue (generated)\n\n\`\`\`text\n${body}\n\`\`\``;
    const next = injectQueueSection(text, md);
    writeFileSync(trackerPath, next, 'utf8');
    if (json) {
      // already printed JSON above
    } else {
      console.error('Updated generated queue section in tracker (see Implementation queue block).');
    }
  }
}

main();
