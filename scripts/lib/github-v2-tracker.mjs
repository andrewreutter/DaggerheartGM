/**
 * GitHub Issues backend for the V2 migration tracker (labels + JSON body).
 */
import { writeFileSync as fsWriteFileSync } from 'fs';

import {
  resolveGithubRepository,
  getGithubTokenFromEnv,
  getIssue,
  patchIssue,
  createIssue,
} from '../../src/dev-agent-github.js';

import {
  buildQueueReport,
  getClaimableAbilityUnclaimed,
  getActiveCollectionForImpl,
} from './v2-migration-queue-parse.mjs';

export const V2_MIGRATION_LABEL_OWNER = 'v2-migration';
export const V2_KIND_FEATURE = 'v2-kind:feature';
export const V2_KIND_BLOCKED = 'v2-kind:blocked';
export const V2_STATUS_PREFIX = 'v2-status:';

/** Feature-row workflow labels (main tracker vocabulary). */
export const FEATURE_STATUS_LABELS = [
  'Unclaimed',
  'In Progress',
  'Done',
  'Validating',
  'Validated',
  'Reviewed',
  'Needs Fix',
  'Fixing',
  'Blocked',
  'Skipped',
  'Awaiting Human',
];

/** Blocked / API resolution workflow labels. */
export const BLOCKED_STATUS_LABELS = ['Open', 'In Progress', 'Done', 'Awaiting Human'];

const FEATURE_STATUS_SET = new Set(FEATURE_STATUS_LABELS);
const BLOCKED_STATUS_SET = new Set(BLOCKED_STATUS_LABELS);

const ALL_V2_STATUS_VALUES = [...FEATURE_STATUS_LABELS, ...BLOCKED_STATUS_LABELS];
const V2_STATUS_LABEL_SET = new Set(ALL_V2_STATUS_VALUES.map((s) => `${V2_STATUS_PREFIX}${s}`));

export const GATED_SECTIONS = new Set(['abilities', 'beastforms', 'items', 'consumables']);

/** Orchestrator / summary: first path segment → Summary table collection name */
export const SOURCE_PREFIX_TO_COLLECTION = {
  ancestries: 'Ancestries (features)',
  communities: 'Communities (features)',
  weapon_properties: 'Weapon Properties',
  armor_properties: 'Armor Properties',
  classes: 'Classes (features)',
  subclasses: 'Subclasses (features)',
  abilities: 'Abilities',
  beastforms: 'Beastforms',
  items: 'Items',
  consumables: 'Consumables',
};

/** Stable column order for generated Summary tables (snapshot + orchestrator). */
export const MIGRATION_SUMMARY_COLLECTION_ORDER = [
  'Ancestries (features)',
  'Communities (features)',
  'Weapon Properties',
  'Armor Properties',
  'Classes (features)',
  'Subclasses (features)',
  'Abilities',
  'Beastforms',
  'Items',
  'Consumables',
];

const ORCH_STATUS_KEYS = [
  'Validated',
  'Reviewed',
  'Validating',
  'Done',
  'In Progress',
  'Unclaimed',
  'Needs Fix',
  'Fixing',
  'Blocked',
  'Skipped',
];

const DEFAULT_FETCH = globalThis.fetch.bind(globalThis);

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function useGithubMigrationTracker(env = process.env) {
  const token = getGithubTokenFromEnv(env);
  const repo = resolveGithubRepository(env);
  return Boolean(token && repo);
}

export function statusToV2Label(status) {
  return `${V2_STATUS_PREFIX}${status}`;
}

/**
 * @param {string[]} labelNames
 * @returns {string | null}
 */
export function getV2StatusFromLabels(labelNames) {
  if (!Array.isArray(labelNames)) return null;
  for (const n of labelNames) {
    if (typeof n === 'string' && n.startsWith(V2_STATUS_PREFIX)) {
      return n.slice(V2_STATUS_PREFIX.length);
    }
  }
  return null;
}

