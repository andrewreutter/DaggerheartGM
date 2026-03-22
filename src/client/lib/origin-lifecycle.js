/**
 * Origin (ancestry + community) plus weapon and armor lifecycle hooks: onMarkStress, onMarkHP, onMarkArmor.
 * Run before marking stress/HP/armor on a character; handlers can cancel the mark
 * (e.g. Firbolg Unshakable: roll d6, on 6 don't mark stress).
 *
 * Uses characterEl.activeFeatures (from character-calc) and calls each feature's hook directly.
 * Context passed to hooks: character, amount, markSource (reason string), source (contributing item), etc.
 */

import { wrapEntity } from './table-entity-roll.js';

/**
 * Run onMarkStress handlers for this character. If any returns { cancel: true }, the mark is cancelled.
 * @param {object} characterEl - raw character element (must have activeFeatures from recomputeCharacter)
 * @param {number} amount - stress to mark
 * @param {string} source - reason (e.g. 'chip', 'damage')
 * @param {Function} updateActiveElement
 * @param {{ postRollSilent?: (text: string, displayName: string, gmUid?: string) => Promise<{ value?: number }>, gmUid?: string, postAction?: (characterEl: object, actionName: string, actionText: string) => void }} options
 * @returns {Promise<{ cancel: boolean, reduceBy?: number }>}
 */
export async function runBeforeMarkStress(characterEl, amount, source, updateActiveElement, options = {}) {
  const activeFeatures = characterEl.activeFeatures;
  if (!Array.isArray(activeFeatures) || activeFeatures.length === 0) return { cancel: false };

  const { postRollSilent, gmUid, postAction, system } = options;
  const character = wrapEntity(characterEl, updateActiveElement);
  const rollDice = postRollSilent
    ? async (expr) => {
        const trimmed = expr.trim();
        const rollText = trimmed.startsWith('[') ? ` ${trimmed}` : ` [${trimmed}]`;
        const res = await postRollSilent(rollText, characterEl.name ?? 'Character', gmUid ?? null);
        return { value: res?.value ?? 0 };
      }
    : () => Promise.resolve({ value: 0 });

  for (const feature of activeFeatures) {
    const fn = feature.onMarkStress;
    if (typeof fn !== 'function') continue;
    try {
      const ctx = {
        character,
        amount,
        markSource: source,
        source: feature.source,
        feature,
        rollDice,
        featureName: feature.name,
        postAction: (actionText) => postAction?.(characterEl, feature.name, actionText),
        ...(options?.characters != null && { characters: options.characters }),
        ...(options?.system != null && { system: options.system }),
      };
      const result = await Promise.resolve(fn(ctx));
      if (result?.cancel) return { cancel: true };
      if (typeof result?.reduceBy === 'number' && result.reduceBy > 0) {
        const reduceBy = Math.min(result.reduceBy, amount);
        return { cancel: false, reduceBy };
      }
    } catch (err) {
      console.error(`[origin-lifecycle] ${feature.name}.onMarkStress threw:`, err);
    }
  }
  return { cancel: false };
}

/**
 * Run onMarkHP handlers for this character. If any returns { cancel: true }, the mark is cancelled.
 * @param {object} characterEl - must have activeFeatures
 * @param {number} amount - HP to mark (damage)
 * @param {string} source - reason string
 * @param {Function} updateActiveElement
 * @param {{ characters?: object[] }} [options] - optional; characters = wrapped party array for hook context
 * @returns {{ cancel: boolean }}
 */
export function runBeforeMarkHP(characterEl, amount, source, updateActiveElement, options = {}) {
  const activeFeatures = characterEl.activeFeatures;
  if (!Array.isArray(activeFeatures) || activeFeatures.length === 0) return { cancel: false };

  const character = wrapEntity(characterEl, updateActiveElement);
  for (const feature of activeFeatures) {
    const fn = feature.onMarkHP;
    if (typeof fn !== 'function') continue;
    try {
      const ctx = { character, amount, markSource: source, source: feature.source, feature };
      if (options.characters != null) ctx.characters = options.characters;
      if (options.system != null) ctx.system = options.system;
      const result = fn(ctx);
      if (result?.cancel) return { cancel: true };
    } catch (err) {
      console.error(`[origin-lifecycle] ${feature.name}.onMarkHP threw:`, err);
    }
  }
  return { cancel: false };
}

/**
 * Run onMarkArmor handlers for this character. If any returns { cancel: true }, the mark is cancelled.
 * @param {object} characterEl - must have activeFeatures
 * @param {number} amount - armor slots to mark
 * @param {string} source - reason string
 * @param {Function} updateActiveElement
 * @param {{ characters?: object[] }} [options] - optional; characters = wrapped party array for hook context
 * @returns {{ cancel: boolean }}
 */
export function runBeforeMarkArmor(characterEl, amount, source, updateActiveElement, options = {}) {
  const activeFeatures = characterEl.activeFeatures;
  if (!Array.isArray(activeFeatures) || activeFeatures.length === 0) return { cancel: false };

  const character = wrapEntity(characterEl, updateActiveElement);
  for (const feature of activeFeatures) {
    const fn = feature.onMarkArmor;
    if (typeof fn !== 'function') continue;
    try {
      const ctx = { character, amount, markSource: source, source: feature.source, feature };
      if (options.characters != null) ctx.characters = options.characters;
      if (options.system != null) ctx.system = options.system;
      const result = fn(ctx);
      if (result?.cancel) return { cancel: true };
    } catch (err) {
      console.error(`[origin-lifecycle] ${feature.name}.onMarkArmor threw:`, err);
    }
  }
  return { cancel: false };
}
