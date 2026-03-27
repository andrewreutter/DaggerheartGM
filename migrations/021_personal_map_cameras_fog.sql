-- Optional fog-of-war mask (PNG data URL) per personal map camera (per user).
ALTER TABLE personal_map_cameras
  ADD COLUMN IF NOT EXISTS fog_png TEXT;
