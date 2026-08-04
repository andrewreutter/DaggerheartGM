/**
 * Bridge module for the V2 "physical roll resume" primitive.
 *
 * After the GM acknowledges a banner whose rollMeta carries `_v2PhysicalRollResume`
 * (produced by `table.sheet.rollThenResume`), `runV2PhysicalRollResolvedPhase` re-hydrates
 * the engine and calls `feature.hooks.onPhysicalRollResolved(table, rollResult, resumeState)`
 * so deferred feature logic can run with the actual roll values.
 *
 * **Owner vs viewer split**: cross-sheet triggered rolls (e.g. an ally spending a Bard-granted
 * Rally Die) have two distinct instance IDs stored in `_v2PhysicalRollResume`:
 * - `featureSourceInstanceId` — the feature's natural owner (Bard); used to find the feature.
 * - `meInstanceId` — the viewer / `table.me` at trigger time (ally); `table.me` in resolve phase.
 *
 * For owned-chip and session-start cases both IDs are the same.
 */

import { buildTableSnapshot, applyMutations } from '../../features-v2/engine/table.js';
import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../features-v2/engine/feature-loader.js';
import { applyV2LifecycleMutations } from './table-ops.js';
import { mergeV2TableFeatureState } from './v2-action-loop-bridge.js';
import { extractDetailsValues } from './dice-utils.js';

/**
 * Run `hooks.onPhysicalRollResolved` for a banner roll that carries `_v2PhysicalRollResume`.
 *
 * @param {object} roll — the full roll/banner data object (top-level field `_v2PhysicalRollResume`)
 * @param {{
 *   activeElements: object[],
 *   v2Registry: object,
 *   tableFeatureState?: object,
 *   fearCount?: number,
 *   mapConfig?: object | null,
 * }} ctx
 * @returns {{ updates: object[], actionLoopNotifications: object[], sheetActionRolls: object[] } | null}
 *   Returns null when the roll is not a resume roll, the feature is gone, or there is no hook.
 */
export function runV2PhysicalRollResolvedPhase(roll, ctx) {
  const resume = roll?._v2PhysicalRollResume;
  if (!resume || typeof resume !== 'object') return null;

  const { featureName, featureSourceInstanceId, meInstanceId, resumeState } = resume;
  if (!featureName || !featureSourceInstanceId) return null;

  const { activeElements = [], v2Registry, tableFeatureState, fearCount = 0, mapConfig = null } = ctx || {};
  if (!v2Registry) return null;

  // Find the character who owns the feature definition.
  const sourceEl = activeElements.find(
    (e) => e.elementType === 'character' && e.instanceId === featureSourceInstanceId
  );
  if (!sourceEl) return null;

  // Raw `activeElements` (from the server/SSE) never carry a pre-computed `activeFeatures` array —
  // it's a client-derived field. Load + merge the feature set the same way the other V2 bridges do
  // (`activateV2CrossSheetChip` et al.) rather than reading `sourceEl.activeFeatures` directly.
  const mergedFeatureState = mergeV2TableFeatureState(tableFeatureState, activeElements);
  const tableBase = { top: { fear: fearCount, map: mapConfig }, featureState: mergedFeatureState };
  const base = loadCharacterFeatures(sourceEl, v2Registry);
  const decl = applyDeclarativeFeatures(base, sourceEl, tableBase, v2Registry);
  const feature = decl.mergedFeatures.find((f) => f.name === featureName);
  if (!feature) return null;

  // Bail if there is no resume hook to invoke.
  if (typeof feature.hooks?.onPhysicalRollResolved !== 'function') return null;

  // The "me" character is the viewer (may differ from source in cross-sheet scenarios).
  const meEl = activeElements.find(
    (e) => e.elementType === 'character' && e.instanceId === meInstanceId
  );
  if (!meEl) return null;

  // Parse individual die values and total from the roll's sub-items.
  const rollResult = parseRollResultFromBannerRoll(roll);

  // Build a fresh table snapshot with _ownerInstanceId = meInstanceId so that
  // `table.me` resolves to the viewer (ally / self), not the feature source.
  const gameState = {
    fear: fearCount,
    mapConfig,
    top: { sessionStarted: true },
    activeElements,
    featureState: mergedFeatureState,
    registry: v2Registry,
    _ownerInstanceId: meInstanceId,
    _featureKey: featureName,
    _activeFeature: feature,
  };

  const table = buildTableSnapshot(gameState);
  feature.hooks.onPhysicalRollResolved(table, rollResult, resumeState);
  const mutations = applyMutations(table);

  if (!mutations?.length) return { updates: [], actionLoopNotifications: [], sheetActionRolls: [] };

  // Use featureSourceInstanceId as the setFeatureState owner so any `table.feature.set(...)` call
  // inside the hook correctly targets the natural feature owner's element (e.g. the Bard for Rally).
  return applyV2LifecycleMutations(activeElements, mutations, featureSourceInstanceId);
}

/**
 * Parse the roll result from banner sub-items into `{ total, values, notation }`.
 * `values` contains individual die results (e.g. `[3, 4]` for `2d4`); `total` is
 * the combined sum. Falls back to `roll.total` when sub-items are absent.
 */
function parseRollResultFromBannerRoll(roll) {
  const subItems = Array.isArray(roll?.subItems) ? roll.subItems : [];
  // Ignore damage sub-items and preset carry-overs from augmented rolls.
  const mainItems = subItems.filter(
    (si) => !si._preset && !/damage/i.test(si.pre || '')
  );

  let total = 0;
  let values = [];
  let notation = '';

  for (const si of mainItems) {
    const v = parseInt(si.result, 10);
    if (!isNaN(v)) total += v;
    const dets = extractDetailsValues(si.details);
    if (dets.length > 0) values = [...values, ...dets];
    if (!notation && si.input) notation = si.input;
  }

  // Prefer the parsed total; fall back to the server-computed total for simple single-value rolls.
  if (total === 0 && typeof roll?.total === 'number') total = roll.total;

  return { total, values, notation };
}
