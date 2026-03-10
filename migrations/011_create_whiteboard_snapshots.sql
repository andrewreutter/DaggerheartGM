CREATE TABLE IF NOT EXISTS whiteboard_snapshots (
  app_id     TEXT        NOT NULL,
  gm_uid     TEXT        NOT NULL,
  snapshot   JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, gm_uid)
);
