import { describe, it, expect } from 'vitest';
import { scrapedCatalogPublicExcludeSql } from '../../src/scraped-catalog-exclude.js';

describe('scrapedCatalogPublicExcludeSql', () => {
  it('excludes the legacy FCG owner and fcg-/hod- ids', () => {
    const sql = scrapedCatalogPublicExcludeSql();
    expect(sql).toContain("user_id <> '__FCG_PUBLIC__'");
    expect(sql).toContain("id NOT LIKE 'fcg-%'");
    expect(sql).toContain("id NOT LIKE 'hod-%'");
  });

  it('prefixes columns when an alias is given', () => {
    const sql = scrapedCatalogPublicExcludeSql('i');
    expect(sql).toBe("i.user_id <> '__FCG_PUBLIC__' AND i.id NOT LIKE 'fcg-%' AND i.id NOT LIKE 'hod-%'");
  });
});
