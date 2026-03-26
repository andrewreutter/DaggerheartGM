/**
 * Preview of what will refresh on rest acknowledge vs features that reset on this rest
 * but were not used (no refresh needed).
 */

import { buildChipsForFeature, getFeatureUsageCycleForV2Chip } from '../../features-v2/engine/chip-system.js';
import { unwrapTopLevelWhenChain } from '../../features-v2/engine/when.js';
import { loadV2FeaturesForCharacterElement, buildRestBannerTableForCharacter } from './v2-action-loop-bridge.js';
import { getFeatureUsageKeyForGuideFeature, getDisplayLabelForFeatureUsageKey } from './feature-usage-key.js';

/**
 * @param {'short'|'long'} restDuration
 * @returns {string[]}
 */
export function restCyclesToClear(restDuration) {
  return restDuration === 'long' ? ['rest', 'longRest'] : ['rest'];
}

/**
 * @param {object} opts
 * @param {object} opts.characterEl — raw table character element (`featureUsage`, `activeModifiers`, …)
 * @param {object} opts.mergedCharacterEl — merged overlay for V2 loading
 * @param {object[]} opts.activeElements
 * @param {object} opts.registry — V2 registry
 * @param {'short'|'long'} opts.restDuration
 * @param {number} [opts.fearCount]
 * @param {object|null} [opts.mapConfig]
 * @param {object} [opts.tableFeatureState]
 * @returns {{
 *   resetting: { usageLabels: string[], modifierLabels: string[], notes: string[] },
 *   unusedQualifiedLabels: string[],
 * }}
 */
export function computeRestBannerRefreshPreview(opts) {
  const {
    characterEl,
    mergedCharacterEl,
    activeElements,
    registry,
    restDuration,
    fearCount = 0,
    mapConfig = null,
    tableFeatureState,
  } = opts || {};

  const empty = {
    resetting: { usageLabels: [], modifierLabels: [], notes: [] },
    unusedQualifiedLabels: [],
  };

  if (!characterEl || !mergedCharacterEl?.instanceId || !registry || !Array.isArray(activeElements)) {
    return empty;
  }

  const cyclesToClear = restCyclesToClear(restDuration);
  const fu = characterEl.featureUsage || {};

  const usageLabels = [];
  for (const [key, val] of Object.entries(fu)) {
    if (val && cyclesToClear.includes(val.cycle)) {
      usageLabels.push(getDisplayLabelForFeatureUsageKey(mergedCharacterEl, key));
    }
  }
  usageLabels.sort((a, b) => a.localeCompare(b));

  const modifierLabels = [];
  for (const m of characterEl.activeModifiers || []) {
    if (m?.refreshOn && cyclesToClear.includes(m.refreshOn) && m.name) {
      modifierLabels.push(String(m.name));
    }
  }
  modifierLabels.sort((a, b) => a.localeCompare(b));

  const notes = [];
  if (cyclesToClear.includes('rest') && Array.isArray(characterEl.disadvantageSources) && characterEl.disadvantageSources.includes('Shifting')) {
    notes.push('Shifting (clears disadvantage)');
  }
  if (characterEl.featureState && typeof characterEl.featureState === 'object') {
    for (const [k, bag] of Object.entries(characterEl.featureState)) {
      if (/^consumables:/.test(k) && bag && typeof bag === 'object' && bag.restBonusActive === true) {
        notes.push('Extra downtime move (consumable bonus expires)');
        break;
      }
    }
  }
  notes.sort((a, b) => a.localeCompare(b));

  const table = buildRestBannerTableForCharacter({
    characterInstanceId: mergedCharacterEl.instanceId,
    activeElements,
    restDuration,
    fearCount,
    mapConfig,
    tableFeatureState,
  });
  const features = loadV2FeaturesForCharacterElement(mergedCharacterEl, registry, {
    fearCount,
    mapConfig,
    tableFeatureState,
  });

  const unusedQualifiedLabels = [];
  const seenUnused = new Set();

  if (table && features.length) {
    for (const feature of features) {
      const chips = buildChipsForFeature(feature);
      for (const rawChip of chips) {
        const chip = unwrapTopLevelWhenChain(rawChip, table);
        if (!chip || typeof chip !== 'object') continue;
        const cycle = getFeatureUsageCycleForV2Chip(chip);
        if (!cycle || !cyclesToClear.includes(cycle)) continue;

        const usageKey = getFeatureUsageKeyForGuideFeature(mergedCharacterEl, feature.name) || feature.name;
        const entry = fu[usageKey];
        if (entry && cyclesToClear.includes(entry.cycle)) {
          continue;
        }

        const chipName = typeof chip.name === 'function' ? chip.name(table) : chip.name;
        const label =
          chipName && String(chipName) !== String(feature.name)
            ? `${feature.name}: ${chipName}`
            : String(feature.name);
        if (seenUnused.has(label)) continue;
        seenUnused.add(label);
        unusedQualifiedLabels.push(label);
      }
    }
    unusedQualifiedLabels.sort((a, b) => a.localeCompare(b));
  }

  return {
    resetting: { usageLabels, modifierLabels, notes },
    unusedQualifiedLabels,
  };
}
