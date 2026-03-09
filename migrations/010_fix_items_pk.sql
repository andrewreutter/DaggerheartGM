-- Fix the items table primary key to include user_id.
-- The original PK (app_id, collection, id) was missing user_id, which caused
-- any user's table_state save to overwrite any other user's table_state row
-- (since all users save their table_state with id='current').
ALTER TABLE items DROP CONSTRAINT items_pkey;
ALTER TABLE items ADD PRIMARY KEY (app_id, user_id, collection, id);
