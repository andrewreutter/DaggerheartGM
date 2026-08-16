-- Remove Fresh Cut Grass and Heart of Daggers shared catalogs.
-- Unpublish user clones / scenes / adventures that were still public.
-- Private Mine copies and table_state placements are left intact.

-- FCG catalog (synthetic public owner)
DELETE FROM items
WHERE user_id = '__FCG_PUBLIC__';

-- HoD cache (+ leftover FCG cache rows from before migration 019)
DELETE FROM external_item_cache
WHERE source IN ('hod', 'fcg');

-- Mirrors of scraped catalog ids
DELETE FROM items
WHERE user_id = '__MIRROR__'
  AND (
    id LIKE 'fcg-%'
    OR id LIKE 'hod-%'
    OR COALESCE(data->>'_source', '') = 'hod'
    OR COALESCE(data->>'_clonedFrom', '') LIKE 'fcg-%'
    OR COALESCE(data->>'_clonedFrom', '') LIKE 'hod-%'
  );

-- Unpublish clones that originated from FCG/HoD
UPDATE items
SET is_public = false
WHERE is_public = true
  AND (
    id LIKE 'fcg-%'
    OR id LIKE 'hod-%'
    OR COALESCE(data->>'_clonedFrom', '') LIKE 'fcg-%'
    OR COALESCE(data->>'_clonedFrom', '') LIKE 'hod-%'
  );

-- Unpublish public scenes/adventures that still embed scraped catalog ids
UPDATE items
SET is_public = false
WHERE is_public = true
  AND collection IN ('scenes', 'adventures')
  AND (
    data::text ~ 'fcg-[0-9A-Za-z]'
    OR data::text ~ 'hod-[0-9A-Za-z]'
  );

DELETE FROM item_popularity
WHERE item_id LIKE 'fcg-%'
   OR item_id LIKE 'hod-%';

DELETE FROM sync_state
WHERE key ILIKE '%hod%'
   OR key ILIKE '%fcg%';