/**
 * Replace the single v2-status:* label (keeps v2-migration, v2-kind:*, and other labels).
 * @param {string[]} currentLabelNames
 * @param {string} newStatus — display status without prefix
 * @returns {string[]}
 */
export function replaceV2StatusLabel(currentLabelNames, newStatus) {
  const label = statusToV2Label(newStatus);
  if (!V2_STATUS_LABEL_SET.has(label)) {
    throw new Error(`Invalid V2 migration status: ${newStatus}`);
  }
  const base = (currentLabelNames || []).filter((n) => !n.startsWith(V2_STATUS_PREFIX));
  base.push(label);
  return base;
}

/**
 * @param {string} body
 * @returns {{ meta: object, trailingMarkdown: string } | null}
 */
export function parseMigrationIssueBodyParts(body) {
  if (typeof body !== 'string' || !body.trim()) return null;
  const trimmed = body.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (!fence) return null;
  const jsonStr = fence[1].trim();
  let meta = null;
  try {
    meta = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!meta || meta.schema !== 'v2-migration' || typeof meta.v !== 'number') return null;
  const idx = trimmed.indexOf('```');
  const afterFence = trimmed.slice(trimmed.indexOf('```', idx + 3) + 3).replace(/^\s*/, '');
  return { meta, trailingMarkdown: afterFence };
}

/**
 * @param {string} body
 * @returns {object | null}
 */
export function parseMigrationMetadataFromIssueBody(body) {
  const p = parseMigrationIssueBodyParts(body);
  return p ? p.meta : null;
}

/**
 * @param {object} meta
 * @param {string} [trailingMarkdown]
 */
export function buildMigrationIssueBody(meta, trailingMarkdown = '') {
  const json = JSON.stringify(meta, null, 2);
  const tail = trailingMarkdown.trim() ? `\n\n${trailingMarkdown.trim()}` : '';
  return `\`\`\`json\n${json}\n\`\`\`${tail}`;
}

function inferSectionFromSourceFile(sourceFile) {
  if (!sourceFile || typeof sourceFile !== 'string') return null;
  const prefix = sourceFile.split('/')[0];
  if (GATED_SECTIONS.has(prefix)) return prefix;
  if (SOURCE_PREFIX_TO_COLLECTION[prefix]) return prefix === 'abilities' ? 'abilities' : prefix;
  return prefix || null;
}

/**
 * @param {object} issue — GitHub issue JSON
 * @returns {boolean}
 */
export function isV2MigrationIssue(issue) {
  const names = (issue?.labels || []).map((l) => l.name);
  return names.includes(V2_MIGRATION_LABEL_OWNER);
}

export function isFeatureMigrationIssue(issue) {
  const names = (issue?.labels || []).map((l) => l.name);
  return names.includes(V2_KIND_FEATURE);
}

export function isBlockedMigrationIssue(issue) {
  const names = (issue?.labels || []).map((l) => l.name);
  return names.includes(V2_KIND_BLOCKED);
}

/**
 * @param {object} issue
 * @returns {object | null} work-item row for orchestrator / cursor runners
 */
export function issueToFeatureRow(issue) {
  if (!isFeatureMigrationIssue(issue)) return null;
  const names = (issue.labels || []).map((l) => l.name);
  const status = getV2StatusFromLabels(names);
  if (!status) return null;
  const parts = parseMigrationIssueBodyParts(issue.body || '');
  const meta = parts?.meta || {};
  const sourceFile = (meta.sourceFile || '').replace(/\\/g, '/');
  const section = meta.section || inferSectionFromSourceFile(sourceFile);
  if (!sourceFile || !GATED_SECTIONS.has(section)) return null;
  let tier = null;
  if (section === 'abilities') {
    const t = meta.tier != null ? Number(meta.tier) : NaN;
    if (![1, 2, 3].includes(t)) return null;
    tier = t;
  }
  return {
    file: 'github',
    githubIssueNumber: issue.number,
    line: issue.number,
    sourceFile,
    status,
    domain: meta.domain ?? null,
    tier,
    section,
    featureName: meta.name || String(issue.title || '').replace(/\s*\([^)]+\)\s*$/, '').trim(),
  };
}

