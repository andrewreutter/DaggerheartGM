CREATE TABLE IF NOT EXISTS item_popularity (
  app_id     TEXT NOT NULL,
  collection TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, collection, item_id, user_id, action)
);

CREATE INDEX IF NOT EXISTS item_popularity_item_idx
  ON item_popularity (app_id, collection, item_id, action);
