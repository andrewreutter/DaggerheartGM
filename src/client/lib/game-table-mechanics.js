/**
 * Game Table facade: `wrapEntity` / `wrapRoll` / weapon-armor tag helpers that read
 * merged `activeFeatures` from character-calc + V2 only (no Phase 1 registry).
 */

import { wrapEntity, wrapRoll, wrapBanner } from './table-entity-roll.js';
import { runCharacterHook } from './feature-hook-dispatch.js';

export {
  wrapEntity,
  wrapRoll,
  wrapBanner,
  runCharacterHook,
};

/**
 * @param {string} tagName
 * @param {object|null|undefined} attackerEl
 * @returns {object|null}
 */
export function resolveWeaponTagDescriptor(tagName, attackerEl) {
  if (!tagName) return null;
  return (
    attackerEl?.activeFeatures?.find((f) => f.type === 'weapon' && f.name === tagName) ?? null
  );
}

export function getWeaponTagAutomatedForBanner(name, attackerEl) {
  const d = resolveWeaponTagDescriptor(name, attackerEl);
  if (d) return d.automated === true;
  return false;
}

/**
 * Automated-style narration lines for weapon tags on a roll banner (merged activeFeatures rows).
 * @param {string[]} tagNames Names from roll.tags (weapon property names on the attack).
 * @param {object|null|undefined} attackerEl Character element with activeFeatures.
 * @returns {{ text: string, style: 'automated' }[]}
 */
export function buildWeaponTagBannerNarrationParts(tagNames, attackerEl) {
  const parts = [];
  if (!attackerEl?.activeFeatures?.length || !tagNames?.length) return parts;
  for (const name of tagNames) {
    const f = attackerEl.activeFeatures.find(
      (row) => row.type === 'weapon' && row.name === name
    );
    if (!f || f.automated !== true || !f.description) continue;
    parts.push({ text: f.description, style: 'automated' });
  }
  return parts;
}

/**
 * Narration lines shown on a pending dice banner before ancestry chip narrations are merged:
 * optional `roll._narration`, then automated weapon-tag descriptions from merged `activeFeatures`.
 * @param {object} roll
 * @param {object|null|undefined} attackerEl — character element for PC attacks (`roll._attackerInstanceId`)
 * @returns {{ text: string, style?: string }[]}
 */
export function buildRollBaseBannerNarrationParts(roll, attackerEl) {
  const parts = [];
  if (roll?._narration) parts.push({ text: roll._narration });
  const tagNames = (roll?.tags || [])
    .map((t) => (typeof t === 'string' ? t : t?.name))
    .filter(Boolean);
  parts.push(...buildWeaponTagBannerNarrationParts(tagNames, attackerEl));
  return parts.filter((p) => p?.text);
}

export function getConditionalWeaponTagStatus(tag, roll, attackerEl) {
  const d = resolveWeaponTagDescriptor(tag.name, attackerEl);
  if (d?.bannerStatus) return d.bannerStatus(tag, wrapRoll(roll));
  return null;
}

export function getWeaponTagInteractive(name, attackerEl) {
  const d = resolveWeaponTagDescriptor(name, attackerEl);
  if (d) return d.interactive === true;
  return false;
}

export function resolveParryWeaponFeature(charEl) {
  return (
    charEl?.activeFeatures?.find(
      (f) => f.name === 'Parry' && typeof f.onBeforeDamageApplied === 'function'
    ) ?? null
  );
}

export function resolveResilientArmorFeature(targetEl) {
  return (
    targetEl?.activeFeatures?.find(
      (f) => f.type === 'armor' && f.name === 'Resilient' && typeof f.onLastArmorSlot === 'function'
    ) ?? null
  );
}

export function resolveArmorModifyPreThresholdDescriptor(target) {
  const name = target.armorFeatureName;
  if (!name) return null;
  return (
    target.activeFeatures?.find(
      (f) => f.type === 'armor' && f.name === name && typeof f.modifyPreThresholdDamage === 'function'
    ) ?? null
  );
}

export function resolveWeaponOnBannerAckDescriptor(attackerEl, tagName) {
  return (
    attackerEl?.activeFeatures?.find(
      (f) =>
        f.type === 'weapon' &&
        f.name === tagName &&
        typeof f.onBannerAck === 'function'
    ) ?? null
  );
}

export function resolveOriginFeatureDescriptor(characterEl, featureName) {
  if (!featureName) return null;
  return (
    characterEl?.activeFeatures?.find(
      (f) => f.name === featureName && (f.type === 'ancestry' || f.type === 'community')
    ) ?? null
  );
}

export function resolveClassFeatureDescriptor(characterEl, featureName) {
  if (!featureName) return null;
  return (
    characterEl?.activeFeatures?.find(
      (f) => f.name === featureName && (f.type === 'class' || f.type === 'subclass')
    ) ?? null
  );
}

/** Domain card row from merged `activeFeatures` (V2 ability registry + `type: 'ability'`). */
export function resolveAbilityDescriptor(characterEl, featureName) {
  if (!featureName) return null;
  return (
    characterEl?.activeFeatures?.find(
      (f) => f.name === featureName && f.type === 'ability'
    ) ?? null
  );
}

export function resolveVirtualWeaponBehavior(featureName, attackerEl) {
  if (!featureName) return null;
  const row = attackerEl?.activeFeatures?.find((f) => f.name === featureName);
  if (
    row?.virtualWeapon &&
    (row.virtualWeapon.onAcknowledge ||
      row.virtualWeapon.stressCost != null ||
      row.virtualWeapon.hopeCost != null)
  ) {
    return {
      onAcknowledge: row.virtualWeapon.onAcknowledge,
      stressCost: row.virtualWeapon.stressCost,
      hopeCost: row.virtualWeapon.hopeCost,
    };
  }
  if (Array.isArray(row?.virtualWeapons)) {
    for (const vw of row.virtualWeapons) {
      if (vw && (vw.onAcknowledge || vw.stressCost != null || vw.hopeCost != null)) {
        return {
          onAcknowledge: vw.onAcknowledge,
          stressCost: vw.stressCost,
          hopeCost: vw.hopeCost,
        };
      }
    }
  }
  return null;
}
