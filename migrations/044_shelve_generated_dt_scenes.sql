-- Migration 044: Remove the 17 auto-generated environment scenes from the DT catalog.
--
-- These are replaced by two hand-authored scenes (Crossroads Ambush and Cross the
-- Raging River) seeded via `npm run generate:srd-scenes` and stored in
-- `data/dt-scenes/*.json`.  The migration runs automatically on deploy so the old
-- rows are gone before the first request; the seed script still needs to be run
-- manually to populate the new authored scenes.

DELETE FROM external_item_cache
WHERE collection = 'scenes'
  AND source IN ('dt', 'srd')
  AND external_id IN (
    'srd-scene-abandoned-grove',
    'srd-scene-burning-heart-of-the-woods',
    'srd-scene-bustling-marketplace',
    'srd-scene-castle-siege',
    'srd-scene-chaos-realm',
    'srd-scene-cliffside-ascent',
    'srd-scene-cult-ritual',
    'srd-scene-divine-usurpation',
    'srd-scene-hallowed-temple',
    'srd-scene-haunted-city',
    'srd-scene-imperial-court',
    'srd-scene-local-tavern',
    'srd-scene-mountain-pass',
    'srd-scene-necromancer-s-ossuary',
    'srd-scene-outpost-town',
    'srd-scene-pitched-battle',
    'srd-scene-raging-river',
    -- historical excluded pair (safe no-op if already absent)
    'srd-scene-ambushed',
    'srd-scene-ambushers'
  );
