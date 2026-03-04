/**
 * External data sources for library collections.
 *
 * Each source implements a common contract:
 *   name            - identifier, used as the _source tag and `include` filter value on the client
 *   enabledParam    - query param that enables this source (e.g. 'includeSrd')
 *   collections     - array of collection names this source covers, or null for all
 *   search(opts)    - async fn returning { items, totalCount, nextLocalOffset? }
 *
 * search() opts:
 *   collection      - the collection being queried
 *   search          - free-text search string
 *   tier            - tier filter (string or null)
 *   tierMax         - when set (includeScaledUp), return items with tier <= tierMax
 *   type            - type/role filter value (string or null)
 *   typeField       - DB field name for the type filter ('role', 'type', or null)
 *   limit           - max items to return
 *   offset          - local offset *within this source's result space*
 *   mirrorIds       - Set of mirror item IDs already shown in DB results (for dedup)
 *
 * items must be tagged with the correct _source value.
 *
 * nextLocalOffset, if returned, overrides the default (offset + items.length) cursor
 * for pagination. Used by FCG to handle the env-subtraction case where the actual
 * number of FCG rows consumed differs from the number of items returned.
 *
 * Adding a new source is simply appending another object to EXTERNAL_SOURCES.
 */

import { searchCollection, COLLECTION_NAMES as SRD_COLLECTIONS } from './srd/index.js';
import { searchFCG } from './fcg-search.js';
import { searchHoD } from './hod-search.js';
import { ROLES, ENV_TYPES } from './game-constants.js';

