import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  SCRAPED_CATALOG_CLEANUP_MIGRATIONS,
  SCRAPED_CATALOG_CLEANUP_REPORT_QUERIES,
  PUBLIC_ADVERSARY_LIST_SQL,
} from '../../src/scraped-catalog-cleanup.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('scraped catalog cleanup report', () => {
  it('covers both startup migrations', () => {
    expect(SCRAPED_CATALOG_CLEANUP_MIGRATIONS).toEqual([
      '041_remove_fcg_hod_catalogs.sql',
      '042_delete_public_adversaries.sql',
    ]);
    for (const file of SCRAPED_CATALOG_CLEANUP_MIGRATIONS) {
      const sql = readFileSync(join(root, 'migrations', file), 'utf8');
      expect(sql).toMatch(/DELETE FROM/i);
    }
  });

  it('report predicates match the migration files', () => {
    const m041 = readFileSync(join(root, 'migrations/041_remove_fcg_hod_catalogs.sql'), 'utf8');
    const m042 = readFileSync(join(root, 'migrations/042_delete_public_adversaries.sql'), 'utf8');
    const keys = SCRAPED_CATALOG_CLEANUP_REPORT_QUERIES.map((q) => q.key);
    expect(keys).toEqual([
      'fcgCatalog',
      'hodFcgCache',
      'scrapedMirrors',
      'publicFcgHodClones',
      'publicScenesAdventuresEmbedding',
      'fcgHodPopularity',
      'hodFcgSyncState',
      'publicAdversaries',
    ]);
    expect(m041).toContain("__FCG_PUBLIC__");
    expect(m041).toContain("source IN ('hod', 'fcg')");
    expect(m041).toContain("user_id = '__MIRROR__'");
    expect(m042).toContain("collection = 'adversaries'");
    expect(m042).toContain('is_public = true');
    expect(PUBLIC_ADVERSARY_LIST_SQL).toContain("collection = 'adversaries'");
  });
});
