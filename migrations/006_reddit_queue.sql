-- Clean slate: remove all existing Reddit mirror rows so the scanner starts fresh.
DELETE FROM items
  WHERE user_id = '__MIRROR__' AND data->>'_source' = 'reddit';

-- Clear blocked Reddit posts — scanner dedup/tagging replaces this mechanism.
DELETE FROM blocked_reddit_posts;

-- Partial index for all Reddit mirror queries (queue counts, paginated fetches, library source).
CREATE INDEX IF NOT EXISTS items_reddit_mirror_idx
  ON items (app_id, collection)
  WHERE user_id = '__MIRROR__' AND (data->>'_source') = 'reddit';
