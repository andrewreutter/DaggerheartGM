/**
 * Server-side apply helper for persisting `setRollOutcome` and consumed review-chip keys
 * onto the pending `dice_rolls` row via `updateDiceRollData` + `notifyChange('banners')`.
 *
 * Shared by:
 *  - `POST /api/room/:tableId/v2-review-chip`  (player path)
 *  - `POST /api/room/my/banner-v2-review-meta` (GM path)
 */

import {
  buildV2ReviewChipBannerPatch,
  extractActionRollOutcomeFromDisplayMutations,
} from '../client/lib/v2-banner-review-meta.js';
import { shouldV2ReviewChipConsumeOneShot, v2BannerChipActivationKey } from '../client/lib/v2-action-loop-bridge.js';

/**
 * Persist outcome + consumed activation key for a chip activation onto a pending banner.
 *
 * @param {{
 *   appId: string,
 *   gmUid: string,
 *   rollDbId: number,
 *   rollData: object,               existing dice_rolls.data for this banner
 *   engineRollDisplayOnly: object[], from partitionV2BannerChipMutations
 *   chip: object,                   activated chip (for activation key)
 *   updateDiceRollData: function,   (appId, gmUid, id, patch) => Promise<boolean>
 *   notifyChange: function,         (channel, key) => void
 * }} opts
 * @returns {Promise<boolean>}  true when the DB was updated
 */
export async function applyBannerReviewMetaPersist({
  appId,
  gmUid,
  rollDbId,
  rollData,
  engineRollDisplayOnly,
  chip,
  updateDiceRollData,
  notifyChange,
}) {
  const outcome = extractActionRollOutcomeFromDisplayMutations(engineRollDisplayOnly);
  const consumedActivationKey = shouldV2ReviewChipConsumeOneShot(chip)
    ? v2BannerChipActivationKey(chip)
    : undefined;

  if (outcome == null && !consumedActivationKey) return false;

  const patch = buildV2ReviewChipBannerPatch(rollData, { outcome, consumedActivationKey });
  if (Object.keys(patch).length === 0) return false;

  const ok = await updateDiceRollData(appId, gmUid, rollDbId, patch);
  if (ok) notifyChange('banners', gmUid);
  return ok;
}
