-- Lobby index for public Game Tables (homepage Public column).
-- Canonical visibility is items.is_public on collection = 'table_state'.
CREATE INDEX IF NOT EXISTS items_table_state_public_updated_at_idx
  ON items (app_id, updated_at DESC)
  WHERE collection = 'table_state' AND is_public;
