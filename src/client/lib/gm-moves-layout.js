/**
 * GM Moves panel layout: Encounter-panel source order, camera-view partition,
 * and which of Passives / Actions / Fear Actions gets the tall column.
 */

import { isAdversaryDefeated } from './helpers.js';
import { effectiveTokenMapId } from './map-table-state.js';
import { getTokenFootprintFt } from './token-size.js';

/**
 * Encounter panel order: all environments (activeElements order), then adversary
 * groups in first-seen `id` order. Matches the Environments-then-Adversaries
 * sections in `GMTableView`.
 *
 * @param {Array<{ elementType?: string, instanceId?: string, id?: string }>} activeElements
 * @returns {string[]}
 */
export function encounterSourceOrder(activeElements) {
  const keys = [];
  const seenAdv = new Set();
  for (const el of activeElements || []) {
    if (el.elementType === 'environment' && el.instanceId) keys.push(el.instanceId);
  }
  for (const el of activeElements || []) {
    if (el.elementType === 'adversary' && el.id && !seenAdv.has(el.id)) {
      seenAdv.add(el.id);
      keys.push(el.id);
    }
  }
  return keys;
}

/**
 * Library ids of adversary types that still have at least one living instance.
 *
 * @param {Array<{ elementType?: string, id?: string, hp_max?: number, currentHp?: number }>} activeElements
 * @returns {Set<string>}
 */
export function livingAdversaryCardKeys(activeElements) {
  const keys = new Set();
  for (const el of activeElements || []) {
    if (el.elementType === 'adversary' && el.id && !isAdversaryDefeated(el)) keys.add(el.id);
  }
  return keys;
}

/**
 * Stable sort of GM Moves rows by Encounter source order. Unknown sources stay
 * after known ones, preserving their relative order.
 *
 * @param {Array<{ cardKey?: string }>} features
 * @param {string[]} sourceOrder
 * @returns {typeof features}
 */
export function sortGmMovesBySourceOrder(features, sourceOrder) {
  const index = new Map((sourceOrder || []).map((k, i) => [k, i]));
  const fallback = sourceOrder?.length ?? 0;
  return (features || [])
    .map((f, i) => ({ f, i }))
    .sort((a, b) => {
      const ia = index.has(a.f.cardKey) ? index.get(a.f.cardKey) : fallback;
      const ib = index.has(b.f.cardKey) ? index.get(b.f.cardKey) : fallback;
      if (ia !== ib) return ia - ib;
      return a.i - b.i;
    })
    .map(({ f }) => f);
}

/**
 * Axis-aligned overlap of a token's footprint with a camera viewport in feet.
 * Unplaced tokens (`tokenX`/`tokenY` null) and other-map tokens are out of view.
 *
 * @param {{ tokenX?: number|null, tokenY?: number|null, mapId?: string|null }} el
 * @param {{ x: number, y: number, width: number, height: number, mapId?: string|null }|null|undefined} viewportFt
 * @returns {boolean}
 */
export function tokenOverlapsViewportFt(el, viewportFt) {
  if (!el || !viewportFt) return false;
  if (el.tokenX == null || el.tokenY == null) return false;
  if (!(viewportFt.width > 0) || !(viewportFt.height > 0)) return false;
  if (effectiveTokenMapId(el.mapId) !== effectiveTokenMapId(viewportFt.mapId)) return false;
  const { halfWidth, halfLength } = getTokenFootprintFt(el);
  const left = el.tokenX;
  const top = el.tokenY;
  const right = left + halfWidth * 2;
  const bottom = top + halfLength * 2;
  return (
    right > viewportFt.x
    && left < viewportFt.x + viewportFt.width
    && bottom > viewportFt.y
    && top < viewportFt.y + viewportFt.height
  );
}

/**
 * Adversary type ids (`el.id`) that have at least one living instance whose
 * token overlaps the current camera viewport.
 *
 * @param {Array<object>} activeElements
 * @param {{ x: number, y: number, width: number, height: number, mapId?: string|null }|null|undefined} viewportFt
 * @returns {Set<string>}
 */
export function inCameraAdversaryCardKeys(activeElements, viewportFt) {
  const keys = new Set();
  if (!viewportFt) return keys;
  for (const el of activeElements || []) {
    if (el.elementType !== 'adversary' || !el.id) continue;
    if (isAdversaryDefeated(el)) continue;
    if (tokenOverlapsViewportFt(el, viewportFt)) keys.add(el.id);
  }
  return keys;
}

/**
 * Split already-sorted GM Moves rows into on-camera vs off-camera adversary
 * sources. Environments and non-adversary rows stay in `inView`. When the
 * viewport is not yet known, everything stays in `inView`.
 *
 * @param {Array<{ cardKey?: string }>} features
 * @param {{ inViewAdvKeys: Set<string>, adversaryCardKeys: Set<string>, viewportKnown: boolean }} opts
 * @returns {{ inView: typeof features, offCamera: typeof features }}
 */
export function partitionGmMovesByCamera(features, { inViewAdvKeys, adversaryCardKeys, viewportKnown }) {
  const list = features || [];
  if (!viewportKnown) return { inView: [...list], offCamera: [] };
  const inView = [];
  const offCamera = [];
  const inViewAdv = inViewAdvKeys || new Set();
  const advKeys = adversaryCardKeys || new Set();
  for (const f of list) {
    if (advKeys.has(f.cardKey) && !inViewAdv.has(f.cardKey)) offCamera.push(f);
    else inView.push(f);
  }
  return { inView, offCamera };
}

/**
 * Sort by Encounter source order, then partition off-camera adversary moves.
 *
 * @param {Array<{ cardKey?: string }>} features
 * @param {{ sourceOrder: string[], inViewAdvKeys: Set<string>, adversaryCardKeys: Set<string>, viewportKnown: boolean }} opts
 */
export function arrangeGmMovesSection(features, opts) {
  const sorted = sortGmMovesBySourceOrder(features, opts.sourceOrder);
  return partitionGmMovesByCamera(sorted, opts);
}

/**
 * Which GM Moves column is tallest. Fear Actions beat Actions on ties (and when
 * both equal the max), so Fear is preferred over Actions for the left column.
 *
 * @param {number} prLen
 * @param {number} actionsLen
 * @param {number} fearLen
 * @returns {'pr'|'actions'|'fear'}
 */
export function pickTallestGmSection(prLen, actionsLen, fearLen) {
  const max = Math.max(prLen, actionsLen, fearLen);
  if (prLen === max) return 'pr';
  if (fearLen === max) return 'fear';
  return 'actions';
}
