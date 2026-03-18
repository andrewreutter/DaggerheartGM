-- Rename primary table_state row id from 'current' to user_id so all tableIds
-- are globally unique (primary = gmUid, secondary = uuid).

UPDATE items
SET id = user_id
WHERE collection = 'table_state' AND id = 'current';
