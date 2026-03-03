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
import { getRedditMirrorsPaginated } from './db.js';

export const EXTERNAL_SOURCES = [
  // --- SRD: in-memory, covers all 13 SRD collections ---
  {
    name: 'srd',
    enabledParam: 'includeSrd',
    collections: SRD_COLLECTIONS,
    async search({ collection, search, tier, type, limit, offset, mirrorIds }) {
      const result = await searchCollection(collection, { search, tier, type, limit, offset });
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
  {
    name: 'hod',
    enabledParam: 'includeHod',
    collections: ['adversaries', 'environments'],
    async search({ collection, search, tier, type, limit, offset, mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const result = await searchHoD({ search, tier, type, collection, limit, offset });
      const items = result.items.filter(i => !mirrorSet.has(i.id));
      return {
        items,
        totalCount: Math.max(0, result.totalCount - mirrorSet.size),
      };
    },
  },

  // --- FCG: live API, adversaries + environments only ---
  {
    name: 'fcg',
    enabledParam: 'includeFcg',
    collections: ['adversaries', 'environments'],
    async search({ collection, search, tier, type, typeField, limit, offset, mirrorIds }) {
      const mirrorSet = mirrorIds instanceof Set ? mirrorIds : new Set(mirrorIds || []);
      const mirrorCount = mirrorSet.size;
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

      // FCG mixes adversaries and environments in one result set. When no role filter
      // is applied to adversaries, probe both totals so we can inflate the request limit
      // and page correctly without gaps.
      const needsEnvSubtraction = collection === 'adversaries' && !fcgRole;

      if (needsEnvSubtraction) {
        const [allProbe, envProbe] = await Promise.all([
          searchFCG({ search, tier: fcgTier, collection, limit: 1, offset: 0 }),
          searchFCG({ search, tier: fcgTier, category: 'Environments', limit: 1, offset: 0 }),
        ]);
        const allTotal = allProbe.fcgTotal;
        const envTotal = envProbe.fcgTotal;
        const advTotal = Math.max(0, allTotal - envTotal);
        const advRatio = advTotal / Math.max(1, allTotal);
        const totalCount = Math.max(0, advTotal - mirrorCount);

        if (limit <= 0) {
          return { items: [], totalCount };
        }

        // Inflate the request limit to compensate for environments that will be filtered out.
        const adjLimit = Math.min(Math.ceil(limit / Math.max(0.01, advRatio)), 100);
        const fcgResult = await searchFCG({
          search, tier: fcgTier, role: fcgRole, category: fcgCategory,
          collection, limit: adjLimit, offset,
        });
        const items = fcgResult[collection]
          .filter(i => !mirrorSet.has(i.id))
          .slice(0, limit);
        // Return the FCG-local cursor so the endpoint can advance past all consumed rows
        // (including the environments that were filtered out).
        return { items, totalCount, nextLocalOffset: offset + adjLimit };
      }

      if (limit <= 0) {
        const probe = await searchFCG({
          search, tier: fcgTier, role: fcgRole, category: fcgCategory,
          collection, limit: 1, offset: 0,
        });
        return { items: [], totalCount: Math.max(0, probe.fcgTotal - mirrorCount) };
      }

      const fcgResult = await searchFCG({
        search, tier: fcgTier, role: fcgRole, category: fcgCategory,
        collection, limit, offset,
      });
      return {
        items: fcgResult[collection].filter(i => !mirrorSet.has(i.id)),
        totalCount: Math.max(0, fcgResult.fcgTotal - mirrorCount),
      };
    },
  },

  // --- Reddit: DB-backed admin-approved mirrors only ---
  // Items are discovered by the background scanner, auto-parsed, and must be approved
  // by an admin (_redditStatus='parsed') before appearing here. Included in "All" results.
  {
    name: 'reddit',
    enabledParam: 'includeReddit',
    collections: ['adversaries', 'environments'],
    async search({ collection, search, tier, typeField, type, limit, offset, appId }) {
      return getRedditMirrorsPaginated(appId, collection, {
        search, tier, typeField, typeValue: type, offset, limit,
      });
    },
  },
];
