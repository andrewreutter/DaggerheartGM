-- T19: Character table placements — telemetry only, never gates or caps anything.
-- Composite PK prevents duplicate placements; ON CONFLICT DO NOTHING in application code.
-- user_id = character owner (resolved from library at placement time).
CREATE TABLE IF NOT EXISTS character_table_placements (
  app_id       TEXT        NOT NULL,
  user_id      TEXT        NOT NULL,
  character_id TEXT        NOT NULL,
  table_id     TEXT        NOT NULL,
  placed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, user_id, character_id, table_id)
);

CREATE INDEX IF NOT EXISTS ctp_table_idx
  ON character_table_placements (app_id, table_id);

CREATE INDEX IF NOT EXISTS ctp_user_idx
  ON character_table_placements (app_id, user_id);
