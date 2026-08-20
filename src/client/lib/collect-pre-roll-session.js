/**
 * Shared pre-roll chip + rollWrapper assembly for local open and remote hydrate.
 * Does not generate `intentId` — the caller generates on open; hydrate uses the remote id.
 */

import {
  extractOwnPoolFromRollText,
  formatOwnPoolCancelledNote,
  formatOwnPoolDieSuffix,
  resolveOwnPool,
} from './advantage-disadvantage-pool.js';
import { stripDisadvantageFromRollText } from './dice-utils.js';
import { wrapEntity } from './game-table-mechanics.js';
import { sessionNeedsDifficulty } from './action-roll-difficulty.js';
import { buildAdvantageTriggerPrerollChips } from './advantage-trigger-preroll.js';
import { collectV2WeaponIntentChips } from './v2-action-loop-bridge.js';
import { buildV2ChipViewer } from './v2-chip-session-view.js';
import { recomputeCharacter } from './character-calc.js';
import { mergeV2DeclarativeSheetOverlay } from './v2-declarative-sheet.js';

export function buildGetFeatureStateFor(updateActiveElement) {
  return (el, featureName) => {
    const get = (key, defaultVal) => {
      const bag = el._originFeatureState?.[featureName];
      return bag != null && key in bag ? bag[key] : defaultVal;
    };
    const set = (key, value) => {
      const current = el._originFeatureState ?? {};
      const featureBag = current[featureName] ?? {};
      const next = { ...current, [featureName]: { ...featureBag, [key]: value } };
      el._originFeatureState = next;
      updateActiveElement?.(el.instanceId, { _originFeatureState: next });
    };
    return { get, set };
  };
}

/**
 * @param {object} args
 * @returns {{
 *   rollWrapper: object,
 *   pending: { rollText: string, displayName: string, meta: object, rollBonus: number, rollBonusLabel: string | null },
 *   chips: object[],
 *   getFeatureStateFor: Function,
 *   needsDifficulty: boolean,
 *   characterElForIntent: object,
 * }}
 */
