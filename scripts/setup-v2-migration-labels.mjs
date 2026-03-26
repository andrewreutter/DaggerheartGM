#!/usr/bin/env node
/**
 * One-time: create GitHub labels for V2 migration Issues (tracker on GitHub).
 *
 *   node --env-file=.env scripts/setup-v2-migration-labels.mjs
 *
 * Requires GITHUB_TOKEN or GH_TOKEN; repo from `git remote` or GITHUB_REPOSITORY=owner/repo.
 */
import {
  FEATURE_STATUS_LABELS,
  BLOCKED_STATUS_LABELS,
  V2_MIGRATION_LABEL_OWNER,
  V2_KIND_FEATURE,
  V2_KIND_BLOCKED,
  statusToV2Label,
} from './lib/github-v2-tracker.mjs';
import { resolveGithubRepository, getGithubTokenFromEnv } from '../src/dev-agent-github.js';

async function ghPost(path, token, body, fetchFn = globalThis.fetch.bind(globalThis)) {
  const res = await fetchFn(`https://api.github.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (res.status === 422) {
    const msg = String(json?.message || text || '').toLowerCase();
    if (msg.includes('already exists')) return { skipped: true };
  }
  if (!res.ok) {
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return json;
}

async function main() {
  const token = getGithubTokenFromEnv();
  const repoFull = resolveGithubRepository();
  if (!token || !repoFull) {
    console.error('Set GITHUB_TOKEN (or GH_TOKEN); repo from origin or GITHUB_REPOSITORY=owner/repo');
    process.exit(1);
  }
  const [owner, repo] = repoFull.split('/');

  const base = [
    {
      name: V2_MIGRATION_LABEL_OWNER,
      color: '1F2937',
      description: 'V2 SRD migration tracker row (Issues source of truth)',
    },
    {
      name: V2_KIND_FEATURE,
      color: '2563EB',
      description: 'Per-feature migration issue',
    },
    {
      name: V2_KIND_BLOCKED,
      color: 'B45309',
      description: 'Blocked / API extension resolution issue',
    },
  ];

  const seenStatus = new Set();
  const statusLabels = [];
  for (const s of FEATURE_STATUS_LABELS) {
    const name = statusToV2Label(s);
    seenStatus.add(name);
    statusLabels.push({
      name,
      color: '6B7280',
      description: `V2 migration workflow: ${s}`,
    });
  }
  for (const s of BLOCKED_STATUS_LABELS) {
    const name = statusToV2Label(s);
    if (seenStatus.has(name)) continue;
    seenStatus.add(name);
    statusLabels.push({
      name,
      color: '92400E',
      description: `V2 blocked/API workflow: ${s}`,
    });
  }

  const all = [...base, ...statusLabels];
  for (const lb of all) {
    try {
      const r = await ghPost(`/repos/${owner}/${repo}/labels`, token, lb);
      if (r?.skipped) console.log('Skip (exists):', lb.name);
      else console.log('Created label:', lb.name);
    } catch (e) {
      console.error(lb.name, e.message);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
