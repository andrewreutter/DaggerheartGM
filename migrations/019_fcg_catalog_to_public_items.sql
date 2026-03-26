-- Migrate Fresh Cut Grass rows from external_item_cache into public items owned by
-- synthetic user __FCG_PUBLIC__ (see src/game-constants.js FCG_PUBLIC_USER_ID).
-- Idempotent: ON CONFLICT updates data and is_public.

INSERT INTO items (id, app_id, user_id, collection, data, is_public)
SELECT
  e.external_id,
  e.app_id,
  '__FCG_PUBLIC__',
  e.collection,
  COALESCE(e.data, '{}'::jsonb) - '_source',
  true
FROM external_item_cache e
WHERE e.source = 'fcg'
  AND e.collection IN ('adversaries', 'environments')
ON CONFLICT (app_id, user_id, collection, id) DO UPDATE SET
  data = EXCLUDED.data,
  is_public = true,
  updated_at = now();

DELETE FROM external_item_cache
WHERE source = 'fcg'
  AND collection IN ('adversaries', 'environments');
