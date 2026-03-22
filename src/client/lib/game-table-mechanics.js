/**
 * Game Table — Phase 1 registry + hooks facade (Phase D).
 *
 * Table UI components import from here instead of `src/features/` so V2-only mode can
 * branch off Phase 1 registry fallbacks while keeping `wrapEntity` / `wrapRoll` in
 * {@link ./table-entity-roll.js} (no dependency on the Phase 1 IoC package path).
 */

import { isV2DeclarativeSheetEnabled } from './v2-declarative-sheet.js';
import { wrapEntity, wrapRoll, wrapBanner } from './table-entity-roll.js';
import { runHook, runCharacterHook, runPipelineHook, runCharacterPipelineHook } from '../../features/hooks.js';
import {
  weaponFeatures,
  armorFeatures,
  classFeatures,
  ancestryFeatures,
  virtualWeaponBehaviors,
  ancestryMap,
} from '../../features/registry.js';

export {
  wrapEntity,
  wrapRoll,
  wrapBanner,
  runHook,
  runCharacterHook,
  runPipelineHook,
  runCharacterPipelineHook,
  weaponFeatures,
  armorFeatures,
  classFeatures,
  ancestryFeatures,
  virtualWeaponBehaviors,
  ancestryMap,
};

/** When false, Game Table skips Phase 1 registry maps and uses `activeFeatures` / V2 paths only. */
export function shouldUsePhase1RegistryFallback() {
  return !isV2DeclarativeSheetEnabled();
}

/** DiceRoller: Phase 1 “automated” tag styling — off in V2 (V2 review chips own outcomes). */
export function getWeaponTagAutomatedForBanner(name) {
  if (!shouldUsePhase1RegistryFallback()) return false;
  return weaponFeatures[name]?.automated ?? false;
}

/** DiceRoller: conditional tag status from Phase 1 registry — off in V2. */
export function getConditionalWeaponTagStatus(tag, roll) {
  if (!shouldUsePhase1RegistryFallback()) return null;
  const feature = weaponFeatures[tag.name];
  if (feature?.bannerStatus) return feature.bannerStatus(tag, wrapRoll(roll));
  return null;
}

/** DiceRoller: interactive tag row — off in V2 (defer to V2 review / GM). */
export function getWeaponTagInteractive(name) {
  if (!shouldUsePhase1RegistryFallback()) return false;
  return weaponFeatures[name]?.interactive ?? false;
}

/**
 * Parry: prefer weapon row on `activeFeatures`, else Phase 1 registry when allowed.
 * @param {object|null|undefined} charEl
 */
export function resolveParryWeaponFeature(charEl) {
  const fromActive = charEl?.activeFeatures?.find(
    (f) => f.name === 'Parry' && typeof f.onBeforeDamageApplied === 'function'
  );
  if (fromActive) return fromActive;
  return shouldUsePhase1RegistryFallback() ? weaponFeatures.Parry : null;
}

/**
 * Resilient last-slot: prefer armor row on `activeFeatures`, else registry.
 * @param {object|null|undefined} targetEl
 */
export function resolveResilientArmorFeature(targetEl) {
  const fromActive = targetEl?.activeFeatures?.find(
    (f) => f.type === 'armor' && f.name === 'Resilient' && typeof f.onLastArmorSlot === 'function'
  );
  if (fromActive) return fromActive;
  return shouldUsePhase1RegistryFallback() ? armorFeatures.Resilient : null;
}

/**
 * Armor `modifyPreThresholdDamage` when `activeFeatures` path did not run.
 * @param {object} target
 */
export function resolveArmorModifyPreThresholdDescriptor(target) {
  const name = target.armorFeatureName;
  if (!name) return null;
  const fromActive = target.activeFeatures?.find(
    (f) => f.type === 'armor' && f.name === name && typeof f.modifyPreThresholdDamage === 'function'
  );
  if (fromActive) return fromActive;
  return shouldUsePhase1RegistryFallback() ? armorFeatures[name] : null;
}

/**
 * Weapon `onBannerAck` after damage: prefer attacker `activeFeatures` weapon row.
 * @param {object|null|undefined} attackerEl
 * @param {string} tagName
 */
export function resolveWeaponOnBannerAckDescriptor(attackerEl, tagName) {
  const fromActive = attackerEl?.activeFeatures?.find(
    (f) => f.type === 'weapon' && f.name === tagName && typeof f.onBannerAck === 'function'
  );
  if (fromActive) return fromActive;
  return shouldUsePhase1RegistryFallback() ? weaponFeatures[tagName] : null;
}
