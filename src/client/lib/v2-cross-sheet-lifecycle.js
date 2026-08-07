/**
 * V2 Phase 4 — cross-sheet chips, token-move hooks, and lifecycle helpers.
 *
 * Cross-sheet chips (e.g. Bard Rally **showOnOtherSheets**) are collected with
 * `collectChipsForOtherCharacterSheets` (includes the viewer’s own qualifying features);
 * activation uses the same `table.me` = viewer snapshot shape as collection.
 */

import { applyDeclarativeFeatures, loadCharacterFeatures } from '../../features-v2/engine/feature-loader.js';
import {
  collectChips,
  collectChipsForShapePlacement,
  collectChipsForOtherCharacterSheets,
  activateChip,
  commitToggleChipToState,
  computeToggleNextIsOn,
  deductChipCosts,
  makeChipState,
  canPayChipCosts,
} from '../../features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import { dispatchTokenMoveHooks } from '../../features-v2/engine/action-loop.js';
import { mergeV2TableFeatureState } from './v2-action-loop-bridge.js';
import { inferAffectedPartiesFromV2Mutations } from './v2-mutation-affected-parties.js';

/**
 * Banner body for V2 card-chip use notifications: full registry `description` when present
 * (e.g. Cloaked), else a short "Name used Chip" line.
 *
 * @param {{ name?: string }} characterEl
 * @param {string} chipLabel
 * @param {{ description?: string, text?: string, name?: string }} feature
 */
export function ownedCardChipActionLoopDescription(characterEl, chipLabel, feature) {
  const body = String(feature?.description || feature?.text || '').trim();
  if (body) return body;
  const who = characterEl?.name || 'Character';
  return `${who} used ${chipLabel}.`;
}

/**
 * @param {{
 *   activeElements: object[],
 *   tableFeatureState?: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 * }} ctx
 */
export function buildV2CrossSheetBaseGameState(ctx) {
  const { activeElements, tableFeatureState, fearCount = 0, mapConfig = null } = ctx || {};
  return {
    fear: fearCount,
    mapConfig: mapConfig ?? null,
    activeElements: activeElements ?? [],
    featureState: mergeV2TableFeatureState(tableFeatureState, activeElements),
    rolls: undefined,
    action: {
      type: 'free',
      actorInstanceId: null,
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
  };
}

/**
 * @param {string} viewerInstanceId
 * @param {object[]} activeElements
 * @param {object} registry
 * @param {'card'|'statblock'|'create'|'intent'|'reviewAction'|'reviewOutcome'} phase
 * @param {{ tableFeatureState?: object, fearCount?: number, mapConfig?: object|null, usageStore?: object }} [opts]
 */
export function collectV2CrossSheetChips(viewerInstanceId, activeElements, registry, phase, opts = {}) {
  if (!viewerInstanceId || !Array.isArray(activeElements) || !registry) return [];
  const party = activeElements.filter((e) => e.elementType === 'character');
  const base = {
    ...buildV2CrossSheetBaseGameState({
      activeElements,
      tableFeatureState: opts.tableFeatureState,
      fearCount: opts.fearCount,
      mapConfig: opts.mapConfig,
    }),
    action: {
      type: 'free',
      actorInstanceId: viewerInstanceId,
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
  };
  return collectChipsForOtherCharacterSheets(
    viewerInstanceId,
    party,
    registry,
    phase,
    base,
    opts.usageStore ?? {}
  );
}

/**
 * Activate a cross-sheet chip (viewer’s sheet, feature owned by another PC).
 *
 * @param {{ tableFeatureState?: object, fearCount?: number, mapConfig?: object|null, usageStore?: object, rng?: () => number }} [opts] — `rng` sets `gameState._rng` for deterministic dice (tests)
 * @returns {{ mutations: object[], chipState: object, feature: object|null, error?: string }}
 */
export function activateV2CrossSheetChip(chip, viewerInstanceId, activeElements, registry, opts = {}) {
  if (!chip || !viewerInstanceId || !Array.isArray(activeElements) || !registry) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'bad-args' };
  }
  const merged = mergeV2TableFeatureState(opts.tableFeatureState, activeElements);
  const sourceId = chip._ownerInstanceId;
  const sourceEl = activeElements.find((e) => e.instanceId === sourceId);
  if (!sourceEl) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'no-source' };
  }
  const tableBase = {
    top: { fear: opts.fearCount ?? 0, map: opts.mapConfig ?? null },
    featureState: merged,
  };
  const base = loadCharacterFeatures(sourceEl, registry);
  const decl = applyDeclarativeFeatures(base, sourceEl, tableBase, registry);
  const feature = decl.mergedFeatures.find((f) => f.name === chip._featureName);
  if (!feature) {
    return { mutations: [], chipState: makeChipState(), feature: null, error: 'no-feature' };
  }

  const gameState = {
    fear: opts.fearCount ?? 0,
    mapConfig: opts.mapConfig ?? null,
    activeElements,
    featureState: merged,
    rolls: undefined,
    action: {
      type: 'free',
      actorInstanceId: viewerInstanceId,
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
    _ownerInstanceId: viewerInstanceId,
    _featureKey: feature.name,
    _activeFeature: feature,
    registry,
    ...(typeof opts.rng === 'function' ? { _rng: opts.rng } : {}),
  };

  const table = buildTableSnapshot(gameState);
  if (!canPayChipCosts(chip, table)) {
    return { mutations: [], chipState: makeChipState(), feature, error: 'unaffordable' };
  }
  deductChipCosts(chip, table);
  const chipState = makeChipState();
  const mutations = activateChip(chip, table, chipState);
  return { mutations, chipState, feature };
}

