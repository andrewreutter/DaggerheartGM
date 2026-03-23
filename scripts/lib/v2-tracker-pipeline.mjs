/**
 * Helpers for scripts/cursor-v2-ticket.mjs — find/claim/update rows in
 * docs/v2-migration-tracker.md (gated collections + blocked API table).
 */
import { readFileSync, writeFileSync, openSync, closeSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  parseTrackerMarkdown,
  buildQueueReport,
  getClaimableAbilityUnclaimed,
  getActiveCollectionForImpl,
} from './v2-migration-queue-parse.mjs';

export const TRACKER_REL = 'docs/v2-migration-tracker.md';
/** Gated-collection feature tables split out of the tracker (merged with tracker for queue parsing + row edits). */
export const TO_REVIEW_REL = 'docs/v2-migration-to-review.md';

export function toReviewPathFromTrackerPath(trackerPath) {
  const dir = dirname(trackerPath);
  return join(dir, 'v2-migration-to-review.md');
}

export function loadToReviewText(trackerPath) {
  const p = toReviewPathFromTrackerPath(trackerPath);
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

/** Statuses excluded when searching for new work (semi-terminal + finished + blocked feature rows). */
export const SKIP_WHEN_FINDING = new Set([
  'Validated',
  'Reviewed',
  'Blocked',
  'Skipped',
  'Awaiting Human',
  'In Progress',
  'Fixing',
  'Validating',
]);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
export const REPO_ROOT = join(__dirname, '..', '..');

export function trackerPathFromOpts(opts = {}) {
  if (opts.tracker) return opts.tracker;
  return join(REPO_ROOT, TRACKER_REL);
}

function splitTableRow(line) {
  if (!line.startsWith('|')) return null;
  const parts = line.split('|');
  if (parts.length < 3) return null;
  return parts.slice(1, -1).map((c) => c.trim());
}

function isSeparatorRow(cells) {
  if (!cells || cells.length === 0) return true;
  return cells.every((c) => /^[-:]+$/.test(c.replace(/\s/g, '')));
}

/**
 * Walk tracker (+ optional to-review) markdown and collect feature rows with 1-based line index **per file**.
 * @returns {Array<{ file: 'tracker' | 'to-review', line: number, sourceFile: string, status: string, domain: string | null, tier: number | null, section: string }>}
 */
export function collectFeatureRowsWithLines(trackerText, toReviewText = '') {
  const trackerLines = trackerText.split(/\r?\n/);
  const extra = (toReviewText && String(toReviewText).trim()) ? `\n${toReviewText}` : '';
  const merged = trackerLines.join('\n') + extra;
  const lines = merged.split(/\r?\n/);
  const trackerLineCount = trackerLines.length;
  const rows = [];
  let mode = null;
  let abilityTier = 1;

  function mergedIndexToFileLine(mergedIdx) {
    if (mergedIdx < trackerLineCount) {
      return { file: 'tracker', line: mergedIdx + 1 };
    }
    return { file: 'to-review', line: mergedIdx - trackerLineCount + 1 };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('#### Tier 1')) {
      mode = 'abilities';
      abilityTier = 1;
      continue;
    }
    if (trimmed.startsWith('#### Tier 2')) {
      mode = 'abilities';
      abilityTier = 2;
      continue;
    }
    if (trimmed.startsWith('#### Tier 3')) {
      mode = 'abilities';
      abilityTier = 3;
      continue;
    }
    if (trimmed.startsWith('## ') && (mode === 'beastforms' || mode === 'items' || mode === 'consumables')) {
      mode = null;
      continue;
    }
    if (trimmed.startsWith('### Beastforms')) {
      mode = 'beastforms';
      continue;
    }
    if (trimmed.startsWith('### Items (')) {
      mode = 'items';
      continue;
    }
    if (trimmed.startsWith('### Consumables (')) {
      mode = 'consumables';
      continue;
    }
    if (trimmed.startsWith('### ') && mode === 'abilities') {
      mode = null;
      continue;
    }
    if (trimmed === '---' && (mode === 'beastforms' || mode === 'items')) {
      continue;
    }

    if (mode !== 'abilities' && mode !== 'beastforms' && mode !== 'items' && mode !== 'consumables') {
      continue;
    }

    const cells = splitTableRow(line);
    if (!cells || cells.length < 4) continue;
    if (isSeparatorRow(cells)) continue;

    const { file, line: lineNo } = mergedIndexToFileLine(i);

    if (mode === 'abilities') {
      const domain = cells[0];
      const sourceFile = cells[2];
      const status = cells[3];
      if (!sourceFile.includes('abilities/')) continue;
      rows.push({
        file,
        line: lineNo,
        sourceFile,
        status,
        domain,
        tier: abilityTier,
        section: 'abilities',
      });
      continue;
    }

    const sourceFile = cells[1];
    const status = cells[2];
    const prefix =
      mode === 'beastforms' ? 'beastforms/' : mode === 'items' ? 'items/' : 'consumables/';
    if (!sourceFile.includes(prefix)) continue;
    rows.push({
      file,
      line: lineNo,
      sourceFile,
      status,
      domain: null,
      tier: null,
      section: mode,
    });
  }

  return rows;
}

