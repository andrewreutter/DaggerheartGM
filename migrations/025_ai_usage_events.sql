-- LLM / image provider usage metrics for admin dashboard (no prompts stored).
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id                    BIGSERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  app_id                TEXT NOT NULL,
  builder               TEXT NOT NULL,
  provider              TEXT NOT NULL CHECK (provider IN ('openai', 'xai')),
  model                 TEXT,
  prompt_tokens         INTEGER,
  completion_tokens     INTEGER,
  cached_prompt_tokens  INTEGER,
  total_tokens          INTEGER,
  latency_ms            INTEGER,
  ok                    BOOLEAN NOT NULL,
  error_code            TEXT,
  request_id            TEXT
);

CREATE INDEX IF NOT EXISTS ai_usage_events_app_created_idx
  ON ai_usage_events (app_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_events_app_builder_created_idx
  ON ai_usage_events (app_id, builder, created_at DESC);
