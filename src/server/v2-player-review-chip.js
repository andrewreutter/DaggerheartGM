/**
 * Player V2 **review** banner chips — same engine path as GM `handleV2ReviewChip`, recomputed server-side.
 */

import {
  collectV2ReviewActionChips,
  activateV2ReviewChip,
  v2BannerChipActivationKey,
} from '../client/lib/v2-action-loop-bridge.js';
import { partitionV2BannerChipMutations, applyV2BannerMutations } from '../client/lib/table-ops.js';

export { loadSrdDataForV2Engine } from './load-srd-engine-data.js';

/**
 * @param {{
 *   activeElements: object[],
 *   tableState: object,
 *   viewerInstanceId: string,
 *   roll: object,
 *   activationKey: string,
 *   selectOpts?: object,
 *   srdData: object,
 * }} params
 * @returns {{ ok: true, chip: object, updates: object[], skipped: object[], unsupported: object[], serverFollowups: object[], engineRollDisplayOnly: object[] } | { ok: false, status: number, error: string }}
 */
export function computePlayerV2ReviewChipApply(params) {
  const {
    activeElements,
    tableState,
    viewerInstanceId,
    roll,
    activationKey,
    selectOpts,
    srdData,
  } = params || {};

  const key = activationKey != null ? String(activationKey).trim() : '';
  if (!viewerInstanceId || !key || !roll || !Array.isArray(activeElements) || !srdData) {
    return { ok: false, status: 400, error: 'viewerInstanceId, activationKey, roll, and data required' };
  }

  const fearCount = tableState?.fearCount ?? 0;
  const mapConfig = tableState?.mapConfig ?? null;
  const tableFeatureState = tableState?.featureState;

  const viewer = { role: 'player', viewerCharacterInstanceId: viewerInstanceId };
  const chips = collectV2ReviewActionChips({
    roll,
    activeElements,
    srdData,
    fearCount,
    mapConfig,
    tableFeatureState,
    viewer,
  });
  const chip = chips.find((c) => v2BannerChipActivationKey(c) === key);
  if (!chip) {
    return { ok: false, status: 400, error: 'Chip not available for this roll' };
  }
  if (chip.disabled || chip.resourceUnaffordable || chip._v2BannerOnUseConsumed) {
    return { ok: false, status: 400, error: chip.disableHint || 'Chip unavailable' };
  }

  const activated = activateV2ReviewChip(chip, roll, activeElements, srdData, {
    fearCount,
    mapConfig,
    tableFeatureState,
    selectOpts: selectOpts || {},
  });
  if (activated.error) {
    return { ok: false, status: 400, error: activated.error };
  }
  const { mutations } = activated;
  if (!mutations?.length) {
    return { ok: false, status: 400, error: 'No effect' };
  }

  const { localMutations, serverFollowups, engineRollDisplayOnly, unsupported } =
    partitionV2BannerChipMutations(mutations);
  const { updates, skipped } = applyV2BannerMutations(activeElements, localMutations, chip._ownerInstanceId);

  return {
    ok: true,
    chip,
    updates,
    skipped,
    unsupported,
    serverFollowups,
    engineRollDisplayOnly,
  };
}
