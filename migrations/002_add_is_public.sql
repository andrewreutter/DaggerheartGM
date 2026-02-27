ALTER TABLE items ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS items_public_idx ON items (app_id, collection, is_public);
