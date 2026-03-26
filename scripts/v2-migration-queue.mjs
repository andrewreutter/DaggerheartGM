#!/usr/bin/env node
/**
 * Prints the V2 implementation queue from GitHub Issues (label `v2-migration`).
 *
 * Requires GITHUB_TOKEN (or GH_TOKEN) and a resolvable GitHub repo.
 *
 * `--write` updates the generated queue block in docs/v2-migration-queue.generated.md
 * (between v2-queue markers).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

import {
  buildQueueReport,
  formatQueueText,
  injectQueueSection,
  QUEUE_MARKERS,
} from './lib/v2-migration-queue-parse.mjs';
import {
  useGithubMigrationTracker,
  listAllV2MigrationIssues,
  issuesToParsedForQueue,
  getGithubTokenFromEnv,
  resolveGithubRepository,
} from './lib/github-v2-tracker.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const GENERATED_QUEUE_PATH = join(ROOT, 'docs/v2-migration-queue.generated.md');

function parseArgs(argv) {
  let json = false;
  let write = false;
  let limit = 15;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--write') write = true;
    else if (a === '--limit' && argv[i + 1]) {
      limit = parseInt(argv[++i], 10);
      if (Number.isNaN(limit) || limit < 1) limit = 15;
    } else if (a === '--help' || a === '-h') {
      console.error(`Usage: node scripts/v2-migration-queue.mjs [--json] [--write] [--limit N]

  --json       Print machine-readable JSON
  --write      Update docs/v2-migration-queue.generated.md (v2-queue markers)
  --limit N    Max rows to list (default 15)

  Requires GITHUB_TOKEN (or GH_TOKEN) and GitHub origin (or GITHUB_REPOSITORY).`);
      process.exit(0);
    }
  }
  return { json, write, limit };
}

async function main() {
  const { json, write, limit } = parseArgs(process.argv);

  if (!useGithubMigrationTracker()) {
    console.error(
      'GitHub V2 migration tracker required: set GITHUB_TOKEN (or GH_TOKEN) and ensure git remote origin (or GITHUB_REPOSITORY) points at a GitHub repo.',
    );
    process.exit(1);
  }

  const token = getGithubTokenFromEnv();
  const full = resolveGithubRepository();
  if (!token || !full) {
    console.error('Missing GitHub token or repo.');
    process.exit(1);
  }
  const [owner, repo] = full.split('/');
  const issues = await listAllV2MigrationIssues(owner, repo, token);
  const parsed = issuesToParsedForQueue(issues);
  const report = buildQueueReport(parsed, { limit });
  const fmtOpts = {
    limit,
    queueSourceDescription: 'GitHub Issues (v2-migration + v2-kind:feature)',
    claimFooter:
      'Claim: swap v2-status:* label to In Progress (or Fixing / Validating per agent) and set agent in Issue JSON body.',
  };

  if (json) {
    console.log(JSON.stringify({ ...report, limit, source: 'github' }, null, 2));
  } else if (!write) {
    console.log(formatQueueText(report, fmtOpts));
  }

  if (write) {
    if (!existsSync(GENERATED_QUEUE_PATH)) {
      console.error('Missing', GENERATED_QUEUE_PATH);
      process.exit(1);
    }
    const text = readFileSync(GENERATED_QUEUE_PATH, 'utf8');
    if (!text.includes(QUEUE_MARKERS.start) || !text.includes(QUEUE_MARKERS.end)) {
      console.error('Refusing --write: generated queue file missing v2-queue markers.');
      process.exit(1);
    }
    const body = formatQueueText(report, fmtOpts);
    const md = `## Implementation queue (generated from GitHub)\n\n\`\`\`text\n${body}\n\`\`\``;
    const next = injectQueueSection(text, md);
    writeFileSync(GENERATED_QUEUE_PATH, next, 'utf8');
    if (!json) {
      console.error('Updated', GENERATED_QUEUE_PATH);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
