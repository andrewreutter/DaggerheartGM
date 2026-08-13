/**
 * Beastbound companions as adversary-attack targets: range (placed token, else ranger's space),
 * banner target rows, and 1 Stress on hit.
 */

import { isCompanionBoardToken } from './board-token-utils.js';
import {
  getCharactersWithinRangeFt,
  getTokenFootprintFt,
  tokenDistanceFt,
} from './map-range.js';
import { effectiveTokenMapId } from './map-table-state.js';

function sameTokenMapPlane(a, b) {
  return effectiveTokenMapId(a?.mapId) === effectiveTokenMapId(b?.mapId);
}

export function isAdversaryAttackPartyTarget(target) {
  const type = typeof target === 'string' ? target : target?.type;
  return type === 'character' || type === 'companion';
}

export function isCompanionStressMaxed(companion) {
  if (companion == null || typeof companion !== 'object') return true;
  const max = typeof companion.maxStress === 'number' ? companion.maxStress : 3;
  const current = typeof companion.currentStress === 'number' ? companion.currentStress : 0;
  return max > 0 && current >= max;
}

function companionDisplayName(boardToken, companion) {
  const fromData = companion?.name != null ? String(companion.name).trim() : '';
  if (fromData) return fromData;
  const fromToken = boardToken?.label != null ? String(boardToken.label).trim() : '';
  return fromToken || 'Companion';
}

/**
 * Position used for range: the companion's placed token, otherwise the parent ranger
 * ("they stay by your side unless you tell them otherwise"). Footprint comes from
 * `parent.companion` size fields. Returns null when neither is on the map.
 *
 * @param {object} boardToken
 * @param {object|null|undefined} parentEl
 * @returns {{ tokenX: number, tokenY: number, mapId: *, altitude: number } | null}
 */
export function resolveCompanionRangeElement(boardToken, parentEl) {
  const companion = parentEl?.companion;
  const sizeSource = companion && typeof companion === 'object' ? companion : boardToken;
  const placed =
    boardToken?.tokenX != null && boardToken?.tokenY != null
      ? boardToken
      : parentEl?.tokenX != null && parentEl?.tokenY != null
        ? parentEl
        : null;
  if (!placed) return null;
  return {
    tokenX: placed.tokenX,
    tokenY: placed.tokenY,
    mapId: placed.mapId,
    altitude: placed.altitude ?? 0,
    tokenSizeWidth: sizeSource?.tokenSizeWidth,
    tokenSizeLength: sizeSource?.tokenSizeLength,
  };
}

/**
 * Banner/picker rows for living companions (boardToken + parent `companion` data).
 *
 * @param {object[]} activeElements
 * @returns {object[]}
 */
export function collectCompanionDamageTargets(activeElements) {
  const list = activeElements || [];
  const byId = new Map();
  for (const el of list) {
    if (el?.instanceId) byId.set(el.instanceId, el);
  }
  const targets = [];
  for (const el of list) {
    if (!isCompanionBoardToken(el)) continue;
    const parent = byId.get(el.parentInstanceId);
    const companion = parent?.companion;
    if (!companion || typeof companion !== 'object') continue;
    if (isCompanionStressMaxed(companion)) continue;
    targets.push({
      instanceId: el.instanceId,
      parentInstanceId: parent.instanceId,
      name: companionDisplayName(el, companion),
      type: 'companion',
      evasion: typeof companion.evasion === 'number' ? companion.evasion : 10,
      maxStress: typeof companion.maxStress === 'number' ? companion.maxStress : 3,
      currentStress: typeof companion.currentStress === 'number' ? companion.currentStress : 0,
      conditions: companion.conditions ?? '',
      maxHp: 0,
      currentHp: 0,
    });
  }
  return targets;
}