export function collectPreRollSession({
  rollText,
  displayName,
  rollMeta = {},
  characterEl,
  isPlayer = false,
  updateActiveElement,
  wrappedPartyCharacters = [],
  system = {},
  srdData = null,
  fearCount = 0,
  mapConfig = null,
  tableFeatureState = null,
  activeElements = [],
  user = null,
  playerEmail = null,
  previewAsPlayerEmail = null,
  resolveOriginFeatureDescriptor,
  resolveClassFeatureDescriptor,
  resolveWeaponTagDescriptor,
} = {}) {
  const meta = { ...rollMeta };
  const characterElForIntent =
    srdData && characterEl?.instanceId
      ? mergeV2DeclarativeSheetOverlay(recomputeCharacter(characterEl, srdData), characterEl, srdData, {
          fearCount,
          mapConfig,
          tableFeatureState,
        })
      : characterEl;

  const extractedPool = extractOwnPoolFromRollText(rollText, { helps: rollMeta._helpAlly });
  let textToUse = extractedPool.strippedText;
  const advantageNames = [...extractedPool.advantageNames];
  const disadvantageNames = [...extractedPool.disadvantageNames];
  for (const src of characterEl?.disadvantageSources || []) {
    if (src) disadvantageNames.push(src);
  }
  const pending = { rollText: textToUse, displayName, meta, rollBonus: 0, rollBonusLabel: null };
  const rollWrapper = {
    get rollText() { return pending.rollText; },
    set rollText(v) { pending.rollText = v; },
    get displayName() { return pending.displayName; },
    set displayName(v) { pending.displayName = v; },
    get meta() { return pending.meta; },
    get _traitKey() { return pending.meta?._traitKey; },
    isMine: true,
    isReaction: !!rollMeta._isReaction,
    addAdvantageDie(name) {
      if (name) advantageNames.push(name);
    },
    addDisadvantage(name) {
      if (name) disadvantageNames.push(name);
    },
    addDisadvantageDie(name) {
      if (name) disadvantageNames.push(name);
    },
    removeDisadvantage() {
      const fromGM = [...disadvantageNames];
      disadvantageNames.length = 0;
      const { strippedText, removedLabels } = stripDisadvantageFromRollText(pending.rollText);
      pending.rollText = strippedText;
      const allRemoved = [...fromGM, ...removedLabels];
      if (allRemoved.length > 0) {
        pending.rollText = pending.rollText.trimEnd() + ` — disadvantage removed: ${allRemoved.join(', ')}`;
      }
    },
    addRollBonus(n) {
      pending.rollBonus = (pending.rollBonus || 0) + n;
    },
    setFromText(text) {
      pending.rollText = text ?? pending.rollText;
    },
    setDisplayName(name) {
      pending.displayName = name ?? pending.displayName;
    },
    setMeta(m) {
      if (m != null) pending.meta = { ...pending.meta, ...m };
    },
    getFinalRollText() {
      const resolved = resolveOwnPool({ advantageNames, disadvantageNames });
      let t = pending.rollText;
      t += formatOwnPoolDieSuffix(resolved);
      if (pending.rollBonus) t += ` + ${pending.rollBonus}`;
      t += formatOwnPoolCancelledNote(resolved);
      return t;
    },
  };

  const getFeatureStateFor = buildGetFeatureStateFor(updateActiveElement);
  const canvas = { chips: [] };
  canvas.isUsed = (featureKey) => !!(characterEl?.featureUsage?.[featureKey]?.used);
  canvas.addChip = (descriptor) => {
    const featureName = descriptor._featureName;
    const merged = { ...descriptor, _featureName: featureName };
    const hadCustomIsVisible = typeof descriptor.isVisible === 'function';
    if (merged.resetsOn) {
      if (featureName) {
        const originList = [...(characterEl.ancestryFeatures || []), ...(characterEl.communityFeatures || [])];
        merged._featureKey = `${featureName}-${Math.max(0, originList.findIndex((f) => f.name === featureName))}`;
      } else {
        merged._featureKey = null;
      }
      if (!hadCustomIsVisible) {
        merged.isVisible = (r) => r.isMine && merged._featureKey != null && !canvas.isUsed(merged._featureKey);
      }
      merged._used = !!(merged._featureKey && canvas.isUsed(merged._featureKey));
    }
    const featureReader = {
      get(key, d) {
        const bag = characterEl._originFeatureState?.[featureName];
        return bag != null && key in bag ? bag[key] : d;
      },
    };
    const baseDescriptor = featureName && resolveOriginFeatureDescriptor
      ? resolveOriginFeatureDescriptor(characterEl, featureName)
      : null;
    const featureWithState = baseDescriptor
      ? { ...baseDescriptor, ...getFeatureStateFor(characterEl, featureName) }
      : (featureName ? getFeatureStateFor(characterEl, featureName) : { get: () => undefined, set: () => {} });
    const character = wrapEntity(characterEl, updateActiveElement);
    const canvasContext = { roll: rollWrapper, character, characters: wrappedPartyCharacters, system, feature: featureWithState };
    const isVisibleResult = typeof merged.isVisible === 'function'
      ? (merged.isVisible.length === 1 ? merged.isVisible(canvasContext) : merged.isVisible(rollWrapper, featureReader, canvasContext))
      : true;
    const count = typeof isVisibleResult === 'number' && isVisibleResult > 0
      ? Math.floor(isVisibleResult)
      : (isVisibleResult ? 1 : 0);
    if (count === 0 && typeof merged.isVisible === 'function' && hadCustomIsVisible) return;
    for (let i = 0; i < count; i++) canvas.chips.push({ ...merged });
  };

  if (Array.isArray(characterElForIntent?.activeFeatures) && characterElForIntent.activeFeatures.length > 0) {
    for (const feature of characterElForIntent.activeFeatures) {
      const prerollChips = feature.chips?.filter((c) => c.placement === 'preroll') || [];
      for (const c of prerollChips) {
        canvas.addChip({ ...c, _featureName: feature.name });
      }
    }
  } else if (characterElForIntent) {
    const featureNames = [
      ...(characterElForIntent.ancestryFeatures || []).map((f) => f.name),
      ...(characterElForIntent.communityFeatures || []).map((f) => f.name),
    ];
    for (const name of featureNames) {
      const descriptor = resolveOriginFeatureDescriptor?.(characterElForIntent, name);
      const prerollChips = descriptor?.chips?.filter((c) => c.placement === 'preroll') || [];
      for (const c of prerollChips) {
        canvas.addChip({ ...c, _featureName: name });
      }
    }
  }

  if (characterElForIntent) {
    for (const advChip of buildAdvantageTriggerPrerollChips(characterElForIntent, {
      resolveOriginFeatureDescriptor,
      resolveClassFeatureDescriptor,
      resolveWeaponTagDescriptor,
    })) {
      canvas.addChip(advChip);
    }
  }

  if (srdData && meta._intentPanelForActionRoll === true && characterElForIntent) {
    const tableChars = (activeElements || []).filter((e) => e.elementType === 'character');
    const { viewer } = buildV2ChipViewer({
      isPlayer,
      user,
      playerEmail,
      previewAsPlayerEmail,
      tableCharacters: tableChars,
    });
    const v2WeaponIntent = collectV2WeaponIntentChips({
      pendingMeta: meta,
      pendingRollText: textToUse,
      characterEl: characterElForIntent,
      activeElements,
      srdData,
      fearCount,
      mapConfig,
      tableFeatureState,
      viewer,
    });
    for (const c of v2WeaponIntent) {
      canvas.chips.push(c);
    }
  }

  return {
    rollWrapper,
    pending,
    chips: canvas.chips,
    getFeatureStateFor,
    needsDifficulty: sessionNeedsDifficulty(meta),
    characterElForIntent,
  };
}
