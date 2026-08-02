-- T5/T6: Billing customers table.
-- Tracks per-user Stripe customer ID and free-trial state.
-- free_trial_started_at/free_trial_table_id are set atomically via
--   UPDATE ... WHERE free_trial_started_at IS NULL RETURNING *
-- to prevent TOCTOU races (T6).
CREATE TABLE IF NOT EXISTS billing_customers (
  app_id                TEXT        NOT NULL,
  user_id               TEXT        NOT NULL,
  stripe_customer_id    TEXT,
  free_trial_started_at TIMESTAMPTZ,
  free_trial_table_id   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, user_id)
);

CREATE INDEX IF NOT EXISTS billing_customers_stripe_idx
  ON billing_customers (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
