-- Faster index for Reddit queue pagination queries.
-- Filters to reddit mirrors, includes _redditStatus (used in WHERE) and
-- created_at DESC (used in ORDER BY) so the planner can do an index scan
-- in sorted order without a separate sort step.
CREATE INDEX IF NOT EXISTS items_reddit_queue_idx
  ON items (app_id, (data->>'_redditStatus'), created_at DESC)
  WHERE user_id = '__MIRROR__' AND (data->>'_source') = 'reddit';
