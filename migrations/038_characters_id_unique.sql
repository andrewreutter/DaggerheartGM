-- Enforce one row per character id across all users.
-- PREREQUISITE: run scripts/reconcile-character-ownership.mjs --apply first and confirm
-- zero duplicates (character-reconciliation-report.json mode=apply, errors=0).
-- This migration will fail at startup if any (app_id, id) duplicates still exist
-- in the characters collection; verify clean before deploying.
CREATE UNIQUE INDEX IF NOT EXISTS items_characters_id_unique
  ON items (app_id, id)
  WHERE collection = 'characters';
