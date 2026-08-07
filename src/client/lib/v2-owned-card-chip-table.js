/**
 * Shared Game Table path for V2 card chips (hover sheet + character panel).
 */

import { postActionNotification, postLifeSupportSelect, postTableOp, postV2OwnedCardChip } from './api.js';
import { buildActionForFeatureUse } from './feature-actions.js';
import { activateV2OwnedCardChip } from './v2-cross-sheet-lifecycle.js';
import { applyV2LifecycleMutations } from './table-ops.js';
import {
  buildNextFeatureUsageEntry,
  getFeatureUsageCycleForV2Chip,
} from '../../features-v2/engine/chip-system.js';
import { getFeatureUsageKeyForGuideFeature } from './feature-usage-key.js';
import { v2RollDieExtrasFromActionLoopPayload } from './v2-action-notification-dice.js';

export { mergeUpdatesForInstance } from './v2-merge-element-updates.js';

/**
 * Apply engine mutations from a successful {@link activateV2OwnedCardChip} result (GM
 * `postTableOp` + optional action-loop banners). Assigned players must use
 * {@link runV2OwnedCardChipTableAction} → {@link postV2OwnedCardChip} so multi-instance
 * updates are applied server-side.
 *
 * @param {(p: { rollText: string, displayName: string, rollMeta: object }) => void} [onSheetActionRoll] — one callback per **`sheetActionRoll`** mutation from feature **`onUse`** calling **`table.sheet.actionRoll`** (`src/features-v2/engine/table.js`).
 * @returns {boolean} — false if the result was an error path
 */
export function applyV2OwnedCardChipEngineResultToTable({
  result,
  featRow,
  passedFeatureKey,
  el,
  activeElementsForV2Snapshots,
  tableId,
  onActionLoopNotification,
  onSheetActionRoll,
}) {
  const { mutations, error, engineChip } = result;
  if (
    error === 'disabled' ||
    error === 'unaffordable' ||
    error === 'no-matching-chip' ||
    error === 'no-feature' ||
    error === 'needs-selection'
  ) {
    return false;
  }
  const { updates, actionLoopNotifications, sheetActionRolls } = applyV2LifecycleMutations(
    activeElementsForV2Snapshots,
    mutations,
    el.instanceId
  );
  if (Array.isArray(sheetActionRolls) && typeof onSheetActionRoll === 'function') {
    for (const p of sheetActionRolls) {
      onSheetActionRoll(p);
    }
  }
  const usageCycle = engineChip ? getFeatureUsageCycleForV2Chip(engineChip) : null;
  const usageKey = passedFeatureKey || featRow.name;
  if (usageCycle && usageKey) {
    const ownerEl = activeElementsForV2Snapshots.find((e) => e.instanceId === el.instanceId);
    const baseline = { ...(ownerEl?.featureUsage || el.featureUsage || {}) };
    const hit = updates.find((u) => u.instanceId === el.instanceId);
    const priorFu = { ...baseline, ...(hit?.updates?.featureUsage || {}) };
    const maxUses =
      typeof engineChip?._frequencyMaxUses === 'number' && engineChip._frequencyMaxUses >= 1
        ? engineChip._frequencyMaxUses
        : 1;
    const nextEntry = buildNextFeatureUsageEntry(priorFu[usageKey], usageCycle, maxUses);
    const mergedFu = { ...priorFu, [usageKey]: nextEntry };
    // Keep chip-system keys in sync so collectChips frequency gating sees the same count.
    if (typeof engineChip?._chipKey === 'string' && engineChip._chipKey) {
      mergedFu[engineChip._chipKey] = nextEntry;
    }
    if (hit) {
      hit.updates = { ...hit.updates, featureUsage: mergedFu };
    } else {
      updates.push({ instanceId: el.instanceId, updates: { featureUsage: mergedFu } });
    }
  }
  if (updates.length > 0) {
    postTableOp({ op: 'update-elements', updates }, tableId);
  }
  for (const p of actionLoopNotifications) {
    const baseDesc = p.description || '';
    const actionText =
      p.affectedSummary && String(p.affectedSummary).trim()
        ? `${baseDesc}\n${p.affectedSummary}`
        : baseDesc;
    onActionLoopNotification?.({
      _action: true,
      rollUser: p.rollUser || 'Table',
      actionName: p.title,
      actionText,
      _v2ActionLoop: true,
      _reactorInstanceId: p.instanceId,
      ...v2RollDieExtrasFromActionLoopPayload(p),
      ...(Array.isArray(p.affectedNames) && p.affectedNames.length > 0
        ? { _affectedNames: p.affectedNames, _affectedInstanceIds: p.affectedInstanceIds }
        : {}),
    });
  }
  return true;
}