/**
 * Counts gated-collection feature rows (abilities, beastforms, items, consumables only).
 * **remain** = rows not yet `Validated` or `Reviewed` (still in the migration pipeline).
 */
export function summarizeGatedCollections(text, toReviewText = '') {
  const rows = collectFeatureRowsWithLines(text, toReviewText);
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

export function formatTrackerStatsLine(s) {
  return `[tracker] gated features: ${s.total} total | ${s.validated} validated | ${s.reviewed} reviewed | ${s.blocked} blocked | ${s.remain} remain (not Validated/Reviewed)`;
}

/**
 * @returns {Array<{ line: number, resolution: string, status: string, cells: string[] }>}
 */
export function collectBlockedApiRowsWithLines(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('| Resolution |') && line.includes('SRD Requirement')) {
      inTable = true;
      continue;
    }
    if (inTable && line.trim().startsWith('## ') && !line.includes('|')) {
      break;
    }
    if (!inTable) continue;
    const cells = splitTableRow(line);
    if (!cells || cells.length < 5) continue;
    if (isSeparatorRow(cells)) continue;
    const resolution = cells[0];
    if (resolution === '*(none)*' || resolution === 'Resolution') continue;
    const status = cells[3] ?? '';
    out.push({ line: i + 1, resolution, status, cells, raw: line });
  }
  return out;
}

/**
 * Active Blocked / API Extension Requests rows (human design review before unblock work).
 * @returns {Array<{ line: number, resolution: string, status: string, cells: string[], raw: string }>}
 */
export function collectActiveBlockedApiRows(text) {
  return collectBlockedApiRowsWithLines(text).filter((r) => {
    const s = (r.status || '').trim().toLowerCase();
    return s === 'open' || s === 'in progress';
  });
}

