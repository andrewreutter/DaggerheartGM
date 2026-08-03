-- T7: Stripe webhook event dedup table.
-- ON CONFLICT DO NOTHING on (app_id, stripe_event_id) ensures each Stripe event
-- is processed exactly once, even with Stripe retries.
CREATE TABLE IF NOT EXISTS stripe_processed_events (
  app_id          TEXT        NOT NULL,
  stripe_event_id TEXT        NOT NULL,
  event_type      TEXT        NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, stripe_event_id)
);
