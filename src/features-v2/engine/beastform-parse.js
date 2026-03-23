/**
 * Shared beastform SRD string parsing — no dependency on feature-loader (avoids circular imports).
 */

import { SRD_CLASS_DRUID_SCOPE_KEY } from './feature-scope-keys.js';

export function normalizeBeastformRangeBand(rangeStr) {
  const x = String(rangeStr).trim().toLowerCase();
  if (x === 'very close') return 'veryClose';
  if (x === 'very far') return 'veryFar';
  return x;
}

/**
 * Parse a beastform `attack` line such as `"Melee Agility d4 phy"`.
 * @returns {{ trait: string, range: string, damage: string, damageType: 'physical'|'magic' } | null}
 */
export function parseBeastformAttackLine(line) {
  if (!line || typeof line !== 'string') return null;
  const m = line
    .trim()
    .match(/^(Melee|Very Close|Close|Far|Very Far)\s+(\w+)\s+(d\d+)(?:\s+(phy|mag))?/i);
  if (!m) return null;
  return {
    trait: m[2].toLowerCase(),
    range: normalizeBeastformRangeBand(m[1]),
    damage: m[3],
    damageType: m[4]?.toLowerCase() === 'mag' ? 'magic' : 'physical',
  };
}

/**
 * Pick active beastform ref from merged feature state.
 * Prefer Druid scoped bag; fall back to legacy `Beastform` / `Evolution` keys (tests + old JSON
 * until `normalizePersistedCharacterElement` has merged into scoped).
 */
export function pickActiveBeastformRef(mergedFeatureState) {
  const scoped = mergedFeatureState?.[SRD_CLASS_DRUID_SCOPE_KEY]?.activeBeastform;
  if (scoped?.beastformId) {
    return { ref: scoped, viaEvolution: scoped.viaEvolution === true };
  }
  const b = mergedFeatureState?.Beastform?.activeBeastform;
  const e = mergedFeatureState?.Evolution?.activeBeastform;
  if (b?.beastformId) return { ref: b, viaEvolution: false };
  if (e?.beastformId) return { ref: e, viaEvolution: true };
  return null;
}
