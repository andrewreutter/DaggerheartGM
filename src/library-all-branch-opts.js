/**
 * Per-collection filter wiring for Library "All" merged browse (`getUnifiedLibraryAll`).
 * Tier/level/type params apply only where the collection supports that dimension.
 */

export const LIBRARY_ALL_TIER_RANKED_COLLECTIONS = new Set([
  'adversaries',
  'environments',
  'weapons',
  'armor',
  'beastforms',
  'scenes',
]);

/**
 * @param {string} collection
 * @param {{ tierNums: number[], levelNums: number[], includeScaledUp: boolean }} opts
 * @returns {{ tiersParam: number[], tierMax: number | null, tierMaxExclusive: boolean }}
 */
export function resolveLibraryAllBranchTiers(collection, { tierNums, levelNums, includeScaledUp }) {
  let tiersParam = [];
  let tierMax = null;
  let tierMaxExclusive = false;

  if (collection === 'abilities') {
    tiersParam = levelNums;
  } else if (LIBRARY_ALL_TIER_RANKED_COLLECTIONS.has(collection)) {
    tiersParam = tierNums;
    if (collection === 'adversaries' && includeScaledUp && tiersParam.length === 1) {
      tierMax = tiersParam[0];
      tiersParam = [];
      tierMaxExclusive = true;
    }
  }

  return { tiersParam, tierMax, tierMaxExclusive };
}

/**
 * @param {string} collection
 * @param {{ advRole: string[], envType: string[], ablDomain: string[], wpnSlot: string[], wpnPhyMag: string[] }} opts
 * @returns {{ typeValues: string[], extraTypeValues: string[] }}
 */
export function resolveLibraryAllBranchTypes(collection, { advRole, envType, ablDomain, wpnSlot, wpnPhyMag }) {
  let typeValues = [];
  let extraTypeValues = [];
  if (collection === 'adversaries') typeValues = advRole;
  if (collection === 'environments') typeValues = envType;
  if (collection === 'abilities') typeValues = ablDomain;
  if (collection === 'weapons') {
    typeValues = wpnSlot;
    extraTypeValues = wpnPhyMag;
  }
  return { typeValues, extraTypeValues };
}

/**
 * When any "structural" filter is active (tier, level, namespaced types, feat scope), only query
 * collections those filters actually constrain. Search / Include sources still apply per branch.
 * @param {string} collection - SRD collection name or `'features'`
 * @param {object} opts - same shape as `runLibraryAllBranches` / `getUnifiedLibraryAll` options
 */
export function shouldIncludeLibraryAllBranch(collection, opts = {}) {
  const {
    tiers = [],
    levels = [],
    advRole = [],
    envType = [],
    ablDomain = [],
    wpnSlot = [],
    wpnPhyMag = [],
    featScope = [],
  } = opts;

  const tierNums = tiers.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
  const levelNums = levels.map(t => Number(t)).filter(n => !isNaN(n) && n >= 1 && n <= 12);

  if (
    tierNums.length === 0
    && levelNums.length === 0
    && advRole.length === 0
    && envType.length === 0
    && ablDomain.length === 0
    && wpnSlot.length === 0
    && wpnPhyMag.length === 0
    && featScope.length === 0
  ) {
    return true;
  }

  if (tierNums.length > 0) {
    if (collection === 'features') return false;
    return LIBRARY_ALL_TIER_RANKED_COLLECTIONS.has(collection);
  }
  if (levelNums.length > 0) {
    return collection === 'abilities';
  }
  if (advRole.length > 0) {
    return collection === 'adversaries';
  }
  if (envType.length > 0) {
    return collection === 'environments';
  }
  if (ablDomain.length > 0) {
    return collection === 'abilities';
  }
  if (wpnSlot.length > 0 || wpnPhyMag.length > 0) {
    return collection === 'weapons';
  }
  if (featScope.length > 0) {
    return collection === 'features';
  }
  return true;
}
