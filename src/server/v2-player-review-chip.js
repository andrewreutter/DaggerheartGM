/**
 * Player V2 **review** banner chips — same engine path as GM `handleV2ReviewChip`, recomputed server-side.
 */

import { getCollection } from '../srd/index.js';
import {
  collectV2ReviewActionChips,
  activateV2ReviewChip,
  v2BannerChipActivationKey,
} from '../client/lib/v2-action-loop-bridge.js';
import {
  partitionV2BannerChipMutations,
  applyV2BannerMutations,
  stripV2BannerAuxiliaryMutations,
} from '../client/lib/table-ops.js';

function buildSrdLookup(items) {
  const byId = {};
  if (!Array.isArray(items)) return byId;
  for (const item of items) {
    if (item?.id) byId[item.id] = item;
  }
  return byId;
}

let srdCache = null;

/** Same shape as `useCharacterSrdData` — cached for the server process. */
export async function loadSrdDataForV2Engine() {
  if (srdCache) return srdCache;
  const [classes, subclasses, ancestries, communities, armor, weapons, abilities, domains, beastforms] =
    await Promise.all([
      getCollection('classes'),
      getCollection('subclasses'),
      getCollection('ancestries'),
      getCollection('communities'),
      getCollection('armor'),
      getCollection('weapons'),
      getCollection('abilities'),
      getCollection('domains'),
      getCollection('beastforms'),
    ]);
  const safe = (arr) => (Array.isArray(arr) ? arr : []);
  srdCache = {
    classes: safe(classes),
    subclasses: safe(subclasses),
    ancestries: safe(ancestries),
    communities: safe(communities),
    armor: safe(armor),
    weapons: safe(weapons),
    abilities: safe(abilities),
    domains: safe(domains),
    beastforms: safe(beastforms),
    classesById: buildSrdLookup(classes),
    subclassesById: buildSrdLookup(subclasses),
    ancestriesById: buildSrdLookup(ancestries),
    communitiesById: buildSrdLookup(communities),
    armorById: buildSrdLookup(armor),
    weaponsById: buildSrdLookup(weapons),
    abilitiesById: buildSrdLookup(abilities),
    domainsById: buildSrdLookup(domains),
    beastformsById: buildSrdLookup(beastforms),
  };
  return srdCache;
}

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

  const { rest, sheetActionRolls, actionLoops } = stripV2BannerAuxiliaryMutations(mutations);
  const { localMutations, serverFollowups, engineRollDisplayOnly, unsupported } =
    partitionV2BannerChipMutations(rest);
  const { updates, skipped } = applyV2BannerMutations(activeElements, localMutations, chip._ownerInstanceId);

  return {
    ok: true,
    chip,
    updates,
    skipped,
    unsupported,
    serverFollowups,
    engineRollDisplayOnly,
    sheetActionRolls,
    actionLoops,
  };
}
