import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIGRATION_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../migrations/043_scenes_source_dt.sql'),
  'utf8',
);

describe('migration 043 SQL content', () => {
  it('copies leftover srd scene cache rows to dt then deletes srd leftovers', () => {
    expect(MIGRATION_SQL).toMatch(/INSERT INTO external_item_cache/i);
    expect(MIGRATION_SQL).toMatch(/SELECT app_id, 'dt', collection, external_id/);
    expect(MIGRATION_SQL).toMatch(/jsonb_set\(COALESCE\(data, '\{\}'::jsonb\), '\{_source\}', '"dt"'\)/);
    expect(MIGRATION_SQL).toMatch(/WHERE collection = 'scenes' AND source = 'srd'/);
    expect(MIGRATION_SQL).toMatch(/ON CONFLICT DO NOTHING/);
    expect(MIGRATION_SQL).toMatch(/DELETE FROM external_item_cache/);
    expect(MIGRATION_SQL).toMatch(/WHERE collection = 'scenes' AND source = 'srd'/);
  });
});
