-- Add a status column to dice_rolls to support the server-authoritative banner queue.
-- 'pending'      = waiting for GM acknowledgement (default)
-- 'acknowledged' = GM dismissed with effects applied
-- 'cancelled'    = GM dismissed without effects
ALTER TABLE dice_rolls ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Migrate existing data from the legacy acked boolean column
UPDATE dice_rolls SET status = 'acknowledged' WHERE acked = true AND status = 'pending';

-- Stale unacknowledged rolls older than 24 hours are no longer actionable
UPDATE dice_rolls SET status = 'cancelled'    WHERE acked = false AND status = 'pending'
  AND created_at < now() - interval '24 hours';
