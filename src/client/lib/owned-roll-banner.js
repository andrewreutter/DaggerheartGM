/**
 * Result banners owned by a parent session (GM-called reaction, Group roll
 * collaborator, Tag Team pending choice). Apply/Cancel stay hidden only while
 * that parent is still live; leftovers must be dismissable or swept.
 */

import { isTagTeamPendingChoice } from './tag-team.js';

/**
 * @param {unknown} roll
 * @returns {boolean}
 */
export function isParentOwnedResultBanner(roll) {
  if (!roll || typeof roll !== 'object') return false;
  if (roll._reactionCallRollDbId != null) return true;
  if (roll._groupRollIntentId != null && roll._groupRollIntentId !== '') return true;
  return isTagTeamPendingChoice(roll);
}

/**
 * @param {unknown} intentsByTable — Map, array, or object of intent snapshots
 * @returns {string[]}
 */
export function collectLiveIntentIds(intentsByTable) {
  const values = intentsByTable instanceof Map
    ? [...intentsByTable.values()]
    : Array.isArray(intentsByTable)
      ? intentsByTable
      : Object.values(intentsByTable || {});
  const ids = [];
  for (const intent of values) {
    if (intent?.intentId != null && intent.intentId !== '') ids.push(String(intent.intentId));
  }
  return ids;
}

/**
 * @param {unknown} pending
 * @param {unknown} field
 * @param {unknown} intentId
 * @returns {Array<number|string>}
 */
export function collectBannerIdsByIntentField(pending, field, intentId) {
  if (intentId == null || intentId === '' || !field) return [];
  const key = String(intentId);
  return (Array.isArray(pending) ? pending : [])
    .filter((b) => b?.[field] != null && String(b[field]) === key && b._rollDbId != null)
    .map((b) => b._rollDbId);
}

/**
 * @param {unknown} pending
 * @param {unknown} marqueeId
 * @returns {Array<number|string>}
 */
export function collectReactionCallChildBannerIds(pending, marqueeId) {
  if (marqueeId == null || marqueeId === '') return [];
  const parent = Number(marqueeId);
  return (Array.isArray(pending) ? pending : [])
    .filter((b) => (
      b?._reactionCallRollDbId != null
      && Number(b._reactionCallRollDbId) === parent
      && b._rollDbId != null
    ))
    .map((b) => b._rollDbId);
}

/**
 * @param {object | null | undefined} roll
 * @param {{
 *   pendingBanners?: object[],
 *   liveIntentIds?: unknown[],
 * }} [ctx]
 * @returns {boolean}
 */
export function isOwnedBannerParentLive(roll, {
  pendingBanners = [],
  liveIntentIds = [],
} = {}) {
  if (!roll || typeof roll !== 'object') return false;
  const live = new Set((Array.isArray(liveIntentIds) ? liveIntentIds : []).map(String));
  if (roll._groupRollIntentId != null && roll._groupRollIntentId !== '') {
    return live.has(String(roll._groupRollIntentId));
  }
  if (isTagTeamPendingChoice(roll)) {
    if (live.has(String(roll._tagTeamIntentId))) return true;
    const peers = (Array.isArray(pendingBanners) ? pendingBanners : []).filter((b) => (
      b?._tagTeamIntentId != null
      && String(b._tagTeamIntentId) === String(roll._tagTeamIntentId)
    ));
    return peers.length >= 2;
  }
  if (roll._reactionCallRollDbId != null) {
    const parent = Number(roll._reactionCallRollDbId);
    return (Array.isArray(pendingBanners) ? pendingBanners : []).some((b) => (
      b?._reactionCall === true && Number(b._rollDbId) === parent
    ));
  }
  return false;
}

/**
 * Hide Apply/Cancel only while the parent session is still live.
 * @param {object | null | undefined} roll
 * @param {{ pendingBanners?: object[], liveIntentIds?: unknown[] }} [ctx]
 * @returns {boolean}
 */
export function shouldHideOwnedBannerDismiss(roll, ctx = {}) {
  return isParentOwnedResultBanner(roll) && isOwnedBannerParentLive(roll, ctx);
}

/**
 * @param {object | null | undefined} roll
 * @param {{ pendingBanners?: object[], liveIntentIds?: unknown[] }} [ctx]
 * @returns {boolean}
 */
export function isOrphanedOwnedBanner(roll, ctx = {}) {
  return isParentOwnedResultBanner(roll) && !isOwnedBannerParentLive(roll, ctx);
}

/**
 * Group leftovers → acknowledge (same as DELETE /intent leftover helper).
 * Incomplete Tag Team leftovers (no live intent, fewer than two banners) → cancel.
 * A Tag Team pair after Proceed is kept even though the intent is gone.
 *
 * @param {object[]} pending
 * @param {unknown[]} liveIntentIds
 * @returns {{ groupAckIds: Array<number|string>, tagTeamCancelIds: Array<number|string> }}
 */
export function planOrphanedOwnedBannerSweep(pending, liveIntentIds = []) {
  const live = new Set((Array.isArray(liveIntentIds) ? liveIntentIds : []).map(String));
  const list = Array.isArray(pending) ? pending : [];
  const tagTeamCounts = new Map();
  for (const b of list) {
    if (b?._tagTeamIntentId == null || b._tagTeamIntentId === '') continue;
    const key = String(b._tagTeamIntentId);
    tagTeamCounts.set(key, (tagTeamCounts.get(key) || 0) + 1);
  }
  const groupAckIds = [];
  const tagTeamCancelIds = [];
  for (const b of list) {
    if (b?._rollDbId == null) continue;
    if (b._groupRollIntentId != null && b._groupRollIntentId !== '' && !live.has(String(b._groupRollIntentId))) {
      groupAckIds.push(b._rollDbId);
      continue;
    }
    if (
      b._tagTeamIntentId != null
      && b._tagTeamIntentId !== ''
      && b._tagTeamChosen !== true
      && !live.has(String(b._tagTeamIntentId))
      && (tagTeamCounts.get(String(b._tagTeamIntentId)) || 0) < 2
    ) {
      tagTeamCancelIds.push(b._rollDbId);
    }
  }
  return { groupAckIds, tagTeamCancelIds };
}
