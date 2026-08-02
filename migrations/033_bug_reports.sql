-- Bug reports: append-only table for in-session GM bug captures (T13).
CREATE TABLE IF NOT EXISTS bug_reports (
  id          SERIAL PRIMARY KEY,
  app_id      TEXT NOT NULL,
  gm_uid      TEXT NOT NULL,
  table_id    TEXT,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_lookup_idx
  ON bug_reports (app_id, gm_uid, created_at DESC);
