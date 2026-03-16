-- Postgres LISTEN/NOTIFY trigger for dice_rolls table.
-- Fires pg_notify('dice_rolls_changed', '{"gm_uid":"..."}') on any INSERT/UPDATE/DELETE.
-- Used by the SubscriptionManager in src/subscriptions.js to push live banner snapshots
-- to all connected SSE clients without bespoke per-event broadcasts.

CREATE OR REPLACE FUNCTION notify_dice_rolls_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'dice_rolls_changed',
    json_build_object('gm_uid', COALESCE(NEW.gm_uid, OLD.gm_uid))::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dice_rolls_after_change ON dice_rolls;

CREATE TRIGGER dice_rolls_after_change
  AFTER INSERT OR UPDATE OR DELETE ON dice_rolls
  FOR EACH ROW EXECUTE FUNCTION notify_dice_rolls_change();
