-- Enforce one row per character id across all users.
--
-- scripts/reconcile-character-ownership.mjs --apply is the preferred way to resolve
-- duplicates ahead of time (it merges diverging fields and lets a human pick which
-- row to keep). But new duplicate rows can still appear between a reconciliation
-- pass and this migration actually running (e.g. the old duplicate-creating code
-- path is still live in a rolling deploy), so this migration is self-healing:
-- it archives any remaining (app_id, id) duplicates under a synthetic id — keeping
-- the most-recently-updated row as canonical and preserving the others' data
-- (no destructive DELETE) — immediately before creating the unique index, so
-- startup never fails on this migration regardless of timing.
WITH ranked AS (
  SELECT
    app_id, user_id, id, ctid,
    ROW_NUMBER() OVER (
      PARTITION BY app_id, id
      ORDER BY updated_at DESC NULLS LAST, ctid DESC
    ) AS rn
  FROM items
  WHERE collection = 'characters'
),
losers AS (
  SELECT app_id, user_id, id, ctid FROM ranked WHERE rn > 1
)
UPDATE items i
SET id = '_archivedDuplicateOf_' || i.id || '_' || replace(gen_random_uuid()::text, '-', ''),
    data = COALESCE(i.data, '{}'::jsonb) || jsonb_build_object(
      '_archivedDuplicateOf', i.id,
      '_archivedAt', now()::text,
      '_archivedOriginalUserId', i.user_id
    )
FROM losers l
WHERE i.ctid = l.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS items_characters_id_unique
  ON items (app_id, id)
  WHERE collection = 'characters';
