#!/usr/bin/env node
/**
 * One-time: create GitHub labels used by the dev-agent queue (Issues API).
 * Requires GITHUB_TOKEN or GH_TOKEN and GITHUB_REPOSITORY=owner/repo.
 *
 *   node --env-file=.env scripts/setup-dev-agent-labels.mjs
 */
import { resolveGithubRepository, getGithubTokenFromEnv } from '../src/dev-agent-github.js';

const LABELS = [
  { name: 'dh-dev-agent', color: '6B7280', description: 'Owned by local dev-agent queue (Feature Source modal)' },
  { name: 'dh-agent-queued', color: 'FBBF24', description: 'Waiting for dev-agent worker' },
  { name: 'dh-agent-running', color: '3B82F6', description: 'Worker claimed' },
  { name: 'dh-agent-awaiting-human', color: 'A855F7', description: 'PR open — needs review/merge' },
  { name: 'dh-agent-failed', color: 'EF4444', description: 'Terminal error' },
];

async function ghPost(path, token, body) {
  const res = await fetch(`https://api.github.com${path}`, {
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
    console.error('Set GITHUB_TOKEN (or GH_TOKEN) and GITHUB_REPOSITORY=owner/repo');
    process.exit(1);
  }
  const [owner, repo] = repoFull.split('/');
  for (const lb of LABELS) {
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
