import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const MIGRATION_SQL = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../migrations/042_delete_public_adversaries.sql'),
  'utf8',
);

describe('migration 042 SQL content', () => {
  it('deletes public adversaries only', () => {
    expect(MIGRATION_SQL).toMatch(/DELETE FROM items/i);
    expect(MIGRATION_SQL).toMatch(/collection = 'adversaries'/);
    expect(MIGRATION_SQL).toMatch(/is_public = true/);
    expect(MIGRATION_SQL).not.toMatch(/is_public = false/);
  });
});
