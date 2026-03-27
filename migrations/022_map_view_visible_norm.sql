-- Viewport-independent framing for personal map cameras (normalized inner-map rect).
ALTER TABLE personal_map_cameras
  ADD COLUMN IF NOT EXISTS map_view_visible_norm JSONB;
