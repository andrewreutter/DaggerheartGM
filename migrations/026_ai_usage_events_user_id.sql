-- T4: Add user_id to ai_usage_events for per-user AI cost tracking and metering.
ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS user_id TEXT;
-- T8: includes created_at so the monthly cap check (WHERE app_id, user_id, ok=true, created_at >= month_start)
-- can range-scan the index directly instead of filtering created_at row-by-row after an (app_id, user_id) lookup.
CREATE INDEX IF NOT EXISTS ai_usage_events_user_month_idx ON ai_usage_events (app_id, user_id, created_at) WHERE user_id IS NOT NULL;
