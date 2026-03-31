/**
 * Resolve hallucinated encounter catalog ids (near match or homebrew AI builders).
 */

import { buildAdversaryAiFromConcept } from './llm-adversary-builder.js';
import { buildEnvironmentAiFromConcept } from './llm-environment-builder.js';
import { findBestCatalogNearMatch, mergeAdvPlanRows, mergeEnvPlanRows } from './encounter-id-resolve.js';
import { ENV_TYPES } from './game-constants.js';
import {
  normalizeRole,
  normalizeSyntheticAdversaryRequest,
  normalizeSyntheticEnvironmentRequest,
} from './encounter-ai-resolve.js';
import { truncDesc } from './encounter-ai-catalog.js';

function clampTier(t, fallback = 1) {
  const x = parseInt(String(t ?? ''), 10);
  if (Number.isNaN(x)) return Math.min(4, Math.max(1, fallback));
  return Math.min(4, Math.max(1, x));
}

function clampEnvType(raw) {
  const t = String(raw || 'exploration').toLowerCase().trim();
  return ENV_TYPES.includes(t) ? t : 'exploration';
}

/** Stable key for merged synthetic adversary rows. Exported for tests. */
export function syntheticAdversaryMergeKey(spec) {
  return `${String(spec.concept)}||${clampTier(spec.tier)}||${normalizeRole(spec.role)}`;
}

/**
 * Merge synthetic adversary request rows by concept+tier+role.
 * @param {{ concept: string, tier: number, role: string, count: number }[]} rows
 */
function mergeSyntheticAdversaryRows(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = syntheticAdversaryMergeKey(r);
    const prev = m.get(k);
    if (!prev) m.set(k, { ...r });
    else m.set(k, { ...prev, count: prev.count + r.count });
  }
  return [...m.values()];
}

/**
 * @param {{
 *   encounterConcept: string,
 *   adversaryAdds: { id: string, count: number, tier?: number, role?: string, nameHint?: string }[],
 *   environmentAdds: { id: string, count: number, tier?: number, type?: string }[],
 *   needsSyntheticAdversaries: { concept: string, tier: number, role: string, count: number }[],
 *   needsSyntheticEnvironment: { concept: string, tier: number, type: string } | null,
 *   advCatalog: { id: string, name?: string, tier?: number, role?: string }[],
 *   envCatalog: { id: string, name?: string, tier?: number, type?: string }[],
 *   adversaryIdSet: Set<string>,
 *   environmentIdSet: Set<string>,
 *   signal?: AbortSignal,
 * }} opts
 */
