-- Retag generated starter scenes from official-catalog source `srd` to `dt`.
-- Source is part of the PK, so copy-then-delete. Ids stay `srd-scene-*`.
INSERT INTO external_item_cache (app_id, source, collection, external_id, raw_hash, data, fetched_at)
SELECT app_id, 'dt', collection, external_id, raw_hash,
       jsonb_set(COALESCE(data, '{}'::jsonb), '{_source}', '"dt"'),
       fetched_at
FROM external_item_cache
WHERE collection = 'scenes' AND source = 'srd'
ON CONFLICT DO NOTHING;

DELETE FROM external_item_cache
WHERE collection = 'scenes' AND source = 'srd';
