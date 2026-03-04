CREATE TABLE IF NOT EXISTS external_item_cache (
  app_id       TEXT NOT NULL,
  source       TEXT NOT NULL,
  collection   TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  raw_hash     TEXT NOT NULL,
  data         JSONB NOT NULL,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, source, collection, external_id)
);

CREATE INDEX IF NOT EXISTS external_cache_lookup_idx
  ON external_item_cache (app_id, collection);
