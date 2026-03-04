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
import { searchReddit } from './reddit-search.js';

export const EXTERNAL_SOURCES = [
  // --- SRD: in-memory, covers all 13 SRD collections ---
  {
    name: 'srd',
    enabledParam: 'includeSrd',
    collections: SRD_COLLECTIONS,
    async search({ collection, search, tier, tierMax, type, limit, offset, mirrorIds }) {
      const result = await searchCollection(collection, { search, tier, tierMax, type, limit, offset });
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
  {
    name: 'hod',
    enabledParam: 'includeHod',
    collections: ['adversaries', 'environments'],
    async search({ collection, search, tier, tierMax, type, limit, offset, mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const max = tierMax != null ? Math.min(4, Math.max(1, Number(tierMax))) : null;

      if (max == null) {
        const result = await searchHoD({ search, tier, type, collection, limit, offset });
        const items = result.items.filter(i => !mirrorSet.has(i.id));
        return { items, totalCount: Math.max(0, result.totalCount - mirrorSet.size) };
      }

      // Multi-tier: probe each tier for totalCount, then fetch the requested page.
      const tiers = Array.from({ length: max }, (_, i) => i + 1);
      const probes = await Promise.all(
        tiers.map(t => searchHoD({ search, tier: t, type, collection, limit: 1, offset: 0 }))
      );
      const counts = probes.map(p => p.totalCount || 0);
      const cumulative = [0];
      for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
      const totalCount = Math.max(0, cumulative[max] - mirrorSet.size);

      if (limit <= 0) return { items: [], totalCount };

      const allItems = [];
      let needStart = offset;
      const needEnd = offset + limit;
      for (let i = 0; i < tiers.length && needStart < needEnd; i++) {
        const tierLo = cumulative[i];
        const tierHi = cumulative[i + 1];
        if (needStart >= tierHi) continue;
        const localOffset = needStart - tierLo;
        const take = Math.min(needEnd - needStart, tierHi - needStart);
        const res = await searchHoD({
          search, tier: tiers[i], type, collection,
          limit: take, offset: localOffset,
        });
        const chunk = res.items.filter(item => !mirrorSet.has(item.id));
        allItems.push(...chunk);
        needStart += chunk.length;
      }
      return { items: allItems, totalCount };
    },
  },

  // --- FCG: live API, adversaries + environments only ---
  // When tierMax is set, makes one request per tier (1..tierMax) and merges results.
  {
    name: 'fcg',
    enabledParam: 'includeFcg',
    collections: ['adversaries', 'environments'],
    async search({ collection, search, tier, tierMax, type, typeField, limit, offset, mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const mirrorCount = mirrorSet.size;
      const max = tierMax != null ? Math.min(4, Math.max(1, Number(tierMax))) : null;
      const fcgTier = tier ? Number(tier) : undefined;

      // Map app role/type values to FCG's native params
      let fcgRole;
      let fcgCategory;
      if (collection === 'environments') {
        fcgCategory = 'Environments';
        if (type) {
          fcgRole = 'Environment' + type.charAt(0).toUpperCase() + type.slice(1);
        }
      } else if (collection === 'adversaries' && type) {
        fcgRole = type.charAt(0).toUpperCase() + type.slice(1);
      }

      const needsEnvSubtraction = collection === 'adversaries' && !fcgRole;

      async function getFcgTierCount(t) {
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

      async function fetchFcgPage(t, lim, off) {
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
        const totalCount = await getFcgTierCount(t);
        if (lim <= 0) return { items: [], totalCount };
        const fcgResult = await searchFCG({
          search, tier: tierVal, role: fcgRole, category: fcgCategory,
          collection, limit: lim, offset: off,
        });
        const items = (fcgResult[collection] || []).filter(i => !mirrorSet.has(i.id));
        return { items, totalCount };
      }

      if (max == null) {
        const result = await fetchFcgPage(fcgTier, limit, offset);
        return result;
      }

      // Multi-tier: probe each tier for totalCount, then fetch the requested page.
      const tiers = Array.from({ length: max }, (_, i) => i + 1);
      const counts = await Promise.all(tiers.map(t => getFcgTierCount(t)));
      const cumulative = [0];
      for (let i = 0; i < counts.length; i++) cumulative.push(cumulative[i] + counts[i]);
      const totalCount = Math.max(0, cumulative[max] - mirrorCount);

      if (limit <= 0) return { items: [], totalCount };

      const allItems = [];
      let needStart = offset;
      const needEnd = offset + limit;
      for (let i = 0; i < tiers.length && needStart < needEnd; i++) {
        const tierLo = cumulative[i];
        const tierHi = cumulative[i + 1];
        if (needStart >= tierHi) continue;
        const localOffset = needStart - tierLo;
        const take = Math.min(needEnd - needStart, tierHi - needStart);
        const res = await fetchFcgPage(tiers[i], take, localOffset);
        allItems.push(...res.items);
        needStart += res.items.length;
      }
      return { items: allItems, totalCount };
    },
  },

  // --- Reddit (r/daggerbrew + r/daggerheart): live API, adversaries + environments only ---
  // Listed LAST: stubs have the least structured data; full detail requires LLM parse on click.
  // Not included in "All" source results — only shown when explicitly selected (see useCollectionSearch).
  {
    name: 'reddit',
    enabledParam: 'includeReddit',
    collections: ['adversaries', 'environments'],
    async search({ collection, search, limit, offset, mirrorIds, blockedRedditPostIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const blockedSet = blockedRedditPostIds instanceof Set ? blockedRedditPostIds : new Set(blockedRedditPostIds || []);
      const result = await searchReddit({ collection, search, limit, offset });
      const blockedInPage = result.items.filter(i => blockedSet.has(i._redditPostId)).length;
      const items = result.items.filter(i => !mirrorSet.has(i.id) && !blockedSet.has(i._redditPostId));
      return { items, totalCount: Math.max(0, result.totalCount - mirrorSet.size - blockedInPage) };
    },
  },
];
