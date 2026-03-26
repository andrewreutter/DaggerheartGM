/**
 * Pure helpers for V2 implementation queue reporting (see scripts/v2-migration-queue.mjs + GitHub Issues).
 */

export const PRIORITY_DOMAINS = [
  'Arcana',
  'Codex',
  'Grace',
  'Midnight',
  'Sage',
  'Splendor',
  'Valor',
];

export const ABILITY_TIERS = [1, 2, 3];

function splitTableRow(line) {
  if (!line.startsWith('|')) return null;
  const parts = line.split('|');
  if (parts.length < 3) return null;
  const cells = parts.slice(1, -1).map((c) => c.trim());
  return cells;
}

function isSeparatorRow(cells) {
  if (!cells || cells.length === 0) return true;
  return cells.every((c) => /^[-:]+$/.test(c.replace(/\s/g, '')));
}

/**
 * @returns {{ abilities: Record<number, Array<{ domain: string, featureName: string, sourceFile: string, status: string }>>, beastforms: Array<{ featureName: string, sourceFile: string, status: string }>, items: Array<{ featureName: string, sourceFile: string, status: string }>, consumables: Array<{ featureName: string, sourceFile: string, status: string }> }}
 */
export function parseTrackerMarkdown(text) {
  const abilities = { 1: [], 2: [], 3: [] };
  const beastforms = [];
  const items = [];
  const consumables = [];

  const lines = text.split(/\r?\n/);
  let mode = null;
  let abilityTier = 1;

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
    if (!cells || cells.length < 3) continue;
    if (isSeparatorRow(cells)) continue;

    if (mode === 'abilities') {
      if (cells.length < 4) continue;
      const domain = cells[0];
      const featureName = cells[1];
      const sourceFile = cells[2];
      const status = cells[3];
      if (!sourceFile.includes('abilities/')) continue;
      if (!abilities[abilityTier]) abilities[abilityTier] = [];
      abilities[abilityTier].push({ domain, featureName, sourceFile, status });
      continue;
    }

    if (mode === 'beastforms' || mode === 'items' || mode === 'consumables') {
      const featureName = cells[0];
      const sourceFile = cells[1];
      const status = cells[2];
      const prefix = mode === 'beastforms' ? 'beastforms/' : mode === 'items' ? 'items/' : 'consumables/';
      if (!sourceFile.includes(prefix)) continue;
      const row = { featureName, sourceFile, status };
      if (mode === 'beastforms') beastforms.push(row);
      else if (mode === 'items') items.push(row);
      else consumables.push(row);
    }
  }

  return { abilities, beastforms, items, consumables };
}

function anyStatus(rows, statuses) {
  const set = new Set(statuses);
  return rows.some((r) => set.has(r.status));
}

/**
 * Cross-collection gate for *implementation* (Unclaimed only), per implementation-agent.
 */
export function getActiveCollectionForImpl(parsed) {
  const { abilities, beastforms, items, consumables } = parsed;
  const flatAbilities = ABILITY_TIERS.flatMap((t) => abilities[t] || []);
  if (flatAbilities.some((r) => r.status === 'Unclaimed')) return 'abilities';
  if (beastforms.some((r) => r.status === 'Unclaimed')) return 'beastforms';
  if (items.some((r) => r.status === 'Unclaimed')) return 'items';
  if (consumables.some((r) => r.status === 'Unclaimed')) return 'consumables';
  return null;
}

/**
 * Current tier for claims: smallest N in {1,2,3} such that tiers 1..N-1 have no Unclaimed/In Progress,
 * and tier N still has at least one Unclaimed or In Progress row. If all tiers are clear of open work,
 * returns null.
 */
export function getClaimableAbilityTier(parsed) {
  const { abilities } = parsed;
  for (const n of ABILITY_TIERS) {
    let belowClear = true;
    for (let k = 1; k < n; k++) {
      const rows = abilities[k] || [];
      if (anyStatus(rows, ['Unclaimed', 'In Progress'])) {
        belowClear = false;
        break;
      }
    }
    if (!belowClear) continue;
    const rowsN = abilities[n] || [];
    if (anyStatus(rowsN, ['Unclaimed', 'In Progress'])) return n;
  }
  return null;
}

/**
 * In tier N, Blade/Bone Unclaimed are blocked while any priority domain has Unclaimed or In Progress.
 */
export function priorityDomainBlocksBladeBoneInTier(tierRows) {
  const priority = tierRows.filter((r) => PRIORITY_DOMAINS.includes(r.domain));
  return anyStatus(priority, ['Unclaimed', 'In Progress']);
}

/**
 * @returns {Array<{ domain: string, featureName: string, sourceFile: string, status: string, tier: number }>}
 */
