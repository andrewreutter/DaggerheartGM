-- Per-user saved battle map cameras (private; not merged into table_state SSE).
CREATE TABLE IF NOT EXISTS personal_map_cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Camera',
  map_id TEXT NOT NULL,
  map_view_zoom_ratio DOUBLE PRECISION,
  map_view_pan_norm JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_map_cameras_lookup
  ON personal_map_cameras (app_id, table_id, user_id);
