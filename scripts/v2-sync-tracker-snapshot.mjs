#!/usr/bin/env node
/**
 * Regenerate docs/v2-migration-tracker-snapshot.md from GitHub Issues (v2-migration label).
 *
 *   node --env-file=.env scripts/v2-sync-tracker-snapshot.mjs
 */
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
  getGithubTokenFromEnv,
  resolveGithubRepository,
  writeTrackerSnapshotFile,
} from './lib/github-v2-tracker.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SNAPSHOT = resolve(ROOT, 'docs/v2-migration-tracker-snapshot.md');

async function main() {
  const token = getGithubTokenFromEnv();
  const full = resolveGithubRepository();
  if (!token || !full) {
    console.error('Set GITHUB_TOKEN (or GH_TOKEN); repo from origin or GITHUB_REPOSITORY.');
    process.exit(1);
  }
  const [owner, repo] = full.split('/');
  await writeTrackerSnapshotFile(owner, repo, token, SNAPSHOT);
  console.log('Wrote', SNAPSHOT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
