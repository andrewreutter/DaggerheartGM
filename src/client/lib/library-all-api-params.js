/**
 * Library “All” list + nav counts: shared query building.
 * Kept separate from `api.js` so unit tests do not load Firebase.
 */

/** API options for `loadLibraryAll` / `loadLibraryAllCounts` from merged Library “All” filter state. */
export function buildLibraryAllApiOpts(filters) {
  const {
    includes = [],
    tiers = [],
    levels = [],
    advRole = [],
    envType = [],
    ablDomain = [],
    wpnSlot = [],
    wpnPhyMag = [],
    featScope = [],
    search,
    includeScaledUp,
    sort = 'popularity',
  } = filters;
  const isAll = includes.length === 0;
  return {
    includeMine: isAll || includes.includes('own'),
    includeSrd: isAll || includes.includes('srd'),
    includePublic: isAll || includes.includes('public'),
    includeHod: isAll || includes.includes('hod'),
    search: search || '',
    tiers,
    levels,
    advRole,
    envType,
    ablDomain,
    wpnSlot,
    wpnPhyMag,
    featScope,
    includeScaledUp,
    sort,
  };
}

export function buildLibraryAllSearchParams({
  includeMine = true,
  includeSrd = false,
  includePublic = false,
  includeHod = false,
  search = '',
  tiers = [],
  levels = [],
  advRole = [],
  envType = [],
  ablDomain = [],
  wpnSlot = [],
  wpnPhyMag = [],
  featScope = [],
  includeScaledUp = false,
  sort = 'popularity',
  offset = 0,
  limit = 20,
} = {}) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (!includeMine) params.set('includeMine', '0');
  if (includeSrd) params.set('includeSrd', '1');
  if (includePublic) params.set('includePublic', '1');
  if (includeHod) params.set('includeHod', '1');
  if (search) params.set('search', search);
  if (Array.isArray(tiers) && tiers.length > 0) {
    tiers.forEach(t => params.append('tier', String(t)));
  }
  if (Array.isArray(levels) && levels.length > 0) {
    levels.forEach(t => params.append('level', String(t)));
  }
  if (Array.isArray(advRole) && advRole.length > 0) {
    advRole.forEach(t => params.append('advRole', t));
  }
  if (Array.isArray(envType) && envType.length > 0) {
    envType.forEach(t => params.append('envType', t));
  }
  if (Array.isArray(ablDomain) && ablDomain.length > 0) {
    ablDomain.forEach(t => params.append('ablDomain', t));
  }
  if (Array.isArray(wpnSlot) && wpnSlot.length > 0) {
    wpnSlot.forEach(t => params.append('wpnSlot', t));
  }
  if (Array.isArray(wpnPhyMag) && wpnPhyMag.length > 0) {
    wpnPhyMag.forEach(t => params.append('wpnPhyMag', t));
  }
  if (Array.isArray(featScope) && featScope.length > 0) {
    featScope.forEach(t => params.append('featScope', t));
  }
  if (includeScaledUp) params.set('includeScaledUp', '1');
  if (sort) params.set('sort', sort);
  return params;
}