export function getClaimableAbilityUnclaimed(parsed, limit = 15) {
  const tier = getClaimableAbilityTier(parsed);
  if (tier == null) return [];
  const rows = parsed.abilities[tier] || [];
  const bladeBlocked = priorityDomainBlocksBladeBoneInTier(rows);
  const out = [];
  for (const r of rows) {
    if (r.status !== 'Unclaimed') continue;
    if (bladeBlocked && (r.domain === 'Blade' || r.domain === 'Bone')) continue;
    out.push({ ...r, tier });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * @returns {Array<{ featureName: string, sourceFile: string, status: string }>}
 */
export function getClaimableSimpleRows(rows, limit) {
  return rows.filter((r) => r.status === 'Unclaimed').slice(0, limit);
}

export function buildQueueReport(parsed, options = {}) {
  const limit = options.limit ?? 15;
  const active = getActiveCollectionForImpl(parsed);

  const report = {
    activeCollection: active,
    abilitiesClaimableTier: null,
    nextRows: [],
    bladeBoneBlockedInTier: false,
    note: null,
  };

  if (active === null) {
    report.note = 'No Unclaimed rows in abilities, beastforms, items, or consumables.';
    return report;
  }

  if (active === 'abilities') {
    const tier = getClaimableAbilityTier(parsed);
    report.abilitiesClaimableTier = tier;
    const tierRows = tier != null ? parsed.abilities[tier] || [] : [];
    report.bladeBoneBlockedInTier = tierRows.length > 0 && priorityDomainBlocksBladeBoneInTier(tierRows);
    report.nextRows = getClaimableAbilityUnclaimed(parsed, limit).map((r) => ({
      domain: r.domain,
      featureName: r.featureName,
      sourceFile: r.sourceFile,
      status: r.status,
      tier: r.tier,
    }));
    if (tier != null && report.nextRows.length === 0) {
      const hasUnclaimedInTier = tierRows.some((r) => r.status === 'Unclaimed');
      if (!hasUnclaimedInTier) {
        report.note =
          `Tier ${tier} has no claimable Unclaimed rows (may be all In Progress or blocked until lower tiers clear).`;
      } else {
        report.note =
          'Tier has Unclaimed Blade/Bone rows blocked until all priority domains (Arcana–Valor) in this tier are cleared of Unclaimed/In Progress.';
      }
    }
    return report;
  }

  if (active === 'beastforms') {
    report.nextRows = getClaimableSimpleRows(parsed.beastforms, limit).map((r) => ({
      featureName: r.featureName,
      sourceFile: r.sourceFile,
      status: r.status,
    }));
    return report;
  }

  if (active === 'items') {
    report.nextRows = getClaimableSimpleRows(parsed.items, limit).map((r) => ({
      featureName: r.featureName,
      sourceFile: r.sourceFile,
      status: r.status,
    }));
    return report;
  }

  report.nextRows = getClaimableSimpleRows(parsed.consumables, limit).map((r) => ({
    featureName: r.featureName,
    sourceFile: r.sourceFile,
    status: r.status,
  }));
  return report;
}

export function formatQueueText(report, options = {}) {
  const lines = [];
  const derived = options.queueSourceDescription || 'GitHub Issues (v2-migration)';
  lines.push(`V2 implementation queue (derived from ${derived})`);
  lines.push('Rules: docs/agent-prompts/implementation-agent.md (Cross-collection priority, Domain tier order).');
  lines.push('');

  if (report.note && !report.activeCollection) {
    lines.push(report.note);
    return lines.join('\n');
  }

  lines.push(`Active collection (impl): ${report.activeCollection}`);
  if (report.activeCollection === 'abilities' && report.abilitiesClaimableTier != null) {
    lines.push(`Claimable tier: ${report.abilitiesClaimableTier}`);
    lines.push(`Blade/Bone blocked by priority domains in this tier: ${report.bladeBoneBlockedInTier ? 'yes' : 'no'}`);
  }
  lines.push('');

  if (report.nextRows.length === 0) {
    lines.push('Next claimable Unclaimed rows: (none)');
    if (report.note) lines.push(`Note: ${report.note}`);
  } else {
    lines.push(`Next claimable Unclaimed rows (up to ${options.limit ?? 15}):`);
    for (const r of report.nextRows) {
      if (r.domain != null) {
        lines.push(`  - [Tier ${r.tier}] ${r.domain} — ${r.featureName} (${r.sourceFile})`);
      } else {
        lines.push(`  - ${r.featureName} (${r.sourceFile})`);
      }
    }
    if (report.note) lines.push(`Note: ${report.note}`);
  }

  lines.push('');
  lines.push(
    options.claimFooter ||
      'Claim: set v2-status label and agent in the GitHub Issue JSON body.',
  );
  return lines.join('\n');
}

export const QUEUE_MARKERS = {
  start: '<!-- v2-queue:start -->',
  end: '<!-- v2-queue:end -->',
};

export function injectQueueSection(markdown, generatedBody) {
  const { start, end } = QUEUE_MARKERS;
  if (!markdown.includes(start) || !markdown.includes(end)) {
    throw new Error(`Missing ${start} or ${end} in markdown`);
  }
  const re = new RegExp(`${escapeRe(start)}[\\s\\S]*?${escapeRe(end)}`, 'm');
  const block = `${start}\n\n${generatedBody.trim()}\n\n${end}`;
  return markdown.replace(re, block);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
