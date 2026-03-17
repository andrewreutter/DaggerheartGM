/**
 * Roll Wrapper — wraps a raw roll object with utility methods so feature
 * hooks have a clean API instead of inline regex + array searches.
 *
 * wrapRoll(roll) is called when building hook contexts (GMTableView) and
 * before dispatching bannerStatus (DiceRoller).
 */
import { extractDetailsValues } from '../client/lib/dice-utils.js';

const TRAIT_NAMES = {
  agility: 'Agility',
  strength: 'Strength',
  finesse: 'Finesse',
  instinct: 'Instinct',
  presence: 'Presence',
  knowledge: 'Knowledge',
};

function wrapSubItem(sub) {
  return {
    ...sub,
    /** All individual die values from this sub-item's details. */
    values() {
      return extractDetailsValues(sub.details);
    },
    /** True if any die in this sub-item rolled the given value. */
    hasValue(n) {
      return extractDetailsValues(sub.details).some(v => v === n);
    },
  };
}

/**
 * Wrap a raw server roll object with utility methods.
 * Pass into hook contexts so feature modules have a clean API.
 *
 * @param {object|null} roll
 * @param {object} [displayStore] — Optional mutable store keyed by roll._rollDbId for display-only
 *   overrides (e.g. from chip.render in onBanner). When present, adds setWithHope() / setDominantForDisplay().
 * @param {string} [characterInstanceId] — When provided (e.g. ancestry chip context), attacker.isMe and target.isMe
 *   are set true when that entity is the character that owns the feature.
 * @returns {object|null} wrapped roll, or null if roll is falsy
 */
export function wrapRoll(roll, displayStore, characterInstanceId) {
  if (!roll) return null;
  const isAttackerMe = characterInstanceId != null && roll._attackerInstanceId === characterInstanceId;
  const isTargetMe = characterInstanceId != null && roll._selectedTargetInstanceId === characterInstanceId;
  const base = {
    ...roll,

    /** True when this is a Fear roll. */
    get isWithFear() { return roll.dominant === 'fear'; },
    /** True when this is a Hope or Critical roll. */
    get isWithHope() { return roll.dominant === 'hope' || roll.dominant === 'critical'; },
    /** True when this roll was initiated by the character in context. Set by system before match/render/ack. */
    isMine: false,
    /** True when the roll used Daggerheart duality dice (dominant is set). */
    get hasDuality() { return roll.dominant != null; },
    /** True when the roll has a damage sub-item. */
    get hasDamage() {
      return (roll.subItems || []).some(s => /damage/i.test(s.pre || ''));
    },
    /** True when the attack hit the selected target (total >= evasion/difficulty). Set by enricher. */
    get isSuccess() { return roll.isSuccess ?? false; },
    /** Range band name from attacker to selected target (e.g. 'Melee'). Set by enricher. */
    get attackRange() { return roll.attackRange ?? null; },

    /**
     * Attacker info derived from the roll metadata.
     * `id`   — instanceId of the attacking character/adversary, or null.
     * `name` — display name from rollUser, or null.
     * `isMe` — true when this entity is the character that owns the feature (only set when characterInstanceId passed).
     */
    attacker: {
      id:   roll._attackerInstanceId ?? null,
      name: roll.rollUser ?? null,
      isMe: isAttackerMe,
    },

    /**
     * Selected damage target info (when a target is selected).
     * `id`   — instanceId of the selected target, or null.
     * `name` — display name of the target (set by enricher when available).
     * `isMe` — true when this entity is the character that owns the feature (only set when characterInstanceId passed).
     */
    target: {
      id:   roll._selectedTargetInstanceId ?? null,
      name: roll._selectedTargetName ?? null,
      isMe: isTargetMe,
    },

    /**
     * Trait used for this roll (when applicable).
     * `name` — display name (e.g. "Agility"). Set when roll has _traitKey.
     */
    get trait() {
      if (roll._traitKey == null) return undefined;
      const name = TRAIT_NAMES[roll._traitKey] ?? roll._traitKey;
      return { name };
    },

    /**
     * Find a sub-item whose `pre` label matches pattern (string → case-insensitive
     * regex, RegExp → used as-is). Returns a wrapped sub-item with .values() and
     * .hasValue() helpers, or null if not found.
     */
    sub(pattern) {
      const re = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
      const found = (roll.subItems || []).find(s => re.test(s.pre || ''));
      return found ? wrapSubItem(found) : null;
    },

    /**
     * Request a replacement banner that rerolls only the given duality die (Hope or Fear).
     * Like addDamage: cancels the current banner and creates a new one with all other values
     * preset and only the specified die rerolled; ancestry chips are shown except the one that
     * triggered the reroll. Call from onChipAck; the client will see roll._rerollDie and call
     * the banner-reroll-die API.
     * @param {'Hope'|'Fear'} dieType
     */
    reroll(dieType) {
      if (dieType === 'Hope' || dieType === 'Fear') roll._rerollDie = dieType;
    },

    /**
     * Reduce HP loss applied when this roll is acknowledged (e.g. Dwarf Thick Skin).
     * Call from onChipAck; the value is subtracted from hpLoss after threshold comparison
     * when the banner is acknowledged.
     * @param {number} n — amount to subtract from hpLoss (clamped so hpLoss does not go below 0)
     */
    reduceHPLoss(n) {
      if (typeof n === 'number' && n > 0) {
        roll._hpLossReduction = (roll._hpLossReduction || 0) + n;
      }
    },

    /**
     * Override the damage total used for threshold comparison and damage application (e.g. Dwarf Increased Fortitude).
     * Call from onChipAck; the value is rounded up to the nearest integer and stored on the roll.
     * When the banner is acknowledged, this total is used instead of the rolled damage when computing
     * hpLoss and applying damage.
     * @param {number} n — new damage total (rounded up; non‑numeric or negative stored as 0)
     */
    setDamageTotal(n) {
      const v = Number(n);
      roll._damageTotalOverride = (Number.isNaN(v) || v < 0) ? 0 : Math.ceil(v);
    },
  };

  if (displayStore && roll._rollDbId != null) {
    base.setWithHope = function setWithHope() {
      displayStore[roll._rollDbId] = { ...(displayStore[roll._rollDbId] || {}), dominantForDisplay: 'hope' };
    };
    base.setDominantForDisplay = function setDominantForDisplay(dominant) {
      displayStore[roll._rollDbId] = { ...(displayStore[roll._rollDbId] || {}), dominantForDisplay: dominant };
    };
  }

  return base;
}
