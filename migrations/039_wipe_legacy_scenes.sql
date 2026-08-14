-- Wipe legacy scene rows. Old scenes used an incompatible nested-reference
-- shape (nested scenes plus adversary/environment id-refs or inline copies)
-- and are intentionally not migrated to the new self-contained table-like blob.
DELETE FROM items WHERE collection = 'scenes';
