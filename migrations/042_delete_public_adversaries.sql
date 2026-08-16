-- Delete leftover public adversaries (OCR/import junk). Private Mine copies stay.

DELETE FROM item_popularity
WHERE collection = 'adversaries'
  AND item_id IN (
    SELECT id FROM items
    WHERE collection = 'adversaries' AND is_public = true
  );

DELETE FROM items
WHERE collection = 'adversaries'
  AND is_public = true;
