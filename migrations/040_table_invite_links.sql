-- Table invite links: reusable join tokens (at most one active link per table).
-- playerEmails on table_state remains the membership source of truth; this table
-- only stores the token the GM shares. Redeeming appends the redeemer's email.
CREATE TABLE IF NOT EXISTS table_invite_links (
  app_id         TEXT        NOT NULL,
  token          TEXT        NOT NULL,
  table_id       TEXT        NOT NULL,
  created_by_uid TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ,
  PRIMARY KEY (app_id, token)
);

-- At most one active (non-revoked) invite link per table.
CREATE UNIQUE INDEX IF NOT EXISTS table_invite_links_active_table_idx
  ON table_invite_links (app_id, table_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS table_invite_links_table_idx
  ON table_invite_links (app_id, table_id);
