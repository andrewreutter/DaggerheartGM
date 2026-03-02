ALTER TABLE items ADD COLUMN IF NOT EXISTS clone_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS play_count  INTEGER NOT NULL DEFAULT 0;

-- Fast lookup for finding a user's existing auto-clone of a source item
CREATE INDEX IF NOT EXISTS items_cloned_from_idx
  ON items (app_id, user_id, collection, (data->>'_clonedFrom'))
  WHERE data->>'_clonedFrom' IS NOT NULL;
