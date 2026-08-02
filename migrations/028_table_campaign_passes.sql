-- T21: Campaign pass tables.
-- table_campaign_passes: single source of truth for table liveness.
--   paid_through_at is extended by max(now(), paid_through_at) + N months on each purchase
--   so consecutive purchases stack.
-- table_campaign_pass_purchases: append-only purchase history (unique on Stripe session ID for
--   webhook dedup). purchased_by_user_id recorded for gift attribution only, never read by any
--   entitlement check (entitlement is keyed by table_id, not purchaser).
CREATE TABLE IF NOT EXISTS table_campaign_passes (
  app_id               TEXT        NOT NULL,
  table_id             TEXT        NOT NULL,
  paid_through_at      TIMESTAMPTZ,
  lifetime_cents_total INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, table_id)
);

CREATE TABLE IF NOT EXISTS table_campaign_pass_purchases (
  id                          SERIAL      PRIMARY KEY,
  app_id                      TEXT        NOT NULL,
  table_id                    TEXT        NOT NULL,
  purchased_by_user_id        TEXT        NOT NULL,
  stripe_checkout_session_id  TEXT        NOT NULL,
  stripe_event_id             TEXT,
  months                      INTEGER     NOT NULL CHECK (months IN (3, 6, 12)),
  amount_cents                INTEGER     NOT NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stripe_checkout_session_id)
);

CREATE INDEX IF NOT EXISTS tcp_purchases_table_idx
  ON table_campaign_pass_purchases (app_id, table_id);
