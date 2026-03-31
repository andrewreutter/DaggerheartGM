/**
 * Validate / normalize encounter AI JSON: ID-only adds, BP cap, catalog membership.
 */

import { computeBattlePoints } from './client/lib/battle-points.js';
import { ENV_TYPES, ROLES, ROLE_BP_COST } from './game-constants.js';

export function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase().trim();
  return ROLES.includes(r) ? r : 'standard';
}

function clampCount(n) {
  const x = parseInt(String(n), 10);
  if (Number.isNaN(x) || x < 1) return 1;
  return Math.min(99, x);
}

function clampTier(t, fallback = 1) {
  const x = parseInt(String(t ?? ''), 10);
  if (Number.isNaN(x)) return Math.min(4, Math.max(1, fallback));
  return Math.min(4, Math.max(1, x));
}

function clampEnvType(raw) {
  const t = String(raw || 'exploration').toLowerCase().trim();
  return ENV_TYPES.includes(t) ? t : 'exploration';
}

/**
 * Coerce LLM row to { id, count }. Accepts only id + count (not full stat objects).
 * @param {unknown} row
 * @returns {{ id: string, count: number } | null}
 */
export function coerceIdCountRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (row.hp_max != null || row.attack != null || row.hp_thresholds != null || row.difficulty != null) {
    return null;
  }
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null;
  if (!id) return null;
  return { id, count: clampCount(row.count ?? 1) };
}

/**
 * @param {unknown} row
 * @param {number} defaultTier
 * @returns {{ id: string, count: number, tier: number, role: string, nameHint?: string } | null}
 */
export function coerceAdversaryAddRow(row, defaultTier = 1) {
  const base = coerceIdCountRow(row);
  if (!base) return null;
  const tier = clampTier(row?.tier, defaultTier);
  const role = normalizeRole(row?.role);
  const nameHint =
    typeof row?.nameHint === 'string' && row.nameHint.trim() ? row.nameHint.trim() : undefined;
  return { ...base, tier, role, ...(nameHint ? { nameHint } : {}) };
}

/**
 * @param {unknown} row
 * @param {number} defaultTier
 * @returns {{ id: string, count: number, tier: number, type: string } | null}
 */
export function coerceEnvironmentAddRow(row, defaultTier = 1) {
  const base = coerceIdCountRow(row);
  if (!base) return null;
  const tier = clampTier(row?.tier, defaultTier);
  const type = clampEnvType(row?.type);
  const nameHint =
    typeof row?.nameHint === 'string' && row.nameHint.trim() ? row.nameHint.trim() : undefined;
  return { ...base, tier, type, ...(nameHint ? { nameHint } : {}) };
}

/**
 * Merge duplicate ids in adds list.
 * @param {{ id: string, count: number }[]} rows
 */
export function mergeIdCounts(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r?.id) continue;
    m.set(r.id, (m.get(r.id) || 0) + r.count);
  }
  return [...m.entries()].map(([id, count]) => ({ id, count }));
}

/**
 * @param {{ id: string, count: number, tier?: number, role?: string, nameHint?: string }[]} rows
 */
function mergeAdversaryRowsWithMeta(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r?.id) continue;
    const prev = m.get(r.id);
    if (!prev) {
      m.set(r.id, { ...r });
    } else {
      m.set(r.id, {
        ...prev,
        count: prev.count + r.count,
      });
    }
  }
  return [...m.values()];
}

/**
 * @param {{ id: string, count: number, tier?: number, type?: string }[]} rows
 */
function mergeEnvironmentRowsWithMeta(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r?.id) continue;
    const prev = m.get(r.id);
    if (!prev) m.set(r.id, { ...r });
    else m.set(r.id, { ...prev, count: prev.count + r.count });
  }
  return [...m.values()];
}

/**
 * @param {unknown[]} rawAdds
 * @param {number} defaultPartyTier
 * @returns {{ id: string, count: number, tier: number, role: string, nameHint?: string }[]}
 */
export function normalizeAdversaryAdds(rawAdds, defaultPartyTier = 1) {
  if (!Array.isArray(rawAdds)) return [];
  const out = [];
  for (const row of rawAdds) {
    const c = coerceAdversaryAddRow(row, defaultPartyTier);
    if (c) out.push(c);
  }
  return mergeAdversaryRowsWithMeta(out);
}

/**
 * @param {unknown[]} rawAdds
 * @param {number} defaultPartyTier
 * @returns {{ id: string, count: number, tier: number, type: string }[]}
 */
export function normalizeEnvironmentAdds(rawAdds, defaultPartyTier = 1) {
  if (!Array.isArray(rawAdds)) return [];
  const out = [];
  for (const row of rawAdds) {
    const c = coerceEnvironmentAddRow(row, defaultPartyTier);
    if (c) out.push(c);
  }
  return mergeEnvironmentRowsWithMeta(out);
}

