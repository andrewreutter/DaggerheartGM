#!/usr/bin/env node
/**
 * Lists human-pending rows for the Human approval queue agent (GitHub Issues):
 * - Open / In Progress **Blocked / API** design Issues
 * - Feature Issues with `v2-status:Awaiting Human`
 *
 * Requires GITHUB_TOKEN (or GH_TOKEN) and a resolvable GitHub repo (origin or GITHUB_REPOSITORY).
 *
 * Usage:
 *   npm run v2:human-queue
 *   node scripts/v2-human-queue-list.mjs [--json]
 */
import {
  useGithubMigrationTracker,
  listAllV2MigrationIssues,
  buildHumanApprovalQueueFromIssues,
  getGithubTokenFromEnv,
  resolveGithubRepository,
} from './lib/github-v2-tracker.mjs';

function parseArgs(argv) {
  let json = false;
  for (const a of argv) {
    if (a === '--json') json = true;
  }
  return { json };
}

async function main() {
  const { json } = parseArgs(process.argv.slice(2));

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
  const queue = buildHumanApprovalQueueFromIssues(issues);

  if (json) {
    console.log(
      JSON.stringify(
        {
          source: 'github',
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
      'No pending human approvals: no Open/In Progress blocked Issues and no feature Issues with v2-status:Awaiting Human.',
    );
    return;
  }

  let n = 1;
  for (const r of queue) {
    if (r.kind === 'blocked-api') {
      console.log(`${n}. [DESIGN] Issue #${r.githubIssueNumber} — ${r.resolution} — ${r.features}`);
    } else {
      const loc =
        r.section === 'abilities' && r.tier != null ? `[Tier ${r.tier}] ${r.domain ?? '—'}` : r.section;
      console.log(`${n}. [FIX] Issue #${r.githubIssueNumber} — ${loc} — ${r.sourceFile}`);
    }
    n++;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