export async function resolveEncounterPlanAndBuildHomebrew(opts) {
  const encounterConcept = String(opts.encounterConcept || '').trim() || 'Encounter';
  const warnings = [];
  const homebrewReport = [];

  const hasUnknownAdv = opts.adversaryAdds.some((r) => !opts.adversaryIdSet.has(r.id));
  const hasUnknownEnv = opts.environmentAdds.some((r) => !opts.environmentIdSet.has(r.id));
  const fromLlmSynth = (opts.needsSyntheticAdversaries || [])
    .map((r) => normalizeSyntheticAdversaryRequest(r))
    .filter(Boolean);
  const hasSynthAdv = fromLlmSynth.length > 0;
  const hasSynthEnv = !!opts.needsSyntheticEnvironment;

  if (!hasUnknownAdv && !hasUnknownEnv && !hasSynthAdv && !hasSynthEnv) {
    return {
      adversaryAdds: mergeAdvPlanRows(opts.adversaryAdds),
      environmentAdds: mergeEnvPlanRows(opts.environmentAdds),
      needsSyntheticAdversaries: [],
      needsSyntheticEnvironment: null,
      homebrewAdversaryPatches: [],
      homebrewEnvironmentPatch: null,
      homebrewReport: [],
      warnings: [],
    };
  }

  const outAdv = [];
  const extraSynth = [];

  for (const row of opts.adversaryAdds) {
    if (opts.adversaryIdSet.has(row.id)) {
      outAdv.push(row);
      continue;
    }
    const match = findBestCatalogNearMatch(row.id, opts.advCatalog, {
      nameHint: row.nameHint,
    });
    if (match) {
      outAdv.push({ ...row, id: match.id });
      homebrewReport.push({
        kind: 'adversary',
        via: 'near_match',
        fromId: row.id,
        toId: match.id,
        score: match.score,
      });
      warnings.push(`Near match: replaced unknown adversary id "${row.id}" with catalog "${match.id}".`);
    } else {
      const tier = clampTier(row.tier, 1);
      const role = normalizeRole(row.role);
      const concept = `${encounterConcept} — ${role} adversary (tier ${tier}); original id: ${row.id}`;
      extraSynth.push({ concept, tier, role, count: row.count });
      homebrewReport.push({
        kind: 'adversary',
        via: 'homebrew',
        label: 'homebrew',
        fromId: row.id,
        tier,
        role,
      });
      warnings.push(
        `Unknown adversary id "${row.id}" — generating homebrew ${role} (tier ${tier}) via AI builder.`,
      );
    }
  }

  let mergedSynth = mergeSyntheticAdversaryRows([...fromLlmSynth, ...extraSynth]);

  const extraSynthKeys = new Set(extraSynth.map((e) => syntheticAdversaryMergeKey(e)));
  for (const spec of mergedSynth) {
    if (extraSynthKeys.has(syntheticAdversaryMergeKey(spec))) continue;
    homebrewReport.push({
      kind: 'adversary',
      via: 'homebrew',
      label: 'homebrew',
      tier: clampTier(spec.tier),
      role: normalizeRole(spec.role),
      source: 'llm_synthetic',
      concept: truncDesc(spec.concept, 120),
      count: spec.count,
    });
  }

  let outEnv = [];
  let needsSyntheticEnvironment = opts.needsSyntheticEnvironment
    ? normalizeSyntheticEnvironmentRequest(opts.needsSyntheticEnvironment)
    : null;

  for (const row of opts.environmentAdds) {
    if (opts.environmentIdSet.has(row.id)) {
      outEnv.push(row);
      continue;
    }
    const match = findBestCatalogNearMatch(row.id, opts.envCatalog, {
      nameHint: row.nameHint,
    });
    if (match) {
      outEnv.push({ ...row, id: match.id });
      homebrewReport.push({
        kind: 'environment',
        via: 'near_match',
        fromId: row.id,
        toId: match.id,
        score: match.score,
      });
      warnings.push(`Near match: replaced unknown environment id "${row.id}" with catalog "${match.id}".`);
    } else {
      const tier = clampTier(row.tier, 1);
      const type = clampEnvType(row.type);
      const concept = `${encounterConcept} — environment (${type}, tier ${tier}); original id: ${row.id}`;
      if (!needsSyntheticEnvironment) {
        needsSyntheticEnvironment = { concept, tier, type };
        homebrewReport.push({
          kind: 'environment',
          via: 'homebrew',
          label: 'homebrew',
          fromId: row.id,
          tier,
          type,
        });
        warnings.push(`Unknown environment id "${row.id}" — generating homebrew environment via AI builder.`);
      } else {
        warnings.push(
          `Unknown environment id "${row.id}" skipped (already generating a synthetic environment).`,
        );
      }
    }
  }

  if (
    needsSyntheticEnvironment &&
    !homebrewReport.some((r) => r.kind === 'environment' && r.via === 'homebrew')
  ) {
    const ne = needsSyntheticEnvironment;
    homebrewReport.push({
      kind: 'environment',
      via: 'homebrew',
      label: 'homebrew',
      tier: clampTier(ne.tier),
      type: clampEnvType(ne.type),
      source: 'llm_synthetic',
      concept: truncDesc(ne.concept, 120),
    });
  }

  const homebrewAdversaryPatches = [];
  for (const spec of mergedSynth) {
    const { patch, justification, warnings: w } = await buildAdversaryAiFromConcept(spec.concept, {
      tier: spec.tier,
      role: spec.role,
      signal: opts.signal,
    });
    if (w?.length) warnings.push(...w);
    homebrewAdversaryPatches.push({
      concept: spec.concept,
      tier: spec.tier,
      role: spec.role,
      count: spec.count,
      patch,
      builderJustification: justification,
    });
  }

  let homebrewEnvironmentPatch = null;
  if (needsSyntheticEnvironment) {
    const ne = needsSyntheticEnvironment;
    const { patch, justification, warnings: w } = await buildEnvironmentAiFromConcept(ne.concept, {
      tier: ne.tier,
      type: ne.type,
      signal: opts.signal,
    });
    if (w?.length) warnings.push(...w);
    homebrewEnvironmentPatch = {
      concept: ne.concept,
      tier: ne.tier,
      type: ne.type,
      patch,
      builderJustification: justification,
    };
  }

  return {
    adversaryAdds: mergeAdvPlanRows(outAdv),
    environmentAdds: mergeEnvPlanRows(outEnv),
    needsSyntheticAdversaries: [],
    needsSyntheticEnvironment: null,
    homebrewAdversaryPatches,
    homebrewEnvironmentPatch,
    homebrewReport,
    warnings,
  };
}