/**
 * Augment catalog meta with tier/role from plan rows for ids not yet in the catalog.
 * @param {{ id: string, count: number, tier?: number, role?: string }[]} adversaryAdds
 * @param {Map<string, { role?: string, tier?: number }>} adversaryMetaById
 * @returns {Map<string, { role?: string, tier?: number }>}
 */
export function augmentMetaForAdversaryPlanRows(adversaryAdds, adversaryMetaById) {
  const m = new Map(adversaryMetaById);
  for (const row of adversaryAdds) {
    if (!m.has(row.id) && row.role != null) {
      m.set(row.id, {
        role: normalizeRole(row.role),
        tier: clampTier(row.tier, 1),
      });
    }
  }
  return m;
}

/**
 * Reattach tier/role from meta map onto trimmed id rows.
 * @param {{ id: string, count: number }[]} trimmed
 * @param {Map<string, { role?: string, tier?: number }>} metaById
 */
export function reattachAdversaryRowFields(trimmed, metaById) {
  return trimmed.map(({ id, count }) => {
    const meta = metaById.get(id);
    const row = { id, count };
    if (meta?.tier != null) row.tier = clampTier(meta.tier, 1);
    if (meta?.role != null) row.role = normalizeRole(meta.role);
    return row;
  });
}

/**
 * @param {unknown} raw
 * @returns {{ concept: string, tier: number, role: string, count: number } | null}
 */
export function normalizeSyntheticAdversaryRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const concept = typeof raw.concept === 'string' ? raw.concept.trim() : '';
  if (!concept) return null;
  const tier = Math.min(4, Math.max(1, parseInt(String(raw.tier ?? '1'), 10) || 1));
  const role = normalizeRole(raw.role);
  const count = clampCount(raw.count ?? 1);
  return { concept, tier, role, count };
}

/**
 * @param {unknown} raw
 * @returns {{ concept: string, tier: number, type: string } | null}
 */
export function normalizeSyntheticEnvironmentRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const concept = typeof raw.concept === 'string' ? raw.concept.trim() : '';
  if (!concept) return null;
  const tier = Math.min(4, Math.max(1, parseInt(String(raw.tier ?? '1'), 10) || 1));
  const type = String(raw.type || 'exploration').toLowerCase().trim();
  const ok = ['traversal', 'exploration', 'social', 'event'].includes(type) ? type : 'exploration';
  return { concept, tier, type: ok };
}

/**
 * @param {{ id: string, count: number, tier?: number, role?: string }[]} adversaryAdds
 * @param {Map<string, { role?: string, tier?: number }>} metaById
 * @param {number} partySize
 * @returns {number}
 */
export function sumBpForAdversaryAdds(adversaryAdds, metaById, partySize) {
  const summary = [];
  for (const row of adversaryAdds) {
    const meta = metaById.get(row.id);
    const role = meta
      ? normalizeRole(meta.role)
      : normalizeRole(row.role);
    const tier = meta
      ? Math.min(4, Math.max(1, parseInt(String(meta.tier ?? 1), 10) || 1))
      : Math.min(4, Math.max(1, parseInt(String(row.tier ?? 1), 10) || 1));
    summary.push({ role, tier, count: row.count, name: '' });
  }
  return computeBattlePoints(summary, partySize);
}

/**
 * @param {{
 *   adversaryAdds: { id: string, count: number, tier?: number, role?: string }[],
 *   environmentAdds: { id: string, count: number, tier?: number, type?: string }[],
 *   adversaryIdSet: Set<string>,
 *   environmentIdSet: Set<string>,
 *   remainingBattlePoints: number,
 *   partySize: number,
 *   adversaryMetaById: Map<string, { role?: string, tier?: number }>,
 *   filterUnknownAdversaryIds?: boolean,
 *   filterUnknownEnvironmentIds?: boolean,
 * }} opts
 * @returns {{ adversaryAdds: { id: string, count: number, tier?: number, role?: string }[], environmentAdds: { id: string, count: number, tier?: number, type?: string }[], warnings: string[] }}
 */
