/**
 * V2 Phase 4 — cross-sheet chips, token-move hooks, and lifecycle helpers.
 *
 * Cross-sheet chips (e.g. Bard Rally **showOnOtherSheets**) are collected with
 * `collectChipsForOtherCharacterSheets`; activation uses the same `table.me` = viewer
 * snapshot shape as collection.
 */

import { loadCharacterFeatures } from '../../features-v2/engine/feature-loader.js';
import {
  collectChipsForOtherCharacterSheets,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../features-v2/engine/table.js';
import { dispatchTokenMoveHooks } from '../../features-v2/engine/action-loop.js';
import { mergeV2TableFeatureState } from './v2-action-loop-bridge.js';

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
  const feats = loadCharacterFeatures(sourceEl, registry);
  const feature = feats.find((f) => f.name === chip._featureName);
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
  };

  const table = buildTableSnapshot(gameState);
  deductChipCosts(chip, table);
  const chipState = makeChipState();
  const mutations = activateChip(chip, table, chipState);
  return { mutations, chipState, feature };
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
    features.push(...loadCharacterFeatures(el, registry));
  }

  return dispatchTokenMoveHooks(gameState, features, { moverInstanceId });
}

export { mergeV2TableFeatureState } from './v2-action-loop-bridge.js';
