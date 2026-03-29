CREATE TABLE IF NOT EXISTS user_preferences (
  app_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_preferences_user_idx ON user_preferences (user_id);
