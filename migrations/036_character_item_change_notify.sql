-- Trigger function that fires pg_notify('character_item_changed', ...) whenever a `characters`
-- row in the `items` table is inserted, updated, or deleted.
--
-- Unlike table_state, a character library row doesn't know which table(s) it's placed on, so this
-- notification only carries the character's id — subscribers treat it as "invalidate this
-- character id, then re-push every currently-subscribed table_state key" (see subscriptions.js).
--
-- Without this, each server process's own in-memory characterLibraryCache (src/db.js) is only
-- invalidated on the replica that happened to handle the write (see invalidateCharacterLibraryCache
-- calls in upsertItem/deleteItem). Any other replica serving a live SSE table_state subscription
-- for a table that references this character keeps stale character data (name/stats/image) until
-- it happens to handle a write for that same character itself — this is what caused images (and
-- any other character field) to appear only after an action that resaved the character on the
-- "right" replica, and to revert on reload or on the next unrelated table_state-triggered re-push.

CREATE OR REPLACE FUNCTION notify_character_item_change()
RETURNS TRIGGER AS $$
DECLARE
  v_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_id := OLD.id;
  ELSE
    v_id := NEW.id;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.collection = 'characters') OR
     (TG_OP != 'DELETE' AND NEW.collection = 'characters') THEN
    PERFORM pg_notify(
      'character_item_changed',
      json_build_object('id', v_id)::text
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_character_after_change ON items;

CREATE TRIGGER items_character_after_change
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH ROW
EXECUTE FUNCTION notify_character_item_change();