/**
 * Activate a card-phase chip on the owning character's sheet (e.g. domain cards).
 * `rawChip` must correspond to a chip returned by `collectChips` (phase **`card`**) or
 * {@link collectChipsForShapePlacement} when **`opts.placementShape`** is set (match on `name`).
 * On success, appends a synthetic **`actionLoop`** mutation when `activateChip` did not already
 * queue one via `table.me.actionLoop` (see `applyV2LifecycleMutations` + `CharacterHoverCard` action banner).
 *
 * @returns {{ mutations: object[], chipState: object, feature: object|null, engineChip?: object|null, error?: string, deferToBannerAck?: true, deferredToggleNextIsOn?: boolean }}
 */
export function activateV2OwnedCardChip(characterEl, featureName, rawChip, activeElements, registry, opts = {}) {
  if (!characterEl?.instanceId || !featureName || !rawChip || !Array.isArray(activeElements) || !registry) {
    return { mutations: [], chipState: makeChipState(), feature: null, engineChip: null, error: 'bad-args' };
  }
  const instanceId = characterEl.instanceId;
  const merged = mergeV2TableFeatureState(opts.tableFeatureState, activeElements);
  const tableBase = {
    top: { fear: opts.fearCount ?? 0, map: opts.mapConfig ?? null },
    featureState: merged,
  };
  const base = loadCharacterFeatures(characterEl, registry);
  const decl = applyDeclarativeFeatures(base, characterEl, tableBase, registry);
  const feature = decl.mergedFeatures.find((f) => f.name === featureName);
  if (!feature) {
    return { mutations: [], chipState: makeChipState(), feature: null, engineChip: null, error: 'no-feature' };
  }

  // `buildTableSnapshot` / `table.me` read declarative caps from the element
  // (`contactsEverywhereSessionUses`, `shadowStepperVeryFarUnlocked`, CONV-011 stats, …).
  // Sheet UI merges these via `mergeV2DeclarativeSheetOverlay`; the player server path
  // only has library-resolved elements, so stamp the same overlay fields onto the owner
  // before collecting/activating chips (feature-agnostic — no per-SRD branching).
  const ownerWithDeclarative = {
    ...characterEl,
    ...(decl.stats && typeof decl.stats === 'object' ? decl.stats : {}),
    contactsEverywhereSessionUses: decl.contactsEverywhereSessionUses ?? 1,
    shadowStepperVeryFarUnlocked: decl.shadowStepperVeryFarUnlocked === true,
    substituteArmorForHope: decl.substituteArmorForHope === true,
    weaponRenderHints: decl.weaponRenderHints,
    domainLoadoutDisabled: decl.domainLoadoutDisabled === true,
  };
  const activeElementsForSnap = activeElements.map((e) =>
    e.instanceId === instanceId ? { ...e, ...ownerWithDeclarative } : e
  );

  const gameState = {
    fear: opts.fearCount ?? 0,
    mapConfig: opts.mapConfig ?? null,
    activeElements: activeElementsForSnap,
    featureState: merged,
    rolls: undefined,
    action: {
      type: 'free',
      actorInstanceId: instanceId,
      targetInstanceIds: [],
      effects: [],
      appliedEffects: [],
    },
    _ownerInstanceId: instanceId,
    _featureKey: feature.name,
    _activeFeature: feature,
    registry,
  };

  const table = buildTableSnapshot(gameState);
  const usageStore = opts.usageStore ?? {};
  const collected = opts.placementShape
    ? collectChipsForShapePlacement([feature], opts.placementShape, table, usageStore)
    : collectChips([feature], 'card', table, usageStore);

  const chipName = rawChip.name;
  const engineChip =
    collected.find((c) => c.name === chipName) ||
    (chipName != null && collected.find((c) => String(c.name) === String(chipName)));

  if (!engineChip) {
    return { mutations: [], chipState: makeChipState(), feature, engineChip: null, error: 'no-matching-chip' };
  }

  if (engineChip.disabled) {
    return { mutations: [], chipState: makeChipState(), feature, engineChip: null, error: 'disabled' };
  }

  if (!canPayChipCosts(engineChip, table)) {
    return { mutations: [], chipState: makeChipState(), feature, engineChip: null, error: 'unaffordable' };
  }

  const selectOpts = opts.selectOpts ?? {};
  if (typeof engineChip.isSelect === 'function') {
    if (engineChip.multiSelect === true) {
      if (!Array.isArray(selectOpts.selectedIds) || selectOpts.selectedIds.length === 0) {
        return { mutations: [], chipState: makeChipState(), feature, engineChip: null, error: 'needs-selection' };
      }
    } else if (selectOpts.selectedId == null || selectOpts.selectedId === '') {
      return { mutations: [], chipState: makeChipState(), feature, engineChip: null, error: 'needs-selection' };
    }
  }

  if (typeof engineChip.selectTargets === 'function') {
    if (!Array.isArray(selectOpts.selectedTargetIds) || selectOpts.selectedTargetIds.length === 0) {
      return { mutations: [], chipState: makeChipState(), feature, engineChip: null, error: 'needs-selection' };
    }
  }

  /** Game Table: costs + `onUse` apply on GM banner ack (see `CharacterHoverCard` + `handleBannerAcknowledge`). */
  if (engineChip.gameTableDeferUntilBannerAck === true && !opts.forceApply) {
    return {
      mutations: [],
      chipState: makeChipState(),
      feature,
      engineChip,
      deferToBannerAck: true,
      deferredToggleNextIsOn: engineChip.isToggle ? computeToggleNextIsOn(engineChip, table) : undefined,
    };
  }

  deductChipCosts(engineChip, table);
  const chipState = makeChipState();
  let mutations;
  if (opts.forceApply && engineChip.isToggle && opts.committedToggleIsOn !== undefined) {
    mutations = commitToggleChipToState(engineChip, table, opts.committedToggleIsOn, selectOpts);
  } else {
    mutations = activateChip(engineChip, table, chipState, selectOpts);
  }
  /** Skip synthetic banner when `onUse` already queued `actionLoop`, or only **`sheetActionRoll`** (client dice). */
  const nonSynthetic = mutations.filter((m) => m?.type !== 'sheetActionRoll');
  const onlySheetRolls =
    mutations.length > 0 && mutations.every((m) => m?.type === 'sheetActionRoll');
  if (!onlySheetRolls && !nonSynthetic.some((m) => m?.type === 'actionLoop')) {
    const chipLabel =
      typeof engineChip.name === 'string' && engineChip.name ? engineChip.name : feature.name;
    const { otherPartyIds, otherPartyNames, affectedSummary } = inferAffectedPartiesFromV2Mutations(
      mutations,
      instanceId,
      activeElements
    );
    const actionLoopBody = ownedCardChipActionLoopDescription(characterEl, chipLabel, feature);
    let title = feature.name;
    if (engineChip.isToggle) {
      const isOn =
        opts.forceApply && opts.committedToggleIsOn !== undefined
          ? !!opts.committedToggleIsOn
          : chipState.isOn;
      title = `${feature.name} (${isOn ? 'On' : 'Off'})`;
    }
    mutations.push({
      type: 'actionLoop',
      payload: {
        instanceId: characterEl.instanceId,
        title,
        description: actionLoopBody,
        rollUser: characterEl.name || 'Character',
        affectedInstanceIds: otherPartyIds,
        affectedNames: otherPartyNames,
        ...(affectedSummary ? { affectedSummary } : {}),
      },
    });
  }
  return { mutations, chipState, feature, engineChip };
}