/**
 * @param {object} issue
 * @returns {object | null}
 */
export function issueToBlockedRow(issue) {
  if (!isBlockedMigrationIssue(issue)) return null;
  const names = (issue.labels || []).map((l) => l.name);
  const status = getV2StatusFromLabels(names);
  if (!status) return null;
  const parts = parseMigrationIssueBodyParts(issue.body || '');
  const meta = parts?.meta || {};
  const resolution = meta.resolution || String(issue.title || '').trim();
  if (!resolution) return null;
  return {
    file: 'github',
    githubIssueNumber: issue.number,
    line: issue.number,
    resolution,
    status,
    cells: [
      resolution,
      meta.features || '',
      meta.srdRequirement || '',
      status,
      meta.agent || '',
      meta.notes || '',
    ],
    raw: issue.body || '',
  };
}

/**
 * Build the same shape as `parseTrackerMarkdown` from feature migration issues (gated rows only).
 * @param {object[]} issues
 */
export function issuesToParsedForQueue(issues) {
  const abilities = { 1: [], 2: [], 3: [] };
  const beastforms = [];
  const items = [];
  const consumables = [];

  for (const issue of issues) {
    const row = issueToFeatureRow(issue);
    if (!row) continue;
    const name = row.featureName;
    const { sourceFile, status, domain, tier, section } = row;
    if (section === 'abilities') {
      const t = tier;
      if (![1, 2, 3].includes(t)) continue;
      if (!abilities[t]) abilities[t] = [];
      abilities[t].push({ domain: domain || '—', featureName: name, sourceFile, status });
    } else if (section === 'beastforms') {
      beastforms.push({ featureName: name, sourceFile, status });
    } else if (section === 'items') {
      items.push({ featureName: name, sourceFile, status });
    } else if (section === 'consumables') {
      consumables.push({ featureName: name, sourceFile, status });
    }
  }

  return { abilities, beastforms, items, consumables };
}

/**
 * @param {object[]} issues — all v2-migration issues
 * @returns {{ kind: 'feature', row: object } | { kind: 'blocked', row: object } | null}
 */
export function findNextWorkItemFromGitHub(issues) {
  const list = issues.filter(isV2MigrationIssue);
  const featureRows = list.map(issueToFeatureRow).filter(Boolean);

  for (const r of featureRows) {
    if (r.status === 'Needs Fix') return { kind: 'feature', row: r };
  }

  for (const r of featureRows) {
    if (r.status === 'Done') return { kind: 'feature', row: r };
  }

  const parsed = issuesToParsedForQueue(list);
  const active = getActiveCollectionForImpl(parsed);

  if (active === 'abilities') {
    const next = getClaimableAbilityUnclaimed(parsed, 1)[0];
    if (next) {
      const hit = featureRows.find((x) => x.sourceFile === next.sourceFile && x.status === 'Unclaimed');
      if (hit) return { kind: 'feature', row: hit };
    }
  } else if (active === 'beastforms') {
    const hit = featureRows.find((x) => x.section === 'beastforms' && x.status === 'Unclaimed');
    if (hit) return { kind: 'feature', row: hit };
  } else if (active === 'items') {
    const hit = featureRows.find((x) => x.section === 'items' && x.status === 'Unclaimed');
    if (hit) return { kind: 'feature', row: hit };
  } else if (active === 'consumables') {
    const hit = featureRows.find((x) => x.section === 'consumables' && x.status === 'Unclaimed');
    if (hit) return { kind: 'feature', row: hit };
  }

  const report = buildQueueReport(parsed, { limit: 1 });
  if (report.nextRows?.length) {
    const sf = report.nextRows[0].sourceFile;
    const hit = featureRows.find((x) => x.sourceFile === sf && x.status === 'Unclaimed');
    if (hit) return { kind: 'feature', row: hit };
  }

  const blockedRows = list.map(issueToBlockedRow).filter(Boolean);
  for (const br of blockedRows.sort((a, b) => a.githubIssueNumber - b.githubIssueNumber)) {
    if (br.status === 'Open') return { kind: 'blocked', row: br };
  }

  return null;
}

