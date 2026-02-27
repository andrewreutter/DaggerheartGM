CREATE TABLE IF NOT EXISTS items (
  id         TEXT NOT NULL,
  app_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  collection TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, collection, id)
);

CREATE INDEX IF NOT EXISTS items_user_idx ON items (app_id, user_id, collection);
