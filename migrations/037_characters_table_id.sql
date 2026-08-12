-- Migration 037: Add table_id to items for character ownership
-- Stamps each character row with the table it belongs to.
-- Non-unique for now — unique index in 038 after prod is verified clean.
ALTER TABLE items ADD COLUMN IF NOT EXISTS table_id TEXT;

CREATE INDEX IF NOT EXISTS items_characters_table_id_idx
  ON items (app_id, table_id)
  WHERE collection = 'characters';
