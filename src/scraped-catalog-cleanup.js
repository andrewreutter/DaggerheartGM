/**
 * Report queries for the FCG/HoD + leftover-public-adversary cleanup.
 * Startup migrations `041` / `042` apply the same predicates.
 */
export const SCRAPED_CATALOG_CLEANUP_MIGRATIONS = [
  '041_remove_fcg_hod_catalogs.sql',
  '042_delete_public_adversaries.sql',
];

export const SCRAPED_CATALOG_CLEANUP_REPORT_QUERIES = [
  {
    key: 'fcgCatalog',
    label: 'FCG catalog rows (__FCG_PUBLIC__)',
    sql: `SELECT COUNT(*)::int AS n FROM items WHERE user_id = '__FCG_PUBLIC__'`,
  },
  {
    key: 'hodFcgCache',
    label: 'HoD/FCG external_item_cache rows',
    sql: `SELECT COUNT(*)::int AS n FROM external_item_cache WHERE source IN ('hod', 'fcg')`,
  },
  {
    key: 'scrapedMirrors',
    label: 'Scraped __MIRROR__ rows (fcg-/hod-)',
    sql: `SELECT COUNT(*)::int AS n FROM items
          WHERE user_id = '__MIRROR__'
            AND (
              id LIKE 'fcg-%'
              OR id LIKE 'hod-%'
              OR COALESCE(data->>'_source', '') = 'hod'
              OR COALESCE(data->>'_clonedFrom', '') LIKE 'fcg-%'
              OR COALESCE(data->>'_clonedFrom', '') LIKE 'hod-%'
            )`,
  },
  {
    key: 'publicFcgHodClones',
    label: 'Public clones to unpublish (fcg-/hod- id or _clonedFrom)',
    sql: `SELECT COUNT(*)::int AS n FROM items
          WHERE is_public = true
            AND (
              id LIKE 'fcg-%'
              OR id LIKE 'hod-%'
              OR COALESCE(data->>'_clonedFrom', '') LIKE 'fcg-%'
              OR COALESCE(data->>'_clonedFrom', '') LIKE 'hod-%'
            )`,
  },
  {
    key: 'publicScenesAdventuresEmbedding',
    label: 'Public scenes/adventures embedding fcg-/hod- ids',
    sql: `SELECT COUNT(*)::int AS n FROM items
          WHERE is_public = true
            AND collection IN ('scenes', 'adventures')
            AND (
              data::text ~ 'fcg-[0-9A-Za-z]'
              OR data::text ~ 'hod-[0-9A-Za-z]'
            )`,
  },
  {
    key: 'fcgHodPopularity',
    label: 'item_popularity rows for fcg-/hod- ids',
    sql: `SELECT COUNT(*)::int AS n FROM item_popularity
          WHERE item_id LIKE 'fcg-%' OR item_id LIKE 'hod-%'`,
  },
  {
    key: 'hodFcgSyncState',
    label: 'sync_state keys matching hod/fcg',
    sql: `SELECT COUNT(*)::int AS n FROM sync_state
          WHERE key ILIKE '%hod%' OR key ILIKE '%fcg%'`,
  },
  {
    key: 'publicAdversaries',
    label: 'Public adversaries to delete',
    sql: `SELECT COUNT(*)::int AS n FROM items
          WHERE collection = 'adversaries' AND is_public = true`,
  },
];

export const PUBLIC_ADVERSARY_LIST_SQL = `
  SELECT id, user_id, data->>'name' AS name
  FROM items
  WHERE collection = 'adversaries' AND is_public = true
  ORDER BY created_at, id
`;
