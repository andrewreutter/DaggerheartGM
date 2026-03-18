/**
 * Origin (ancestry + community) plus weapon and armor lifecycle hooks: onMarkStress, onMarkHP, onMarkArmor.
 * Run before marking stress/HP/armor on a character; handlers can cancel the mark
 * (e.g. Firbolg Unshakable: roll d6, on 6 don't mark stress).
 */

import { originFeatures, weaponFeatures, armorFeatures } from '../../features/registry.js';
import { wrapEntity } from '../../features/entity.js';

/**
 * Get origin feature names for a character element (ancestry + community).
 * @param {object} characterEl
 * @returns {string[]}
 */
function getOriginFeatureNames(characterEl) {
  const ancestry = (characterEl.ancestryFeatures || []).map(f => f.name);
  const community = (characterEl.communityFeatures || []).map(f => f.name);
  return [...ancestry, ...community];
}

/**
 * Get weapon and armor feature names from a resolved character element.
 * @param {object} characterEl - resolved character (has weapons, armorMods)
 * @returns {{ weapon: string[], armor: string[] }}
 */
function getWeaponAndArmorFeatureNames(characterEl) {
  const weapon = (characterEl.weapons || [])
    .map(w => w.feature?.name)
    .filter(Boolean);
  const armor = characterEl.armorMods?.feature?.name ? [characterEl.armorMods.feature.name] : [];
  return { weapon, armor };
}

/**
 * Get descriptor for a feature name from any registry (origin, weapon, armor).
 * @param {string} name
 * @returns {object | undefined}
 */
function getDescriptor(name) {
  return originFeatures[name] ?? weaponFeatures[name] ?? armorFeatures[name];
}

/**
 * Run onMarkStress handlers for this character. If any returns { cancel: true }, the mark is cancelled.
 * @param {object} characterEl - raw character element
 * @param {number} amount - stress to mark
 * @param {string} source - reason (e.g. 'chip', 'damage')
 * @param {Function} updateActiveElement
 * @param {{ postRollSilent?: (text: string, displayName: string, gmUid?: string) => Promise<{ value?: number }>, gmUid?: string, postAction?: (characterEl: object, actionName: string, actionText: string) => void }} options
 * @returns {Promise<{ cancel: boolean, reduceBy?: number }>}
 */
export async function runBeforeMarkStress(characterEl, amount, source, updateActiveElement, options = {}) {
  const originNames = getOriginFeatureNames(characterEl);
  const { weapon: weaponNames, armor: armorNames } = getWeaponAndArmorFeatureNames(characterEl);
  const names = [...originNames, ...weaponNames, ...armorNames];
  const { postRollSilent, gmUid, postAction } = options;
  const character = wrapEntity(characterEl, updateActiveElement);
  const rollDice = postRollSilent
    ? async (expr) => {
        const trimmed = expr.trim();
        const rollText = trimmed.startsWith('[') ? ` ${trimmed}` : ` [${trimmed}]`;
        const res = await postRollSilent(rollText, characterEl.name ?? 'Character', gmUid ?? null);
        return { value: res?.value ?? 0 };
      }
    : () => Promise.resolve({ value: 0 });

  for (const name of names) {
    const descriptor = getDescriptor(name);
    const fn = descriptor?.onMarkStress;
    if (typeof fn !== 'function') continue;
    try {
      const ctx = {
        character,
        amount,
        source,
        rollDice,
        featureName: name,
        postAction: (actionText) => postAction?.(characterEl, name, actionText),
      };
      const result = await Promise.resolve(fn(ctx));
      if (result?.cancel) return { cancel: true };
      if (typeof result?.reduceBy === 'number' && result.reduceBy > 0) {
        const reduceBy = Math.min(result.reduceBy, amount);
        return { cancel: false, reduceBy };
      }
    } catch (err) {
      console.error(`[origin-lifecycle] ${name}.onMarkStress threw:`, err);
    }
  }
  return { cancel: false };
}

/**
 * Run onMarkHP handlers for this character. If any returns { cancel: true }, the mark is cancelled.
 * @param {object} characterEl
 * @param {number} amount - HP to mark (damage)
 * @param {string} source
 * @param {Function} updateActiveElement
 * @returns {{ cancel: boolean }}
 */
export function runBeforeMarkHP(characterEl, amount, source, updateActiveElement) {
  const originNames = getOriginFeatureNames(characterEl);
  const { weapon: weaponNames, armor: armorNames } = getWeaponAndArmorFeatureNames(characterEl);
  const names = [...originNames, ...weaponNames, ...armorNames];
  const character = wrapEntity(characterEl, updateActiveElement);
  for (const name of names) {
    const descriptor = getDescriptor(name);
    const fn = descriptor?.onMarkHP;
    if (typeof fn !== 'function') continue;
    try {
      const result = fn({ character, amount, source });
      if (result?.cancel) return { cancel: true };
    } catch (err) {
      console.error(`[origin-lifecycle] ${name}.onMarkHP threw:`, err);
    }
  }
  return { cancel: false };
}

/**
 * Run onMarkArmor handlers for this character. If any returns { cancel: true }, the mark is cancelled.
 * @param {object} characterEl
 * @param {number} amount - armor slots to mark
 * @param {string} source
 * @param {Function} updateActiveElement
 * @returns {{ cancel: boolean }}
 */
export function runBeforeMarkArmor(characterEl, amount, source, updateActiveElement) {
  const originNames = getOriginFeatureNames(characterEl);
  const { weapon: weaponNames, armor: armorNames } = getWeaponAndArmorFeatureNames(characterEl);
  const names = [...originNames, ...weaponNames, ...armorNames];
  const character = wrapEntity(characterEl, updateActiveElement);
  for (const name of names) {
    const descriptor = getDescriptor(name);
    const fn = descriptor?.onMarkArmor;
    if (typeof fn !== 'function') continue;
    try {
      const result = fn({ character, amount, source });
      if (result?.cancel) return { cancel: true };
    } catch (err) {
      console.error(`[origin-lifecycle] ${name}.onMarkArmor threw:`, err);
    }
  }
  return { cancel: false };
}