/**
 * Run `dispatchTokenMoveHooks` after a map token position commit.
 *
 * @param {{
 *   moverInstanceId: string,
 *   previousTokenFt: { tokenX: number, tokenY: number } | null,
 *   postMoveActiveElements: object[],
 *   tableFeatureState?: object,
 *   fearCount?: number,
 *   mapConfig?: object|null,
 * }} params
 * @param {object} registry — {@link import('./v2-declarative-sheet.js').buildV2RegistryWithSrdItems}
 * @returns {{ mutations: object[], narrations: string[] }}
 */
export function runV2TokenMoveHooks(params, registry) {
  const {
    moverInstanceId,
    previousTokenFt,
    postMoveActiveElements,
    tableFeatureState,
    fearCount = 0,
    mapConfig = null,
  } = params || {};

  if (!moverInstanceId || !Array.isArray(postMoveActiveElements) || !registry) {
    return { mutations: [], narrations: [] };
  }

  const featureState = mergeV2TableFeatureState(tableFeatureState, postMoveActiveElements);
  const tableBase = {
    top: { fear: fearCount ?? 0, map: mapConfig ?? null },
    featureState,
  };
  const gameState = {
    fear: fearCount,
    mapConfig,
    activeElements: postMoveActiveElements,
    featureState,
    _previousPositions: previousTokenFt
      ? { [moverInstanceId]: { tokenX: previousTokenFt.tokenX, tokenY: previousTokenFt.tokenY } }
      : {},
  };

  const features = [];
  for (const el of postMoveActiveElements) {
    if (el.elementType !== 'character') continue;
    const base = loadCharacterFeatures(el, registry);
    const decl = applyDeclarativeFeatures(base, el, tableBase, registry);
    features.push(...decl.mergedFeatures);
  }

  return dispatchTokenMoveHooks(gameState, features, { moverInstanceId });
}

export { mergeV2TableFeatureState } from './v2-action-loop-bridge.js';
