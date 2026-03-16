-- Trigger function that fires pg_notify('table_state_changed', ...) whenever
-- a table_state row in the items table is inserted, updated, or deleted.
-- This allows the SubscriptionManager to push live snapshots to all connected
-- clients without requiring explicit notifyChange() calls in every code path.

CREATE OR REPLACE FUNCTION notify_table_state_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.collection = 'table_state') OR
     (TG_OP != 'DELETE' AND NEW.collection = 'table_state') THEN
    PERFORM pg_notify(
      'table_state_changed',
      json_build_object('gm_uid', v_user_id)::text
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_table_state_after_change ON items;

CREATE TRIGGER items_table_state_after_change
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH ROW
EXECUTE FUNCTION notify_table_state_change();
