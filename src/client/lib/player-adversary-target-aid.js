/**
 * Pure helpers for the player adversary map-pin “target aid” (weapon reach + V2 selectTargets chips).
 */

import {
  tokenDistanceFtForElements,
  rangeBandNameToFt,
  distanceFtToRangeBandName,
  rangeFtToLabel,
  RANGE_BANDS_ORDERED,
} from './map-range.js';
import { effectiveTokenMapId } from './map-table-state.js';
import { getEffectiveWeaponRange } from './character-calc.js';

function sameMapPlane(a, b) {
  return effectiveTokenMapId(a?.mapId) === effectiveTokenMapId(b?.mapId);
}

/**
 * Nearest-edge distance in feet between two placed tokens, or null if not comparable.
 * @param {object} pcEl
 * @param {object} advEl
 * @returns {number|null}
 */
export function distancePcToAdversaryFt(pcEl, advEl) {
  if (!pcEl || !advEl) return null;
  if (!sameMapPlane(pcEl, advEl)) return null;
  if (pcEl.tokenX == null || pcEl.tokenY == null || advEl.tokenX == null || advEl.tokenY == null) return null;
  return tokenDistanceFtForElements(pcEl, advEl);
}

/**
 * Max range in feet for a weapon row (ancestry-adjusted range string).
 * @param {object} weapon
 * @param {object[]} ancestryFeatures
 * @returns {number|undefined}
 */
export function weaponMaxRangeFt(weapon, ancestryFeatures) {
  if (!weapon || typeof weapon !== 'object') return undefined;
  const rangeStr = getEffectiveWeaponRange(weapon, ancestryFeatures) || weapon.effectiveRange || weapon.range;
  if (!rangeStr || typeof rangeStr !== 'string') return undefined;
  return rangeBandNameToFt(rangeStr);
}

/**
 * @param {Array} targets — from `chip.selectTargets(table)`
 * @param {string|number} adversaryInstanceId
 * @returns {boolean}
 */
export function selectTargetsIncludesAdversary(targets, adversaryInstanceId) {
  if (!Array.isArray(targets) || adversaryInstanceId == null || adversaryInstanceId === '') return false;
  const sid = String(adversaryInstanceId);
  return targets.some((t) => t != null && String(t.instanceId ?? t.id) === sid);
}

/**
 * Run `chip.selectTargets(table)` safely.
 * @returns {object[]}
 */
export function safeSelectTargets(chip, table) {
  if (typeof chip?.selectTargets !== 'function') return [];
  try {
    const out = chip.selectTargets(table);
    return Array.isArray(out) ? out : [];
  } catch {
    return [];
  }
}

/**
 * Human-readable range for adversary map-pin copy (distance in feet between PC and target).
 */
export function formatAdversaryPinRangeLabel(distanceFt) {
  if (distanceFt == null || typeof distanceFt !== 'number') {
    return 'unknown range';
  }
  const bandName = distanceFtToRangeBandName(distanceFt);
  const bandEntry = bandName ? RANGE_BANDS_ORDERED.find((b) => b.name === bandName) : null;
  const label = bandEntry ? bandEntry.name : rangeFtToLabel(distanceFt);
  return label;
}

/**
 * Merge adversary targeting validity into a sheet chip slot (see {@link buildActionChipSlotsForSheet}).
 * When the adversary is not in `selectTargets`, force unusable with a "Not a valid target" line.
 *
 * @param {object} slot
 * @param {boolean} adversaryValid
 * @returns {object}
 */
export function applySelectTargetsAdversaryGate(slot, adversaryValid) {
  if (adversaryValid) return slot;
  const prev = slot.primaryUnusableLine;
  const line = prev ? `Not a valid target — ${prev}` : 'Not a valid target';
  return {
    ...slot,
    moveToUnusable: true,
    primaryUnusableLine: line,
  };
}