/**
 * GM ack: apply deferred **toggle** chip state (`gameTableDeferUntilBannerAck` + `isToggle`) using the
 * frozen `_v2DeferToggleNext` value from the action banner.
 */
export async function applyDeferredV2ToggleOnAckFromRoll({
  roll,
  displayEl,
  el,
  activeElementsForV2Snapshots,
  v2Registry,
  tableFeatureState,
  fearCount,
  mapConfig,
  tableId,
  onActionLoopNotification,
}) {
  const normalized =
    roll._v2DeferUntilBannerAck === true && typeof roll._v2DeferToggleNext === 'boolean'
      ? roll
      : roll._wingsOfLightFlightDefer === true
        ? {
            ...roll,
            _v2DeferUntilBannerAck: true,
            _v2DeferFeatureName: 'Wings of Light',
            _v2DeferChipName: 'Flying',
            _v2DeferToggleNext: roll._wingsOfLightFlightNext === true,
          }
        : null;
  if (!normalized) return false;
  roll = normalized;
  const featName = roll._v2DeferFeatureName || roll._featureName || roll.actionName;
  const chipName = roll._v2DeferChipName;
  if (!featName || chipName == null || String(chipName) === '') return false;

  const result = activateV2OwnedCardChip(
    displayEl,
    featName,
    { name: chipName },
    activeElementsForV2Snapshots,
    v2Registry,
    {
      tableFeatureState,
      fearCount,
      mapConfig,
      selectOpts: {},
      forceApply: true,
      committedToggleIsOn: roll._v2DeferToggleNext,
    }
  );

  const featRow = { name: featName };
  const passedFeatureKey = roll._featureKey;
  return applyV2OwnedCardChipEngineResultToTable({
    result,
    featRow,
    passedFeatureKey,
    el,
    activeElementsForV2Snapshots,
    tableId,
    onActionLoopNotification,
  });
}

/**
 * @param {object} args
 * @param {object} args.featRow
 * @param {object} args.chip
 * @param {string} [args.passedFeatureKey]
 * @param {object} [args.selectOpts]
 * @param {object} args.displayEl — merged display character (recompute + V2 overlay)
 * @param {object} args.el — table character element
 * @param {object[]} args.activeElementsForV2Snapshots
 * @param {object} args.v2Registry
 * @param {object} [args.tableFeatureState]
 * @param {number} [args.fearCount]
 * @param {object|null} [args.mapConfig]
 * @param {string} [args.tableId]
 * @param {(n: object) => void} [args.onActionLoopNotification] — e.g. GMTableView handleActionNotification
 * @param {(rollText: string, displayName: string, rollMeta: object, ctx: { characterEl: object }) => void} [args.onRoll] — VTT dice; also receives **`sheetActionRoll`** payloads from **`table.sheet.actionRoll`**
 * @param {object} [args.placementShape] — same **`shape`** object reference as **`cards[].shape`** when chips use **`placements: [shape]`** (`collectChipsForShapePlacement` in `chip-system.js`)
 * @param {boolean} [args.isPlayer] — assigned player: {@link postV2OwnedCardChip} (server full `update-elements`); GM: local activate + {@link postTableOp}
 */
