/**
 * Auto-ack Group result banners whose parent in-memory intent is gone
 * (server restart, 409 DELETE, etc.). Tag Team leftovers are left for
 * explicit Cancel / toggle-off — sweeping a lone partner banner races
 * with initiator Proceed.
 */

import { getPendingBanners, setBannerStatus } from '../db.js';
import {
  collectLiveIntentIds,
  planOrphanedOwnedBannerSweep,
} from '../client/lib/owned-roll-banner.js';

/** @type {() => unknown} */
let getLiveIntentsByTable = () => null;

/**
 * @param {() => unknown} fn — returns the process-local pendingIntents Map
 */
export function setLivePendingIntentsGetter(fn) {
  getLiveIntentsByTable = typeof fn === 'function' ? fn : () => null;
}

/**
 * @param {object[]} pending
 * @returns {Promise<{ changed: boolean, groupAckIds: Array<number|string>, tagTeamCancelIds: Array<number|string> }>}
 */
async function applyOrphanedOwnedBannerPlan(pending) {
  const liveIntentIds = collectLiveIntentIds(getLiveIntentsByTable());
  const { groupAckIds, tagTeamCancelIds } = planOrphanedOwnedBannerSweep(pending, liveIntentIds);
  for (const id of groupAckIds) {
    await setBannerStatus(id, 'acknowledged');
  }
  for (const id of tagTeamCancelIds) {
    await setBannerStatus(id, 'cancelled');
  }
  return {
    changed: groupAckIds.length + tagTeamCancelIds.length > 0,
    groupAckIds,
    tagTeamCancelIds,
  };
}

/**
 * @param {string} appId
 * @param {string} gmUid
 * @returns {Promise<{ changed: boolean, groupAckIds: Array<number|string>, tagTeamCancelIds: Array<number|string> }>}
 */
export async function sweepOrphanedOwnedBanners(appId, gmUid) {
  if (!appId || !gmUid) {
    return { changed: false, groupAckIds: [], tagTeamCancelIds: [] };
  }
  const pending = await getPendingBanners(appId, gmUid);
  return applyOrphanedOwnedBannerPlan(pending);
}

/**
 * Banners SSE snapshot: sweep leftovers first so a reconnect after process
 * restart does not re-push undismissable orphan cards. Re-fetches only when
 * a status actually changed so subscribers still see one query on a clean table.
 *
 * @param {string} appId
 * @param {string} gmUid
 */
export async function getPendingBannersAfterSweep(appId, gmUid) {
  if (!appId || !gmUid) return [];
  const pending = await getPendingBanners(appId, gmUid);
  const { changed } = await applyOrphanedOwnedBannerPlan(pending);
  if (!changed) return pending;
  return getPendingBanners(appId, gmUid);
}