/**
 * @param {object[]} issues
 */
export function summarizeGatedCollectionsFromIssues(issues) {
  const rows = issues.map(issueToFeatureRow).filter(Boolean);
  const total = rows.length;
  let blocked = 0;
  let validated = 0;
  let reviewed = 0;
  for (const r of rows) {
    if (r.status === 'Blocked') blocked++;
    if (r.status === 'Validated') validated++;
    if (r.status === 'Reviewed') reviewed++;
  }
  const remain = total - validated - reviewed;
  return { total, blocked, validated, reviewed, remain };
}

/**
 * Orchestrator-style feature list: `{ name, sourceFile, status, collection }`.
 * Includes every feature migration issue whose source file maps to a Summary collection.
 * @param {object[]} issues
 * @param {string[]} statusFilter
 */
export function parseFeatureRowsFromIssues(issues, statusFilter) {
  const want = new Set(statusFilter);
  const out = [];
  for (const issue of issues) {
    if (!isFeatureMigrationIssue(issue)) continue;
    const names = (issue.labels || []).map((l) => l.name);
    const status = getV2StatusFromLabels(names);
    if (!status || !want.has(status)) continue;
    const parts = parseMigrationIssueBodyParts(issue.body || '');
    const meta = parts?.meta || {};
    const sourceFile = (meta.sourceFile || '').replace(/\\/g, '/');
    if (!sourceFile) continue;
    const prefix = sourceFile.split('/')[0];
    const collection = SOURCE_PREFIX_TO_COLLECTION[prefix];
    if (!collection) continue;
    const name = meta.name || String(issue.title || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
    out.push({ name, sourceFile, status, collection });
  }
  return out;
}

/**
 * @param {object[]} issues
 * @returns {Array<{ resolution: string, features: string, srdReq: string, notes: string }>}
 */
export function parseBlockedRowsFromIssues(issues) {
  const out = [];
  for (const issue of issues) {
    const row = issueToBlockedRow(issue);
    if (!row || row.status !== 'Open') continue;
    const parts = parseMigrationIssueBodyParts(issue.body || '');
    const meta = parts?.meta || {};
    out.push({
      resolution: row.resolution,
      features: meta.features || row.cells[1] || '',
      srdReq: meta.srdRequirement || '',
      notes: meta.notes || '',
    });
  }
  return out;
}

/**
 * @param {object[]} issues — all v2-migration issues
 * @returns {Record<string, number>}
 */
export function readTrackerSummaryFromIssues(issues) {
  const counts = {};
  for (const c of Object.values(SOURCE_PREFIX_TO_COLLECTION)) {
    counts[c] = {};
    for (const s of ORCH_STATUS_KEYS) counts[c][s] = 0;
  }

  for (const issue of issues) {
    if (!isFeatureMigrationIssue(issue)) continue;
    const names = (issue.labels || []).map((l) => l.name);
    const status = getV2StatusFromLabels(names);
    if (!status || !ORCH_STATUS_KEYS.includes(status)) continue;
    const parts = parseMigrationIssueBodyParts(issue.body || '');
    const meta = parts?.meta || {};
    const sourceFile = (meta.sourceFile || '').replace(/\\/g, '/');
    const prefix = sourceFile.split('/')[0];
    const coll = SOURCE_PREFIX_TO_COLLECTION[prefix];
    if (!coll || !counts[coll]) continue;
    counts[coll][status]++;
  }

  const totals = {};
  for (const s of ORCH_STATUS_KEYS) totals[s] = 0;

  const collections = MIGRATION_SUMMARY_COLLECTION_ORDER;
  for (const coll of collections) {
    const c = counts[coll];
    for (const s of ORCH_STATUS_KEYS) totals[s] += c[s];
  }

  const grand = ORCH_STATUS_KEYS.reduce((sum, s) => sum + totals[s], 0);

  return {
    total: grand,
    validated: totals.Validated,
    reviewed: totals.Reviewed,
    validating: totals.Validating,
    done: totals.Done,
    inProgress: totals['In Progress'],
    unclaimed: totals.Unclaimed,
    needsFix: totals['Needs Fix'],
    fixing: totals.Fixing,
    blocked: totals.Blocked,
    skipped: totals.Skipped,
    _perCollection: counts,
    _collectionsOrdered: collections,
  };
}

/**
 * @param {typeof fetch} fetchFn
 */
export async function listAllV2MigrationIssues(owner, repo, token, fetchFn = DEFAULT_FETCH) {
  const out = [];
  let page = 1;
  for (;;) {
    const q = new URLSearchParams({
      state: 'all',
      labels: V2_MIGRATION_LABEL_OWNER,
      per_page: '100',
      page: String(page),
      sort: 'created',
      direction: 'asc',
    });
    const path = `https://api.github.com/repos/${owner}/${repo}/issues?${q}`;
    const res = await fetchFn(path, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    const text = await res.text();
    let batch = [];
    try {
      batch = text ? JSON.parse(text) : [];
    } catch {
      throw new Error(`GitHub list issues: invalid JSON (${res.status})`);
    }
    if (!res.ok) {
      throw new Error(`GitHub list issues → ${res.status}: ${text}`);
    }
    if (!Array.isArray(batch) || batch.length === 0) break;
    const issuesOnly = batch.filter((it) => !it.pull_request);
    out.push(...issuesOnly);
    if (batch.length < 100) break;
    page += 1;
    if (page > 50) break;
  }
  return out;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {typeof fetch} [fetchFn]
 */
export async function fetchAndFindNextWorkItem(owner, repo, token, fetchFn = DEFAULT_FETCH) {
  const issues = await listAllV2MigrationIssues(owner, repo, token, fetchFn);
  return { issues, work: findNextWorkItemFromGitHub(issues) };
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {number} issueNumber
 * @param {{ status: string, agent?: string | null, fixNotesAppend?: string | null, notesAppend?: string | null }} patch
 */
export async function applyMigrationIssueUpdate(owner, repo, token, issueNumber, patch) {
  const issue = await getIssue(owner, repo, issueNumber, token);
  const labelNames = (issue.labels || []).map((l) => l.name);
  const newLabels = replaceV2StatusLabel(labelNames, patch.status);
  const parts = parseMigrationIssueBodyParts(issue.body || '');
  const meta = { ...(parts?.meta || {}) };
  if (patch.agent != null) meta.agent = patch.agent;
  if (patch.fixNotesAppend && String(patch.fixNotesAppend).trim()) {
    const prev = (meta.fixNotes || '').trim();
    meta.fixNotes = prev ? `${prev}; ${patch.fixNotesAppend.trim()}` : patch.fixNotesAppend.trim();
  }
  if (patch.notesAppend && String(patch.notesAppend).trim()) {
    const prev = (meta.notes || '').trim();
    meta.notes = prev ? `${prev}; ${patch.notesAppend.trim()}` : patch.notesAppend.trim();
  }
  const body = buildMigrationIssueBody(meta, parts?.trailingMarkdown || '');
  await patchIssue(owner, repo, issueNumber, token, { labels: newLabels, body });
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {string[]} featureNames
 * @param {string} newStatus
 * @returns {Promise<number>} updated count
 */
export async function updateGithubFeatureIssuesByNames(owner, repo, token, featureNames, newStatus) {
  const namesSet = new Set(featureNames);
  if (namesSet.size === 0) return 0;
  const issues = await listAllV2MigrationIssues(owner, repo, token);
  let updated = 0;
  for (const issue of issues) {
    if (!isFeatureMigrationIssue(issue)) continue;
    const parts = parseMigrationIssueBodyParts(issue.body || '');
    const meta = parts?.meta || {};
    const name = meta.name || String(issue.title || '').replace(/\s*\([^)]+\)\s*$/, '').trim();
    if (!namesSet.has(name)) continue;
    await applyMigrationIssueUpdate(owner, repo, token, issue.number, { status: newStatus, agent: meta.agent });
    updated++;
  }
  return updated;
}

/**
 * Regenerate a read-only markdown snapshot (Summary table + pointer).
 * @param {object[]} issues
 * @param {string} generatedAtIso
 */
export function renderTrackerSnapshotMarkdown(issues, generatedAtIso = new Date().toISOString()) {
  const summary = readTrackerSummaryFromIssues(issues);
  const lines = [];
  lines.push('# V2 migration tracker (generated snapshot)');
  lines.push('');
  lines.push(`> **Generated** ${generatedAtIso} from GitHub Issues labeled \`${V2_MIGRATION_LABEL_OWNER}\`.`);
  lines.push('> Do not edit this file by hand. Source of truth: GitHub Issues.');
  lines.push('');
  lines.push('## Status Summary');
  lines.push('');
  lines.push(
    '| Collection | Total | Validated | Reviewed | Validating | Done | In Progress | Unclaimed | Needs Fix | Fixing | Blocked | Skipped |',
  );
  lines.push(
    '| ---------- | ----- | --------- | -------- | ---------- | ---- | ----------- | --------- | --------- | ------ | ------- | ------- |',
  );

  for (const coll of summary._collectionsOrdered) {
    const c = summary._perCollection[coll];
    const total = ORCH_STATUS_KEYS.reduce((sum, s) => sum + c[s], 0);
    lines.push(
      `| ${coll} | ${total} | ${c.Validated} | ${c.Reviewed} | ${c.Validating} | ${c.Done} | ${c['In Progress']} | ${c.Unclaimed} | ${c['Needs Fix']} | ${c.Fixing} | ${c.Blocked} | ${c.Skipped} |`,
    );
  }

  lines.push(
    `| **TOTAL** | **${summary.total}** | **${summary.validated}** | **${summary.reviewed}** | **${summary.validating}** | **${summary.done}** | **${summary.inProgress}** | **${summary.unclaimed}** | **${summary.needsFix}** | **${summary.fixing}** | **${summary.blocked}** | **${summary.skipped}** |`,
  );
  lines.push('');
  lines.push('## Blocked / API Extension Requests (from Issues)');
  lines.push('');
  lines.push('| # | Resolution | Status |');
  lines.push('| - | ---------- | ------ |');
  const blocked = issues.filter(isBlockedMigrationIssue).sort((a, b) => a.number - b.number);
  if (blocked.length === 0) {
    lines.push('| — | *(none)* | — |');
  } else {
    for (const iss of blocked) {
      const row = issueToBlockedRow(iss);
      lines.push(`| ${iss.number} | ${(row?.resolution || iss.title).replace(/\|/g, '\\|')} | ${row?.status || '—'} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {string} fsPath
 */
export async function writeTrackerSnapshotFile(owner, repo, token, fsPath, writeFn = fsWriteFileSync) {
  const issues = await listAllV2MigrationIssues(owner, repo, token);
  const md = renderTrackerSnapshotMarkdown(issues);
  writeFn(fsPath, md, 'utf8');
}

/**
 * Any feature migration issue (for human queue — includes subclasses, classes, etc.).
 * @param {object} issue
 */
export function issueToHumanFeatureEntry(issue) {
  if (!isFeatureMigrationIssue(issue)) return null;
  const names = (issue.labels || []).map((l) => l.name);
  const status = getV2StatusFromLabels(names);
  if (!status) return null;
  const parts = parseMigrationIssueBodyParts(issue.body || '');
  const meta = parts?.meta || {};
  const sourceFile = (meta.sourceFile || '').replace(/\\/g, '/');
  if (!sourceFile) return null;
  const section = meta.section || inferSectionFromSourceFile(sourceFile) || '—';
  const tierRaw = meta.tier != null ? Number(meta.tier) : null;
  return {
    githubIssueNumber: issue.number,
    sourceFile,
    status,
    domain: meta.domain ?? null,
    tier: Number.isFinite(tierRaw) ? tierRaw : null,
    section,
  };
}

/**
 * Same information shape as `buildHumanApprovalQueue` in v2-human-queue-list.mjs (plus githubIssueNumber).
 * @param {object[]} issues
 */
export function buildHumanApprovalQueueFromIssues(issues) {
  const blockedApi = [];
  for (const iss of issues) {
    if (!isBlockedMigrationIssue(iss)) continue;
    const row = issueToBlockedRow(iss);
    if (!row) continue;
    const s = (row.status || '').trim().toLowerCase();
    if (s !== 'open' && s !== 'in progress') continue;
    const parts = parseMigrationIssueBodyParts(iss.body || '');
    const meta = parts?.meta || {};
    blockedApi.push({
      kind: 'blocked-api',
      approvalType: 'design',
      line: iss.number,
      githubIssueNumber: iss.number,
      resolution: row.resolution,
      features: meta.features || row.cells[1] || '',
      srdRequirement: meta.srdRequirement || '',
      status: row.status,
      agent: meta.agent || row.cells[4] || '',
      notes: meta.notes || row.cells[5] || '',
    });
  }

  const awaiting = [];
  for (const iss of issues) {
    const r = issueToHumanFeatureEntry(iss);
    if (!r || r.status !== 'Awaiting Human') continue;
    awaiting.push({
      kind: 'awaiting-human',
      approvalType: 'fix',
      line: iss.number,
      githubIssueNumber: iss.number,
      sourceFile: r.sourceFile,
      status: r.status,
      domain: r.domain,
      tier: r.tier,
      section: r.section,
    });
  }

  return [...blockedApi, ...awaiting];
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {{ title: string, meta: object, status?: string, trailingMarkdown?: string }} opts
 */
export async function createGithubFeatureMigrationIssue(owner, repo, token, opts) {
  const status = opts.status || 'Unclaimed';
  const meta = {
    ...opts.meta,
    v: 3,
    schema: 'v2-migration',
    kind: 'feature',
  };
  const body = buildMigrationIssueBody(meta, opts.trailingMarkdown || '');
  const labels = [
    V2_MIGRATION_LABEL_OWNER,
    V2_KIND_FEATURE,
    statusToV2Label(status),
  ];
  return createIssue(owner, repo, token, { title: opts.title, body, labels });
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} token
 * @param {{ title: string, meta: object, status?: string, trailingMarkdown?: string }} opts
 */
export async function createGithubBlockedMigrationIssue(owner, repo, token, opts) {
  const status = opts.status || 'Open';
  const meta = {
    ...opts.meta,
    v: 3,
    schema: 'v2-migration',
    kind: 'blocked',
  };
  const body = buildMigrationIssueBody(meta, opts.trailingMarkdown || '');
  const labels = [
    V2_MIGRATION_LABEL_OWNER,
    V2_KIND_BLOCKED,
    statusToV2Label(status),
  ];
  return createIssue(owner, repo, token, { title: opts.title, body, labels });
}

export { getGithubTokenFromEnv, resolveGithubRepository };