export function randomAgentId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${s}`;
}

/**
 * Priority: Needs Fix → Done (validate) → Unclaimed (queue) → Blocked Open.
 * @returns {{ kind: 'feature', row: object } | { kind: 'blocked', row: object } | null}
 */
export function findNextWorkItem(text, toReviewText = '') {
  const merged = toReviewText ? `${text}\n${toReviewText}` : text;
  const parsed = parseTrackerMarkdown(merged);
  const featureRows = collectFeatureRowsWithLines(text, toReviewText);

  for (const r of featureRows) {
    if (r.status === 'Needs Fix') return { kind: 'feature', row: r };
  }

  for (const r of featureRows) {
    if (r.status === 'Done') return { kind: 'feature', row: r };
  }

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

  const blockedRows = collectBlockedApiRowsWithLines(text);
  for (const br of blockedRows) {
    if (br.status === 'Open') return { kind: 'blocked', row: br };
  }

  return null;
}

/**
 * Replace Status and Agent columns on a feature table row matching sourceFile.
 * Abilities: Domain | Name | Source File | Status | Agent | Impl | Val | Fix Notes
 * Other: Name | Source File | Status | Agent | Impl | Val | Fix Notes
 * @param {object} opts
 * @param {string} [opts.fixNotesAppend] — appended to Fix Notes (semicolon-separated if non-empty)
 */
export function updateFeatureRowLine(lineText, sourceFile, { status, agent, fixNotesAppend }) {
  if (!lineText.includes(sourceFile)) return lineText;
  const cells = splitTableRow(lineText);
  if (!cells || cells.length < 4) return lineText;

  const isAbility = cells[2] === sourceFile && sourceFile.includes('abilities/');
  const fixIdx = isAbility ? 7 : 6;

  if (isAbility) {
    cells[3] = status;
    cells[4] = agent;
  } else if (cells[1] === sourceFile) {
    cells[2] = status;
    cells[3] = agent;
  } else {
    return lineText;
  }

  if (fixNotesAppend && String(fixNotesAppend).trim()) {
    while (cells.length <= fixIdx) cells.push('');
    const prev = (cells[fixIdx] ?? '').trim();
    cells[fixIdx] = prev ? `${prev}; ${fixNotesAppend.trim()}` : fixNotesAppend.trim();
  }

  return '| ' + cells.join(' | ') + ' |';
}

export function updateBlockedRowLine(lineText, resolution, { status, agent }) {
  if (!lineText.includes('|')) return lineText;
  const cells = splitTableRow(lineText);
  if (!cells || cells[0] !== resolution) return lineText;
  cells[3] = status;
  cells[4] = agent;
  return '| ' + cells.join(' | ') + ' |';
}

/**
 * Apply a feature or blocked-row patch. When `patch.row.file === 'to-review'`, updates `toReviewText` instead of `trackerText`.
 * @returns {{ trackerText: string, toReviewText: string }}
 */
export function applyTrackerUpdate(trackerText, toReviewText, patch) {
  const targetFile = patch.kind === 'feature' && patch.row.file === 'to-review' ? 'to-review' : 'tracker';
  const lines =
    targetFile === 'to-review'
      ? toReviewText.split(/\r?\n/)
      : trackerText.split(/\r?\n/);
  if (patch.kind === 'feature') {
    const i = patch.row.line - 1;
    if (i >= 0 && i < lines.length) {
      lines[i] = updateFeatureRowLine(lines[i], patch.row.sourceFile, {
        status: patch.status,
        agent: patch.agent,
        fixNotesAppend: patch.fixNotesAppend,
      });
    }
  } else {
    const i = patch.row.line - 1;
    if (i >= 0 && i < lines.length) {
      lines[i] = updateBlockedRowLine(lines[i], patch.row.resolution, patch);
    }
  }
  const out = lines.join('\n');
  if (targetFile === 'to-review') {
    return { trackerText, toReviewText: out };
  }
  return { trackerText: out, toReviewText };
}

export function claimWorkItem(text, item, agentId) {
  if (item.kind === 'feature') {
    const claimStatus =
      item.row.status === 'Needs Fix'
        ? 'Fixing'
        : item.row.status === 'Done'
          ? 'Validating'
          : 'In Progress';
    return {
      kind: 'feature',
      row: item.row,
      status: claimStatus,
      agent: agentId,
    };
  }
  return {
    kind: 'blocked',
    row: item.row,
    status: 'In Progress',
    agent: agentId,
  };
}

/** Map single-token agent output to tracker Status label. */
export function normalizeStateToken(raw) {
  const t = String(raw)
    .trim()
    .replace(/^[`"']+|[`"']+$/g, '')
    .replace(/\s+/g, '');
  const map = new Map([
    ['done', 'Done'],
    ['blocked', 'Blocked'],
    ['inprogress', 'In Progress'],
    ['unclaimed', 'Unclaimed'],
    ['validated', 'Validated'],
    ['reviewed', 'Reviewed'],
    ['needsfix', 'Needs Fix'],
    ['fixing', 'Fixing'],
    ['validating', 'Validating'],
    ['skipped', 'Skipped'],
    ['awaitinghuman', 'Awaiting Human'],
  ]);
  const key = t.toLowerCase().replace(/[^a-z]/g, '');
  return map.get(key) ?? null;
}

export function extractLastStateLine(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const norm = normalizeStateToken(lines[i]);
    if (norm) return norm;
  }
  const last = lines[lines.length - 1] ?? '';
  return normalizeStateToken(last);
}

export function withFileLock(lockFilePath, fn) {
  const max = 600;
  let waited = 0;
  while (waited < max) {
    try {
      const fd = openSync(lockFilePath, 'wx');
      try {
        return fn();
      } finally {
        try {
          closeSync(fd);
        } catch {
          /* ignore */
        }
        try {
          unlinkSync(lockFilePath);
        } catch {
          /* ignore */
        }
      }
    } catch {
      const end = Date.now() + 250;
      while (Date.now() < end) {
        /* spin */
      }
      waited += 1;
    }
  }
  throw new Error(`Timeout waiting for lock: ${lockFilePath}`);
}

export function loadTracker(path) {
  return readFileSync(path, 'utf8');
}

export function saveTracker(path, text) {
  writeFileSync(path, text, 'utf8');
}
