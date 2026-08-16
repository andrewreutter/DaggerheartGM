import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('ItemCard leftover enrich state', () => {
  it('does not reference removed isEnriching (page-load ReferenceError)', () => {
    const src = readFileSync(join(root, 'src/client/components/ItemCard.jsx'), 'utf8');
    expect(src).not.toMatch(/\bisEnriching\b/);
  });
});