/**
 * Companions within maxFt of the source token (placed companion, else ranger space).
 *
 * @param {object[]} activeElements
 * @param {string} sourceInstanceId
 * @param {number} maxFt
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getCompanionsWithinRangeFt(activeElements, sourceInstanceId, maxFt) {
  const list = activeElements || [];
  const source = list.find((e) => e.instanceId === sourceInstanceId);
  if (!source || source.tokenX == null || source.tokenY == null) return [];
  if (typeof maxFt !== 'number' || maxFt < 0) return [];

  const byId = new Map();
  for (const el of list) {
    if (el?.instanceId) byId.set(el.instanceId, el);
  }
  const sourceFootprint = getTokenFootprintFt(source);
  const out = [];
  for (const el of list) {
    if (!isCompanionBoardToken(el)) continue;
    const parent = byId.get(el.parentInstanceId);
    const companion = parent?.companion;
    if (!companion || typeof companion !== 'object') continue;
    const rangeEl = resolveCompanionRangeElement(el, parent);
    if (!rangeEl) continue;
    if (!sameTokenMapPlane(source, rangeEl)) continue;
    const dist = tokenDistanceFt(
      source.tokenX,
      source.tokenY,
      rangeEl.tokenX,
      rangeEl.tokenY,
      sourceFootprint,
      getTokenFootprintFt(rangeEl),
      source.altitude ?? 0,
      rangeEl.altitude ?? 0,
    );
    if (dist <= maxFt) {
      out.push({ instanceId: el.instanceId, name: companionDisplayName(el, companion) });
    }
  }
  return out;
}

/**
 * Characters + companions within maxFt of the source (adversary-attack target set).
 *
 * @param {object[]} activeElements
 * @param {string} sourceInstanceId
 * @param {number} maxFt
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getAdversaryAttackTargetsWithinRangeFt(activeElements, sourceInstanceId, maxFt) {
  return [
    ...getCharactersWithinRangeFt(activeElements, sourceInstanceId, maxFt),
    ...getCompanionsWithinRangeFt(activeElements, sourceInstanceId, maxFt),
  ];
}

/**
 * Union of characters + companions within maxFt of any source instance.
 *
 * @param {object[]} activeElements
 * @param {string[]} sourceInstanceIds
 * @param {number} maxFt
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getAdversaryAttackTargetsWithinRangeOfAny(activeElements, sourceInstanceIds, maxFt) {
  if (!Array.isArray(sourceInstanceIds) || sourceInstanceIds.length === 0) return [];
  if (typeof maxFt !== 'number' || maxFt < 0) return [];
  const seen = new Set();
  const result = [];
  for (const id of sourceInstanceIds) {
    const inRange = getAdversaryAttackTargetsWithinRangeFt(activeElements, id, maxFt);
    for (const t of inRange) {
      if (seen.has(t.instanceId)) continue;
      seen.add(t.instanceId);
      result.push(t);
    }
  }
  return result;
}

/**
 * @param {object[]} damageTargets
 * @param {Array<{ instanceId: string }|string>} inRange
 * @returns {object[]}
 */
export function filterPartyDamageTargetsByIds(damageTargets, inRange) {
  const ids = new Set((inRange || []).map((x) => (typeof x === 'string' ? x : x?.instanceId)).filter(Boolean));
  return (damageTargets || []).filter((t) => isAdversaryAttackPartyTarget(t) && ids.has(t.instanceId));
}

/**
 * Mark 1 companion Stress on a hit (clamped to max). Updates the parent character element.
 *
 * @param {object} parentEl
 * @param {(instanceId: string, updates: object) => void} updateActiveElement
 * @returns {{ marked: number, currentStress: number }}
 */
export function markCompanionHitStress(parentEl, updateActiveElement) {
  const companion = parentEl?.companion;
  if (!companion || typeof companion !== 'object' || typeof updateActiveElement !== 'function') {
    return { marked: 0, currentStress: companion?.currentStress ?? 0 };
  }
  const max = typeof companion.maxStress === 'number' ? companion.maxStress : 3;
  const before = typeof companion.currentStress === 'number' ? companion.currentStress : 0;
  if (max <= 0 || before >= max) return { marked: 0, currentStress: before };
  const after = Math.min(before + 1, max);
  updateActiveElement(parentEl.instanceId, { companion: { ...companion, currentStress: after } });
  return { marked: after - before, currentStress: after };
}