export function validateEncounterSelections(opts) {
  const warnings = [];
  const filterAdv = opts.filterUnknownAdversaryIds !== false;
  const filterEnv = opts.filterUnknownEnvironmentIds !== false;
  let adversaryAdds = [...opts.adversaryAdds];
  let environmentAdds = [...opts.environmentAdds];

  const augmentedMeta = augmentMetaForAdversaryPlanRows(adversaryAdds, opts.adversaryMetaById);

  if (filterAdv) {
    adversaryAdds = adversaryAdds.filter((row) => {
      if (!opts.adversaryIdSet.has(row.id)) {
        warnings.push(`Adversary id not in catalog (removed): ${row.id}`);
        return false;
      }
      return true;
    });
  }

  if (filterEnv) {
    environmentAdds = environmentAdds.filter((row) => {
      if (!opts.environmentIdSet.has(row.id)) {
        warnings.push(
          `Environment id not in catalog (removed): ${row.id}. Use an id from catalog.environments or needsSyntheticEnvironment for a new place.`,
        );
        return false;
      }
      return true;
    });
  }

  let bp = sumBpForAdversaryAdds(adversaryAdds, augmentedMeta, opts.partySize);
  if (bp > opts.remainingBattlePoints) {
    warnings.push(
      `BP total ${bp} exceeds remaining ${opts.remainingBattlePoints}; trimming counts.`,
    );
    let trimmed = trimAdversaryAddsToBudget(
      adversaryAdds,
      augmentedMeta,
      opts.partySize,
      opts.remainingBattlePoints,
    );
    adversaryAdds = reattachAdversaryRowFields(trimmed, augmentedMeta);
    bp = sumBpForAdversaryAdds(adversaryAdds, augmentedMeta, opts.partySize);
    if (bp > opts.remainingBattlePoints) {
      warnings.push('Could not satisfy BP cap after trim; cleared adversary picks.');
      adversaryAdds = [];
    }
  }

  return { adversaryAdds, environmentAdds, warnings };
}

/**
 * Remove instances one at a time (recomputing minion grouping) until BP ≤ maxBp.
 */
function trimAdversaryAddsToBudget(adds, metaById, partySize, maxBp) {
  const expanded = [];
  for (const { id, count } of adds) {
    for (let i = 0; i < count; i++) expanded.push(id);
  }
  function marginalCost(id) {
    const r = normalizeRole(metaById.get(id)?.role);
    if (r === 'minion') return 0.1;
    return ROLE_BP_COST[r] ?? ROLE_BP_COST.standard;
  }
  while (expanded.length) {
    const test = mergeIdCounts(expanded.map((id) => ({ id, count: 1 })));
    const bp = sumBpForAdversaryAdds(test, metaById, partySize);
    if (bp <= maxBp) return test;
    let worst = 0;
    let worstScore = -1;
    for (let i = 0; i < expanded.length; i++) {
      const s = marginalCost(expanded[i]);
      if (s > worstScore) {
        worstScore = s;
        worst = i;
      }
    }
    expanded.splice(worst, 1);
  }
  return [];
}

/**
 * BP cost for needsSyntheticAdversaries (same rules as catalog picks).
 * @param {{ role: string, tier: number, count: number }[]} requests
 * @param {number} partySize
 * @returns {number}
 */
export function sumBpForSyntheticAdversaryRequests(requests, partySize) {
  if (!Array.isArray(requests) || !requests.length) return 0;
  const summary = requests.map((r) => ({
    role: normalizeRole(r.role),
    tier: Math.min(4, Math.max(1, parseInt(String(r.tier ?? 1), 10) || 1)),
    count: clampCount(r.count ?? 1),
    name: '',
  }));
  return computeBattlePoints(summary, partySize);
}

/**
 * @param {{ id: string, count: number, tier?: number, role?: string }[]} adversaryAdds
 * @param {Map<string, { role?: string, tier?: number }>} adversaryMetaById
 * @param {number} partySize
 * @param {{ concept: string, tier: number, role: string, count: number }[]} needsSyntheticAdversaries
 */
export function totalEncounterPlanBp(adversaryAdds, adversaryMetaById, partySize, needsSyntheticAdversaries) {
  const augmented = augmentMetaForAdversaryPlanRows(adversaryAdds, adversaryMetaById);
  const catalog = sumBpForAdversaryAdds(adversaryAdds, augmented, partySize);
  const synth = sumBpForSyntheticAdversaryRequests(needsSyntheticAdversaries, partySize);
  return catalog + synth;
}

function trimSyntheticRequestsToBudget(requests, partySize, maxBp) {
  if (!requests?.length || maxBp < 0) return [];
  const out = requests.map((r) => ({ ...r }));
  while (out.length) {
    const bp = sumBpForSyntheticAdversaryRequests(out, partySize);
    if (bp <= maxBp) return out;
    const last = out[out.length - 1];
    if (last.count > 1) {
      last.count--;
    } else {
      out.pop();
    }
  }
  return [];
}

