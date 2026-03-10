CREATE TABLE IF NOT EXISTS dice_rolls (
  id SERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  gm_uid TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dice_rolls_room
  ON dice_rolls (app_id, gm_uid, created_at DESC);