export async function runV2OwnedCardChipTableAction({
  featRow,
  chip,
  passedFeatureKey,
  selectOpts,
  displayEl,
  el,
  activeElementsForV2Snapshots,
  v2Registry,
  tableFeatureState,
  fearCount,
  mapConfig,
  tableId,
  onActionLoopNotification,
  onRoll,
  placementShape,
  isPlayer = false,
}) {
  if (!v2Registry || !el?.instanceId || !Array.isArray(activeElementsForV2Snapshots)) return;
  if (!featRow?.name || !chip) return;
  const usageStore =
    el?.featureUsage && typeof el.featureUsage === 'object' ? el.featureUsage : {};
  const result = activateV2OwnedCardChip(displayEl, featRow.name, chip, activeElementsForV2Snapshots, v2Registry, {
    tableFeatureState,
    fearCount,
    mapConfig,
    selectOpts,
    placementShape,
    usageStore,
  });
  if (result.deferToBannerAck) {
    const action = buildActionForFeatureUse(displayEl, featRow, null);
    const featName = featRow.name;
    const activeDesc = featRow.description || '';
    const truncDesc = activeDesc.length > 150 ? activeDesc.slice(0, 150) + '…' : activeDesc;
    const fk = passedFeatureKey || getFeatureUsageKeyForGuideFeature(el, featName) || featName;
    const engineChip = result.engineChip;
    const chipLabel =
      typeof engineChip?.name === 'string' && engineChip.name
        ? engineChip.name
        : typeof chip?.name === 'string'
          ? chip.name
          : featName;
    const isToggleDefer = result.deferredToggleNextIsOn !== undefined;
    const notification = {
      _action: true,
      rollUser: el.name,
      actionName: featName,
      actionText: isToggleDefer
        ? `${chipLabel}: ${result.deferredToggleNextIsOn ? 'turn on' : 'turn off'} (awaiting GM).`
        : truncDesc,
      tags: [
        ...(action.hopeCost > 0 ? [{ name: 'HopeCost', text: `Spend ${action.hopeCost} Hope` }] : []),
        ...(action.stressCost > 0 ? [{ name: 'StressCost', text: `Mark ${action.stressCost} Stress` }] : []),
        ...(action.armorClear > 0 ? [{ name: 'ArmorClear', text: `Clear ${action.armorClear} Armor slot` }] : []),
        ...(action.armorMark > 0 ? [{ name: 'ArmorMark', text: `Mark ${action.armorMark} Armor slot` }] : []),
      ],
      _featureUse: !isToggleDefer,
      _attackerInstanceId: el.instanceId,
      _featureName: featName,
      _subFeatureName: null,
      _hopeCost: action.hopeCost,
      _stressCost: action.stressCost,
      _armorMark: action.armorMark,
      _armorClear: action.armorClear,
      _frequency: action.frequency,
      _featureKey: fk,
      _targetType: action.targetType,
      _v2DeferUntilBannerAck: true,
      _v2DeferFeatureName: featName,
      _v2DeferChipName: chipLabel,
      ...(isToggleDefer ? { _v2DeferToggleNext: result.deferredToggleNextIsOn } : {}),
    };
    try {
      const resp = await postActionNotification(notification, tableId);
      const rid = resp?._rollDbId;
      const tid = selectOpts?.selectedTargetIds?.[0];
      if (rid != null && tid && tableId) postLifeSupportSelect(tableId, rid, tid).catch(() => {});
    } catch {
      /* best-effort */
    }
    return;
  }
  if (
    result.error === 'disabled' ||
    result.error === 'unaffordable' ||
    result.error === 'no-matching-chip' ||
    result.error === 'no-feature' ||
    result.error === 'needs-selection' ||
    result.error === 'bad-args'
  ) {
    return;
  }

  // Assigned players: server recomputes + full multi-instance update-elements (ally/adversary patches).
  if (isPlayer && tableId) {
    const chipLabel =
      typeof result.engineChip?.name === 'string' && result.engineChip.name
        ? result.engineChip.name
        : typeof chip?.name === 'string' && chip.name
          ? chip.name
          : featRow.name;
    try {
      await postV2OwnedCardChip(tableId, {
        ownerInstanceId: el.instanceId,
        featureName: featRow.name,
        chipName: chipLabel,
        selectOpts: selectOpts || {},
        passedFeatureKey,
        preferShapePlacement: !!placementShape,
      });
    } catch (err) {
      console.error(err);
    }
    return;
  }

  const onSheetActionRoll =
    typeof onRoll === 'function'
      ? (p) =>
          onRoll(p.rollText, p.displayName || featRow.name, p.rollMeta || {}, {
            characterEl: el,
          })
      : undefined;
  applyV2OwnedCardChipEngineResultToTable({
    result,
    featRow,
    passedFeatureKey,
    el,
    activeElementsForV2Snapshots,
    tableId,
    onActionLoopNotification,
    onSheetActionRoll,
  });
}
