-- Replaces the boolean resolved/unresolved split on bug_reports with a `status` field so
-- Problem reports can be triaged into Triage / Bug / Feature / Completed and moved between
-- any of those in a single click (admin Problem reports page).
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'triage';

UPDATE bug_reports SET status = 'completed' WHERE resolved_at IS NOT NULL;

ALTER TABLE bug_reports RENAME COLUMN resolved_at TO status_changed_at;
ALTER TABLE bug_reports RENAME COLUMN resolved_by TO status_changed_by;

DROP INDEX IF EXISTS bug_reports_resolved_idx;
CREATE INDEX IF NOT EXISTS bug_reports_status_idx
  ON bug_reports (app_id, status, created_at DESC);
