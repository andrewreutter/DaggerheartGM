-- Remove legacy __SRD__ rows. SRD content is now served from the in-memory
-- SRD sub-application (src/srd/) instead of being stored in the database.
DELETE FROM items WHERE user_id = '__SRD__';