export const EXTERNAL_SOURCES = [
  // --- SRD: in-memory, covers all 13 SRD collections ---
  {
    name: 'srd',
    enabledParam: 'includeSrd',
    collections: SRD_COLLECTIONS,
    async getTotalCount({ collection, search, tier, tierMax, tiers = [], type, types = [], mirrorIds }) {
      const result = await searchCollection(collection, { search, tier, tierMax, tiers, type, types, limit: 0, offset: 0 });
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      return Math.max(0, result.totalCount - mirrorSet.size);
    },
    async search({ collection, search, tier, tierMax, tiers = [], type, types = [], limit, offset, mirrorIds }) {
      const result = await searchCollection(collection, { search, tier, tierMax, tiers, type, types, limit, offset });
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const items = result.items
        .filter(i => !mirrorSet.has(i.id))
        .map(i => ({ ...i, _source: 'srd' }));
      // Subtract mirror count from total so pagination math stays correct.
      // This is an approximation (mirrors may not all match the current filter), but
      // it keeps the totalCount conservative rather than inflated.
      return {
        items,
        totalCount: Math.max(0, result.totalCount - mirrorSet.size),
      };
    },
  },

  // --- HoD (Heart of Daggers): live API, adversaries + environments only ---
  // HoD is placed before FCG because its content tends to be higher quality.
  // When tierMax is set, makes one request per tier (1..tierMax) and merges results.
  // When tiers[] or types[] has multiple values, makes one request per (tier, type) combination.
  {
    name: 'hod',
    enabledParam: 'includeHod',
    collections: ['adversaries', 'environments'],
    async getTotalCount({ collection, search, tier, tierMax, tiers = [], type, types = [], mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const typeOpts = collection === 'adversaries' ? ROLES : ENV_TYPES;
      const singleTier = tierMax == null && (tiers.length <= 1);
      const singleType = types.length <= 1;
      if (tierMax == null && tiers.length === 0 && types.length === 0) {
        const result = await searchHoD({ search, collection, limit: 1, offset: 0 });
        return Math.max(0, (result.totalCount || 0) - mirrorSet.size);
      }
      if (tierMax == null && singleTier && singleType) {
        const t = tiers.length ? tiers[0] : tier;
        const ty = types.length ? types[0] : type;
        const result = await searchHoD({ search, tier: t, type: ty, collection, limit: 1, offset: 0 });
        return Math.max(0, (result.totalCount || 0) - mirrorSet.size);
      }
      if (tierMax != null) {
        const max = Math.min(4, Math.max(1, Number(tierMax)));
        const tierList = Array.from({ length: max }, (_, i) => i + 1);
        const probes = await Promise.all(
          tierList.map(t => searchHoD({ search, tier: t, type, collection, limit: 1, offset: 0 }))
        );
        const counts = probes.map(p => p.totalCount || 0);
        const cumulative = [0];
        for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
        return Math.max(0, cumulative[max] - mirrorSet.size);
      }
      const tierVals = tiers.length ? tiers : [1, 2, 3, 4];
      const typeVals = types.length ? types : typeOpts;
      const combinations = tierVals.flatMap(t => typeVals.map(ty => ({ tier: t, type: ty })));
      const probes = await Promise.all(
        combinations.map(({ tier: t, type: ty }) =>
          searchHoD({ search, tier: t, type: ty, collection, limit: 1, offset: 0 })
        )
      );
      const counts = probes.map(p => p.totalCount || 0);
      const cumulative = [0];
      for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
      return Math.max(0, cumulative[combinations.length] - mirrorSet.size);
    },
    async search({ collection, search, tier, tierMax, tiers = [], type, types = [], limit, offset, mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const typeOpts = collection === 'adversaries' ? ROLES : ENV_TYPES;

      // Single call: no filter, or single tier+type
      const singleTier = tierMax == null && (tiers.length <= 1);
      const singleType = types.length <= 1;
      if (tierMax == null && tiers.length === 0 && types.length === 0) {
        const result = await searchHoD({ search, collection, limit, offset });
        const items = result.items.filter(i => !mirrorSet.has(i.id));
        return { items, totalCount: Math.max(0, result.totalCount - mirrorSet.size) };
      }
      if (tierMax == null && singleTier && singleType) {
        const t = tiers.length ? tiers[0] : tier;
        const ty = types.length ? types[0] : type;
        const result = await searchHoD({ search, tier: t, type: ty, collection, limit, offset });
        const items = result.items.filter(i => !mirrorSet.has(i.id));
        return { items, totalCount: Math.max(0, result.totalCount - mirrorSet.size) };
      }

      // tierMax: existing multi-tier (1..max) with single type
      if (tierMax != null) {
        const max = Math.min(4, Math.max(1, Number(tierMax)));
        const tierList = Array.from({ length: max }, (_, i) => i + 1);
        const probes = await Promise.all(
          tierList.map(t => searchHoD({ search, tier: t, type, collection, limit: 1, offset: 0 }))
        );
        const counts = probes.map(p => p.totalCount || 0);
        const cumulative = [0];
        for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
        const totalCount = Math.max(0, cumulative[max] - mirrorSet.size);
        if (limit <= 0) return { items: [], totalCount };
        const needEnd = offset + limit;
        const fetches = [];
        for (let i = 0; i < tierList.length; i++) {
          const tierLo = cumulative[i];
          const tierHi = cumulative[i + 1];
          const overlapStart = Math.max(offset, tierLo);
          const overlapEnd = Math.min(needEnd, tierHi);
          if (overlapStart >= overlapEnd) continue;
          const localOffset = overlapStart - tierLo;
          const take = overlapEnd - overlapStart;
          fetches.push({ tier: tierList[i], localOffset, take });
        }
        const results = await Promise.all(
          fetches.map(({ tier: t, localOffset: off, take }) =>
            searchHoD({ search, tier: t, type, collection, limit: take, offset: off })
          )
        );
        const allItems = results.flatMap(res => res.items.filter(item => !mirrorSet.has(item.id)));
        return { items: allItems, totalCount };
      }

      // Multi-select: (tier, type) combinations. Order: tier ascending, then type.
      const tierVals = tiers.length ? tiers : [1, 2, 3, 4];
      const typeVals = types.length ? types : typeOpts;
      const combinations = tierVals.flatMap(t => typeVals.map(ty => ({ tier: t, type: ty })));

      const probes = await Promise.all(
        combinations.map(({ tier: t, type: ty }) =>
          searchHoD({ search, tier: t, type: ty, collection, limit: 1, offset: 0 })
        )
      );
      const counts = probes.map(p => p.totalCount || 0);
      const cumulative = [0];
      for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
      const totalCount = Math.max(0, cumulative[combinations.length] - mirrorSet.size);

      if (limit <= 0) return { items: [], totalCount };

      const needEnd = offset + limit;
      const fetches = [];
      for (let i = 0; i < combinations.length; i++) {
        const { tier: t, type: ty } = combinations[i];
        const tierLo = cumulative[i];
        const tierHi = cumulative[i + 1];
        const overlapStart = Math.max(offset, tierLo);
        const overlapEnd = Math.min(needEnd, tierHi);
        if (overlapStart >= overlapEnd) continue;
        const localOffset = overlapStart - tierLo;
        const take = overlapEnd - overlapStart;
        fetches.push({ tier: t, type: ty, localOffset, take });
      }
      const results = await Promise.all(
        fetches.map(({ tier: t, type: ty, localOffset: off, take }) =>
          searchHoD({ search, tier: t, type: ty, collection, limit: take, offset: off })
        )
      );
      const allItems = results.flatMap(res => res.items.filter(item => !mirrorSet.has(item.id)));
      return { items: allItems, totalCount };
    },
  },

  // --- FCG: live API, adversaries + environments only ---
  // When tierMax is set, makes one request per tier (1..tierMax) and merges results.
  // When tiers[] or types[] has multiple values, makes one request per (tier, type) combination.
  {
    name: 'fcg',
    enabledParam: 'includeFcg',
    collections: ['adversaries', 'environments'],
    async getTotalCount({ collection, search, tier, tierMax, tiers = [], type, types = [], mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const mirrorCount = mirrorSet.size;
      const typeOpts = collection === 'adversaries' ? ROLES : ENV_TYPES;

      function fcgParams(ty) {
        let fcgRole;
        let fcgCategory;
        if (collection === 'environments') {
          fcgCategory = 'Environments';
          if (ty) fcgRole = 'Environment' + ty.charAt(0).toUpperCase() + ty.slice(1);
        } else if (collection === 'adversaries' && ty) {
          fcgRole = ty.charAt(0).toUpperCase() + ty.slice(1);
        }
        const needsEnvSubtraction = collection === 'adversaries' && !fcgRole;
        return { fcgRole, fcgCategory, needsEnvSubtraction };
      }

      async function getFcgCombinationCount(t, ty) {
        const { fcgRole, fcgCategory, needsEnvSubtraction } = fcgParams(ty);
        const tierVal = t ? Number(t) : undefined;
        if (needsEnvSubtraction) {
          const [allProbe, envProbe] = await Promise.all([
            searchFCG({ search, tier: tierVal, collection, limit: 1, offset: 0 }),
            searchFCG({ search, tier: tierVal, category: 'Environments', limit: 1, offset: 0 }),
          ]);
          return Math.max(0, (allProbe.fcgTotal || 0) - (envProbe.fcgTotal || 0) - mirrorCount);
        }
        const probe = await searchFCG({
          search, tier: tierVal, role: fcgRole, category: fcgCategory,
          collection, limit: 1, offset: 0,
        });
        return Math.max(0, (probe.fcgTotal || 0) - mirrorCount);
      }

      if (tierMax == null && tiers.length === 0 && types.length === 0) {
        return getFcgCombinationCount(undefined, undefined);
      }
      if (tierMax == null && tiers.length <= 1 && types.length <= 1) {
        const t = tiers.length ? tiers[0] : tier;
        const ty = types.length ? types[0] : type;
        return getFcgCombinationCount(t, ty);
      }
      if (tierMax != null) {
        const max = Math.min(4, Math.max(1, Number(tierMax)));
        const tierList = Array.from({ length: max }, (_, i) => i + 1);
        const counts = await Promise.all(tierList.map(t => getFcgCombinationCount(t, type)));
        const cumulative = [0];
        for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
        return Math.max(0, cumulative[max] - mirrorCount);
      }
      const tierVals = tiers.length ? tiers : [1, 2, 3, 4];
      const typeVals = types.length ? types : typeOpts;
      const combinations = tierVals.flatMap(t => typeVals.map(ty => ({ tier: t, type: ty })));
      const counts = await Promise.all(
        combinations.map(({ tier: t, type: ty }) => getFcgCombinationCount(t, ty))
      );
      const cumulative = [0];
      for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
      return Math.max(0, cumulative[combinations.length] - mirrorCount);
    },
    async search({ collection, search, tier, tierMax, tiers = [], type, types = [], typeField, limit, offset, mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const mirrorCount = mirrorSet.size;
      const typeOpts = collection === 'adversaries' ? ROLES : ENV_TYPES;

      function fcgParams(ty) {
        let fcgRole;
        let fcgCategory;
        if (collection === 'environments') {
          fcgCategory = 'Environments';
          if (ty) fcgRole = 'Environment' + ty.charAt(0).toUpperCase() + ty.slice(1);
        } else if (collection === 'adversaries' && ty) {
          fcgRole = ty.charAt(0).toUpperCase() + ty.slice(1);
        }
        const needsEnvSubtraction = collection === 'adversaries' && !fcgRole;
        return { fcgRole, fcgCategory, needsEnvSubtraction };
      }

      async function getFcgCombinationCount(t, ty) {
        const { fcgRole, fcgCategory, needsEnvSubtraction } = fcgParams(ty);
        const tierVal = t ? Number(t) : undefined;
        if (needsEnvSubtraction) {
          const [allProbe, envProbe] = await Promise.all([
            searchFCG({ search, tier: tierVal, collection, limit: 1, offset: 0 }),
            searchFCG({ search, tier: tierVal, category: 'Environments', limit: 1, offset: 0 }),
          ]);
          return Math.max(0, (allProbe.fcgTotal || 0) - (envProbe.fcgTotal || 0) - mirrorCount);
        }
        const probe = await searchFCG({
          search, tier: tierVal, role: fcgRole, category: fcgCategory,
          collection, limit: 1, offset: 0,
        });
        return Math.max(0, (probe.fcgTotal || 0) - mirrorCount);
      }

      async function fetchFcgCombinationPage(t, ty, lim, off) {
        const { fcgRole, fcgCategory, needsEnvSubtraction } = fcgParams(ty);
        const tierVal = t ? Number(t) : undefined;
        if (needsEnvSubtraction) {
          const [allProbe, envProbe] = await Promise.all([
            searchFCG({ search, tier: tierVal, collection, limit: 1, offset: 0 }),
            searchFCG({ search, tier: tierVal, category: 'Environments', limit: 1, offset: 0 }),
          ]);
          const advTotal = Math.max(0, (allProbe.fcgTotal || 0) - (envProbe.fcgTotal || 0));
          const advRatio = advTotal / Math.max(1, allProbe.fcgTotal || 1);
          const adjLimit = Math.min(Math.ceil(lim / Math.max(0.01, advRatio)), 100);
          const fcgResult = await searchFCG({
            search, tier: tierVal, role: fcgRole, category: fcgCategory,
            collection, limit: adjLimit, offset: off,
          });
          const items = (fcgResult[collection] || []).filter(i => !mirrorSet.has(i.id)).slice(0, lim);
          return { items, totalCount: Math.max(0, advTotal - mirrorCount) };
        }
        if (lim <= 0) return { items: [], totalCount: await getFcgCombinationCount(t, ty) };
        const fcgResult = await searchFCG({
          search, tier: tierVal, role: fcgRole, category: fcgCategory,
          collection, limit: lim, offset: off,
        });
        const items = (fcgResult[collection] || []).filter(i => !mirrorSet.has(i.id));
        return { items, totalCount: await getFcgCombinationCount(t, ty) };
      }

      // Single call: no filter, or single tier+type
      if (tierMax == null && tiers.length === 0 && types.length === 0) {
        return fetchFcgCombinationPage(undefined, undefined, limit, offset);
      }
      if (tierMax == null && tiers.length <= 1 && types.length <= 1) {
        const t = tiers.length ? tiers[0] : tier;
        const ty = types.length ? types[0] : type;
        return fetchFcgCombinationPage(t, ty, limit, offset);
      }

      // tierMax: existing multi-tier (1..max) with single type
      if (tierMax != null) {
        const max = Math.min(4, Math.max(1, Number(tierMax)));
        const tierList = Array.from({ length: max }, (_, i) => i + 1);
        const counts = await Promise.all(tierList.map(t => getFcgCombinationCount(t, type)));
        const cumulative = [0];
        for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
        const totalCount = Math.max(0, cumulative[max] - mirrorCount);
        if (limit <= 0) return { items: [], totalCount };
        const needEnd = offset + limit;
        const fetches = [];
        for (let i = 0; i < tierList.length; i++) {
          const tierLo = cumulative[i];
          const tierHi = cumulative[i + 1];
          const overlapStart = Math.max(offset, tierLo);
          const overlapEnd = Math.min(needEnd, tierHi);
          if (overlapStart >= overlapEnd) continue;
          const localOffset = overlapStart - tierLo;
          const take = overlapEnd - overlapStart;
          fetches.push({ tier: tierList[i], type, localOffset, take });
        }
        const results = await Promise.all(
          fetches.map(({ tier: t, type: ty, localOffset: off, take }) =>
            fetchFcgCombinationPage(t, ty, take, off)
          )
        );
        const allItems = results.flatMap(r => r.items);
        return { items: allItems, totalCount };
      }

      // Multi-select: (tier, type) combinations
      const tierVals = tiers.length ? tiers : [1, 2, 3, 4];
      const typeVals = types.length ? types : typeOpts;
      const combinations = tierVals.flatMap(t => typeVals.map(ty => ({ tier: t, type: ty })));

      const counts = await Promise.all(
        combinations.map(({ tier: t, type: ty }) => getFcgCombinationCount(t, ty))
      );
      const cumulative = [0];
      for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
      const totalCount = Math.max(0, cumulative[combinations.length] - mirrorCount);

      if (limit <= 0) return { items: [], totalCount };

      const needEnd = offset + limit;
      const fetches = [];
      for (let i = 0; i < combinations.length; i++) {
        const { tier: t, type: ty } = combinations[i];
        const tierLo = cumulative[i];
        const tierHi = cumulative[i + 1];
        const overlapStart = Math.max(offset, tierLo);
        const overlapEnd = Math.min(needEnd, tierHi);
        if (overlapStart >= overlapEnd) continue;
        const localOffset = overlapStart - tierLo;
        const take = overlapEnd - overlapStart;
        fetches.push({ tier: t, type: ty, localOffset, take });
      }
      const results = await Promise.all(
        fetches.map(({ tier: t, type: ty, localOffset: off, take }) =>
          fetchFcgCombinationPage(t, ty, take, off)
        )
      );
      const allItems = results.flatMap(r => r.items);
      return { items: allItems, totalCount };
    },
  },
];
