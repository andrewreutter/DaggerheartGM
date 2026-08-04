-- Adds a "mark complete" workflow to bug reports (admin Problem reports page).
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS resolved_by TEXT;

CREATE INDEX IF NOT EXISTS bug_reports_resolved_idx
  ON bug_reports (app_id, resolved_at);
