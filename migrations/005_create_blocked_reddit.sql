CREATE TABLE IF NOT EXISTS blocked_reddit_posts (
  app_id         TEXT        NOT NULL,
  reddit_post_id TEXT        NOT NULL,
  blocked_by     TEXT        NOT NULL,
  blocked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, reddit_post_id)
);
