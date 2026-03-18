-- Update trigger to notify with table_id (the row's id) so the subscription
-- manager can use tableId as the sole key.

CREATE OR REPLACE FUNCTION notify_table_state_change()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_table_id := OLD.id;
  ELSE
    v_table_id := NEW.id;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.collection = 'table_state') OR
     (TG_OP != 'DELETE' AND NEW.collection = 'table_state') THEN
    PERFORM pg_notify(
      'table_state_changed',
      json_build_object('table_id', v_table_id)::text
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