/**
 * Drop unknown adversary ids, trim catalog + synthetic so total BP ≤ remainingBattlePoints.
 * @param {{
 *   adversaryAdds: { id: string, count: number }[],
 *   environmentAdds: { id: string, count: number }[],
 *   needsSyntheticAdversaries: { concept: string, tier: number, role: string, count: number }[],
 *   adversaryIdSet: Set<string>,
 *   environmentIdSet: Set<string>,
 *   remainingBattlePoints: number,
 *   partySize: number,
 *   adversaryMetaById: Map<string, { role?: string, tier?: number }>,
 *   filterUnknownAdversaryIds?: boolean,
 *   filterUnknownEnvironmentIds?: boolean,
 * }} opts
 * @returns {{
 *   adversaryAdds: { id: string, count: number, tier?: number, role?: string }[],
 *   environmentAdds: { id: string, count: number, tier?: number, type?: string }[],
 *   needsSyntheticAdversaries: { concept: string, tier: number, role: string, count: number }[],
 *   warnings: string[],
 *   totalBp: number,
 * }}
 */
export function validateFullEncounterPlan(opts) {
  const warnings = [];
  let needsSyntheticAdversaries = [...opts.needsSyntheticAdversaries];

  let synthBp = sumBpForSyntheticAdversaryRequests(needsSyntheticAdversaries, opts.partySize);
  if (synthBp > opts.remainingBattlePoints) {
    warnings.push(
      `Synthetic adversary BP (${synthBp}) exceeded remaining ${opts.remainingBattlePoints}; trimming synthetic requests.`,
    );
    needsSyntheticAdversaries = trimSyntheticRequestsToBudget(
      needsSyntheticAdversaries,
      opts.partySize,
      opts.remainingBattlePoints,
    );
    synthBp = sumBpForSyntheticAdversaryRequests(needsSyntheticAdversaries, opts.partySize);
  }

  const catalogRemaining = Math.max(0, opts.remainingBattlePoints - synthBp);
  const val = validateEncounterSelections({
    adversaryAdds: opts.adversaryAdds,
    environmentAdds: opts.environmentAdds,
    adversaryIdSet: opts.adversaryIdSet,
    environmentIdSet: opts.environmentIdSet,
    remainingBattlePoints: catalogRemaining,
    partySize: opts.partySize,
    adversaryMetaById: opts.adversaryMetaById,
    filterUnknownAdversaryIds: opts.filterUnknownAdversaryIds,
    filterUnknownEnvironmentIds: opts.filterUnknownEnvironmentIds,
  });

  warnings.push(...val.warnings);

  const totalBp = totalEncounterPlanBp(
    val.adversaryAdds,
    opts.adversaryMetaById,
    opts.partySize,
    needsSyntheticAdversaries,
  );

  return {
    adversaryAdds: val.adversaryAdds,
    environmentAdds: val.environmentAdds,
    needsSyntheticAdversaries,
    warnings,
    totalBp,
  };
}

/**
 * @param {unknown} raw
 * @returns {{ id: string, count: number, role: string, bp: number }[] | null}
 */
export function parseBpBreakdown(raw) {
  if (!Array.isArray(raw)) return null;
  const lines = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const role = typeof row.role === 'string' ? row.role.trim() : '';
    if (!id || !role) continue;
    const count = clampCount(row.count ?? 1);
    const bp = parseInt(String(row.bp ?? ''), 10);
    if (Number.isNaN(bp)) continue;
    lines.push({ id, role, count, bp });
  }
  return lines.length ? lines : null;
}

/**
 * Soft checks on model-reported BP fields vs computed total.
 * @param {object} parsed — raw LLM JSON
 * @param {number} actualTotalBp
 */
export function collectBudgetFieldsWarnings(parsed, actualTotalBp) {
  const warnings = [];
  const est = parsed?.estimatedBp;
  let estimatedMatchesActual = false;
  if (est == null || est === '') {
    warnings.push('Model output omitted estimatedBp.');
  } else {
    const n = parseInt(String(est), 10);
    if (Number.isNaN(n)) {
      warnings.push('estimatedBp was not a valid integer.');
    } else if (n !== actualTotalBp) {
      warnings.push(`estimatedBp (${n}) did not match computed encounter BP (${actualTotalBp}).`);
    } else {
      estimatedMatchesActual = true;
    }
  }

  const breakdown = parseBpBreakdown(parsed?.bpBreakdown);
  if (breakdown) {
    const sum = breakdown.reduce((s, l) => s + l.bp, 0);
    // When estimatedBp already matches the server total, skip nitpicking line items (models often mis-sum breakdown).
    if (sum !== actualTotalBp && !estimatedMatchesActual) {
      warnings.push(`bpBreakdown line sum (${sum}) did not match computed encounter BP (${actualTotalBp}).`);
    }
  }

  return warnings;
}
