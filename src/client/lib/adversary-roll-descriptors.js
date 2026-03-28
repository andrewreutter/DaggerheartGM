/**
 * Shared adversary feature → roll wiring for GM Moves, encounter cards, and library detail.
 * Feature-agnostic: regex/heuristics only; SRD-specific behavior lives in registry modules.
 */

import { applyDamageBoost } from './battle-points.js';

export const ATTACK_DESC_RE =
  /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
export const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;
const MAKES_ATTACK_RE = /\bmakes?\b.*?\battack\b/is;

/**
 * @param {string} [dmg]
 * @param {'d4'|'static'|null|undefined} damageBoost
 */
export function boostedAdversaryDamage(dmg, damageBoost) {
  if (!damageBoost || !dmg) return dmg;
  return applyDamageBoost(dmg, damageBoost);
}

/** Apply scene/table damage boost inside an attack line inside a feature description. */
export function boostedAdversaryAttackDescription(desc, damageBoost) {
  if (!damageBoost || !desc) return desc;
  return desc.replace(
    /^(([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*)([^\s]+)(\s+\w+)$/i,
    (_, prefix, _mod, _range, dmg, suffix) => `${prefix}${applyDamageBoost(dmg, damageBoost)}${suffix}`,
  );
}

/**
 * Build `_rollData` / `_diceRoll` for consolidated GM Moves + encounter cards (matches prior GMTableView behavior).
 *
 * @param {object} feature — feature row `{ type, description, ... }`
 * @param {object} element — adversary base `{ attack?, ... }`
 * @param {{ damageBoost?: 'd4'|'static'|null }} [opts]
 * @returns {{ _rollData: object|null, _diceRoll: object|null }}
 */
export function buildAdversaryFeatureRollParts(feature, element, opts = {}) {
  const damageBoost = opts.damageBoost ?? null;
  const description = feature?.description
    ? damageBoost
      ? boostedAdversaryAttackDescription(feature.description, damageBoost)
      : feature.description
    : '';

  const m =
    feature?.type === 'action' && description ? ATTACK_DESC_RE.exec(description) : null;
  const dicePatterns = description ? [...description.matchAll(DICE_PATTERN_RE)].map((dm) => dm[0]) : [];
  const includeAttack = MAKES_ATTACK_RE.test(description || '');

  const atk = element?.attack || {};

  const _rollData = m
    ? {
        modifier: parseInt(m[1], 10),
        range: m[2],
        damage: boostedAdversaryDamage(m[3], damageBoost),
        trait: m[4],
      }
    : null;

  const _diceRoll =
    !m && (dicePatterns.length > 0 || includeAttack)
      ? {
          patterns: dicePatterns,
          includeAttack,
          attackModifier: includeAttack ? (atk.modifier ?? 0) : null,
          attackDamage:
            includeAttack && dicePatterns.length === 0 ? boostedAdversaryDamage(atk.damage || null, damageBoost) : null,
          attackTrait: includeAttack && dicePatterns.length === 0 ? atk.trait || null : null,
          attackRange: includeAttack && dicePatterns.length === 0 ? atk.range || 'Melee' : null,
        }
      : null;

  return { _rollData, _diceRoll };
}

/**
 * Data passed to `onRollAttack` / `handleCardRoll` from feature rows (includes optional routing keys).
 * Mirrors `DetailCardGuideFeatureList` rollability: attack line, "makes an attack", or standalone dice patterns.
 *
 * @param {object} feature
 * @param {object} parentEl
 * @param {number} featureIdx
 * @param {'d4'|'static'|null|undefined} [damageBoost]
 * @returns {{ attackData: object|null, isRollable: boolean }}
 */
export function buildAdversaryCardRollAttackData(feature, parentEl, featureIdx, damageBoost = null) {
  const raw = feature?.description ?? '';

  const fKey = `feat-${featureIdx}`;
  const baseMeta = { _featureKey: fKey, _featureName: feature.name };

  // Match attack line on raw description (same as `DetailCardGuideFeatureList`); apply boost to rolled damage.
  const attackMatch = feature?.type === 'action' && raw ? ATTACK_DESC_RE.exec(raw) : null;
  const forceAttack = !attackMatch && MAKES_ATTACK_RE.test(raw || '');
  const dicePatterns =
    !attackMatch && !forceAttack && raw ? [...raw.matchAll(DICE_PATTERN_RE)].map((x) => x[0]) : [];

  const isRollable = !!(attackMatch || forceAttack || dicePatterns.length > 0);
  if (!isRollable) return { attackData: null, isRollable: false };

  if (attackMatch) {
    return {
      attackData: {
        name: feature.name,
        modifier: parseInt(attackMatch[1], 10),
        range: attackMatch[2],
        damage: boostedAdversaryDamage(attackMatch[3], damageBoost),
        trait: attackMatch[4],
        ...baseMeta,
      },
      isRollable: true,
    };
  }
  if (forceAttack) {
    const atk = parentEl?.attack || {};
    return {
      attackData: {
        name: feature.name,
        modifier: atk.modifier ?? 0,
        range: atk.range || 'Melee',
        damage: boostedAdversaryDamage(atk.damage, damageBoost),
        trait: atk.trait,
        ...baseMeta,
      },
      isRollable: true,
    };
  }
  return {
    attackData: { name: feature.name, patterns: dicePatterns, ...baseMeta },
    isRollable: true,
  };
}

/**
 * Merge adversary attacker identity into roll meta for `postRoll` / banners.
 *
 * @param {object} rollMeta — mutated in place
 * @param {{ featureKey?: string, featureName?: string }} [feature]
 */
export function applyAdversaryRollMetaBasics(rollMeta, feature) {
  rollMeta._attackerType = 'adversary';
  if (feature?.featureKey != null) rollMeta._advFeatureKey = feature.featureKey;
  if (feature?.featureName != null) rollMeta._advFeatureName = feature.featureName;
}

/**
 * Pick a single / multi attacker instance id from adversary instances (map placement preferred).
 *
 * @param {object[]} attackerInstances
 * @returns {{ _attackerInstanceId?: string, _attackerInstanceIds?: string[] }}
 */
export function pickAdversaryAttackerIds(attackerInstances) {
  if (!Array.isArray(attackerInstances) || attackerInstances.length === 0) return {};
  const onMap = attackerInstances.filter((i) => i.tokenX != null && i.tokenY != null);
  if (onMap.length === 1) return { _attackerInstanceId: onMap[0].instanceId };
  if (onMap.length > 1) return { _attackerInstanceIds: onMap.map((i) => i.instanceId) };
  if (attackerInstances.length === 1) return { _attackerInstanceId: attackerInstances[0].instanceId };
  return {};
}

/**
 * Resolve banner `attackerEl` for V2 tags / narration: PC sheet merge or adversary V2 overlay merge.
 */
export function resolveBannerAttackerElement(roll, { tableCharacters = [], adversaryDisplayByInstanceId }) {
  if (!roll?._attackerInstanceId) return null;
  const mapGet = adversaryDisplayByInstanceId && typeof adversaryDisplayByInstanceId.get === 'function'
    ? adversaryDisplayByInstanceId
    : null;
  const fromAdv = mapGet?.get(roll._attackerInstanceId) ?? null;
  const fromPc = tableCharacters.find((c) => c.instanceId === roll._attackerInstanceId) ?? null;

  if (roll._attackerType === 'adversary') return fromAdv ?? fromPc;
  if (roll._attackerType !== 'adversary' && fromPc) return fromPc;
  return fromPc ?? fromAdv;
}
