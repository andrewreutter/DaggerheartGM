/**
 * Player-only V2 **owned** card chip activation (Guide / hover sheet chips on the
 * assigned character). Recomputes engine mutations server-side and returns full
 * multi-instance `updates` — same net effect as GM `postTableOp({ op: 'update-elements' })`.
 *
 * Client players previously used `postCharacterUpdate` + `mergeUpdatesForInstance`, which
 * silently dropped ally/adversary patches (Make a Scene, Gifted Performer, Rousing Speech,
 * Warden's Protection, etc.).
 */

import { activateV2OwnedCardChip } from '../client/lib/v2-cross-sheet-lifecycle.js';
import { applyV2LifecycleMutations } from '../client/lib/table-ops.js';
import { buildV2RegistryWithSrdItems } from '../client/lib/v2-declarative-sheet.js';
import { mergeV2TableFeatureState } from '../client/lib/v2-action-loop-bridge.js';
import {
  buildNextFeatureUsageEntry,
  getFeatureUsageCycleForV2Chip,
} from '../features-v2/engine/chip-system.js';
import { loadCharacterFeatures, applyDeclarativeFeatures } from '../features-v2/engine/feature-loader.js';

/**
 * @param {object} ownerEl
 * @param {string} featureName
 * @param {{ name: string }} chip
 * @param {object[]} activeElements
 * @param {object} registry
 * @param {object} opts
 * @param {boolean} [opts.preferShapePlacement]
 */
function activateOwnedChipWithPlacementFallback(ownerEl, featureName, chip, activeElements, registry, opts) {
  const { preferShapePlacement = false, ...activateOpts } = opts || {};
  const attempts = [];

  const tryActivate = (placementShape) =>
    activateV2OwnedCardChip(ownerEl, featureName, chip, activeElements, registry, {
      ...activateOpts,
      placementShape,
    });

  if (!preferShapePlacement) {
    attempts.push(tryActivate(undefined));
    if (attempts[0].error !== 'no-matching-chip') return attempts[0];
  }

  const fearCount = activateOpts.fearCount ?? 0;
  const mapConfig = activateOpts.mapConfig ?? null;
  const merged = mergeV2TableFeatureState(activateOpts.tableFeatureState, activeElements);
  const tableBase = {
    top: { fear: fearCount, map: mapConfig },
    featureState: merged,
  };
  const base = loadCharacterFeatures(ownerEl, registry);
  const decl = applyDeclarativeFeatures(base, ownerEl, tableBase, registry);
  const feature = decl.mergedFeatures.find((f) => f.name === featureName);
  const shapes = (feature?.cards || []).map((c) => c?.shape).filter(Boolean);
  for (const shape of shapes) {
    const r = tryActivate(shape);
    if (r.error !== 'no-matching-chip') return r;
    attempts.push(r);
  }

  if (preferShapePlacement) {
    const cardAttempt = tryActivate(undefined);
    if (cardAttempt.error !== 'no-matching-chip') return cardAttempt;
    attempts.push(cardAttempt);
  }

  return attempts[attempts.length - 1] || {
    mutations: [],
    error: 'no-matching-chip',
    engineChip: null,
  };
}

/**
 * @param {{
 *   activeElements: object[],
 *   tableState: object,
 *   ownerInstanceId: string,
 *   featureName: string,
 *   chipName: string,
 *   selectOpts?: object,
 *   passedFeatureKey?: string,
 *   preferShapePlacement?: boolean,
 *   rng?: () => number,
 * }} params
 * @returns {{ ok: true, updates: { instanceId: string, updates: object }[], actionLoopNotifications: object[], sheetActionRolls: object[] } | { ok: false, status: number, error: string }}
 */
export function computePlayerV2OwnedCardChipApply(params) {
  const {
    activeElements,
    tableState,
    ownerInstanceId,
    featureName,
    chipName,
    selectOpts,
    passedFeatureKey,
    preferShapePlacement = false,
    rng,
  } = params || {};

  const feat = featureName != null ? String(featureName).trim() : '';
  const chip = chipName != null ? String(chipName).trim() : '';
  if (!ownerInstanceId || !feat || !chip) {
    return { ok: false, status: 400, error: 'ownerInstanceId, featureName, and chipName required' };
  }
  if (!Array.isArray(activeElements)) {
    return { ok: false, status: 400, error: 'activeElements required' };
  }

  const ownerEl = activeElements.find(
    (e) => e.elementType === 'character' && e.instanceId === ownerInstanceId
  );
  if (!ownerEl) {
    return { ok: false, status: 404, error: 'Character not found' };
  }

  const registry = buildV2RegistryWithSrdItems(null);
  const fearCount = tableState?.fearCount ?? 0;
  const mapConfig = tableState?.mapConfig ?? null;
  const tableFeatureState = tableState?.featureState;
  const usageStore =
    ownerEl.featureUsage && typeof ownerEl.featureUsage === 'object' ? ownerEl.featureUsage : {};

  const result = activateOwnedChipWithPlacementFallback(
    ownerEl,
    feat,
    { name: chip },
    activeElements,
    registry,
    {
      tableFeatureState,
      fearCount,
      mapConfig,
      selectOpts: selectOpts || {},
      usageStore,
      preferShapePlacement: !!preferShapePlacement,
      ...(typeof rng === 'function' ? { rng } : {}),
    }
  );

  if (result.deferToBannerAck) {
    return {
      ok: false,
      status: 400,
      error: 'defer-to-banner-ack',
      deferToBannerAck: true,
      engineChipName:
        typeof result.engineChip?.name === 'string' ? result.engineChip.name : chip,
      deferredToggleNextIsOn: result.deferredToggleNextIsOn,
    };
  }

  if (
    result.error === 'disabled' ||
    result.error === 'unaffordable' ||
    result.error === 'no-matching-chip' ||
    result.error === 'no-feature' ||
    result.error === 'needs-selection' ||
    result.error === 'bad-args'
  ) {
    return { ok: false, status: 400, error: result.error };
  }

  const { mutations, engineChip } = result;
  if (!mutations?.length) {
    return { ok: false, status: 400, error: 'No effect' };
  }

  const { updates, actionLoopNotifications, sheetActionRolls } = applyV2LifecycleMutations(
    activeElements,
    mutations,
    ownerInstanceId
  );

  const usageCycle = engineChip ? getFeatureUsageCycleForV2Chip(engineChip) : null;
  const usageKey = passedFeatureKey || feat;
  if (usageCycle && usageKey) {
    const baseline = { ...(ownerEl.featureUsage || {}) };
    const hit = updates.find((u) => u.instanceId === ownerInstanceId);
    const priorFu = { ...baseline, ...(hit?.updates?.featureUsage || {}) };
    const maxUses =
      typeof engineChip?._frequencyMaxUses === 'number' && engineChip._frequencyMaxUses >= 1
        ? engineChip._frequencyMaxUses
        : 1;
    const nextEntry = buildNextFeatureUsageEntry(priorFu[usageKey], usageCycle, maxUses);
    const mergedFu = { ...priorFu, [usageKey]: nextEntry };
    if (typeof engineChip?._chipKey === 'string' && engineChip._chipKey) {
      mergedFu[engineChip._chipKey] = nextEntry;
    }
    if (hit) {
      hit.updates = { ...hit.updates, featureUsage: mergedFu };
    } else {
      updates.push({ instanceId: ownerInstanceId, updates: { featureUsage: mergedFu } });
    }
  }

  return {
    ok: true,
    updates,
    actionLoopNotifications: actionLoopNotifications || [],
    sheetActionRolls: sheetActionRolls || [],
  };
}
