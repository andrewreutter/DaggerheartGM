/**
 * GM-called reaction roll marquee: correlate pending sub-rolls with target instance ids.
 */

import { isDualityCritical, rollBeatsDefense } from './duality-roll-outcome.js';
import { isCharacterAssignedToPlayer } from './character-assignment.js';
import { TRAIT_KEYS } from './character-calc.js';

/**
 * Trait for one target on a reaction-call marquee.
 * Per-character override wins when it is a valid trait key; otherwise `_reactionTrait`.
 *
 * @param {object | null | undefined} marquee
 * @param {string} instanceId
 * @returns {string | null}
 */
export function resolveReactionCallTrait(marquee, instanceId) {
  const override = marquee?._reactionTraitByInstanceId?.[instanceId];
  if (typeof override === 'string' && TRAIT_KEYS.includes(override)) return override;
  const fallback = marquee?._reactionTrait;
  return typeof fallback === 'string' ? fallback : null;
}

/**
 * @param {object} [opts]
 * @param {string[]} [opts.targetInstanceIds]
 * @param {number | string | null} [opts.marqueeRollDbId]
 * @param {object[]} [opts.pendingBanners]
 * @param {object[]} [opts.tableCharacters]
 * @param {object | null} [opts.marquee] — pending `_reactionCall` roll (trait + optional overrides)
 * @returns {Array<{ instanceId: string, name: string, subRoll: object | null, trait: string | null }>}
 */
export function buildReactionCallRoster({
  targetInstanceIds = [],
  marqueeRollDbId,
  pendingBanners = [],
  tableCharacters = [],
  marquee = null,
} = {}) {
  const charsById = new Map(tableCharacters.map((c) => [c.instanceId, c]));
  return (targetInstanceIds || []).filter(Boolean).map((instanceId) => {
    const char = charsById.get(instanceId);
    const subRoll = (pendingBanners || []).find(
      (b) => b._reactionCallRollDbId === marqueeRollDbId && b._attackerInstanceId === instanceId,
    ) || null;
    return {
      instanceId,
      name: char?.name || 'Unknown',
      subRoll,
      trait: resolveReactionCallTrait(marquee, instanceId),
    };
  });
}

/**
 * Compact Success / Failure / Critical label for a correlated reaction sub-roll.
 * Mirrors ResultBanner difficulty math: critical always succeeds with Hope; otherwise total >= DC.
 *
 * @param {object | null} subRoll
 * @param {number | null} [fallbackDifficulty]
 * @returns {{ total: number, label: string, success: boolean } | null}
 */
export function formatReactionCallResultBadge(subRoll, fallbackDifficulty) {
  if (!subRoll || typeof subRoll.total !== 'number') return null;
  const dc = subRoll._difficulty ?? fallbackDifficulty;
  if (isDualityCritical(subRoll)) {
    return { total: subRoll.total, label: '✦ Critical!', success: true };
  }
  if (dc == null) {
    return { total: subRoll.total, label: String(subRoll.total), success: null };
  }
  const success = rollBeatsDefense(subRoll, dc, subRoll.total);
  return { total: subRoll.total, label: success ? 'Success' : 'Failure', success };
}

/**
 * GM may act for any target; a player may act only for their assigned character.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.isPlayer]
 * @param {object | null} [opts.characterEl]
 * @param {string | null} [opts.playerEmail]
 * @param {string | null} [opts.playerUid]
 * @returns {boolean}
 */
export function canViewerProceedReaction({ isPlayer, characterEl, playerEmail, playerUid } = {}) {
  if (!isPlayer) return true;
  if (!characterEl) return false;
  return isCharacterAssignedToPlayer(characterEl, { email: playerEmail, uid: playerUid });
}
