/**
 * SQL predicate (no leading AND) that excludes leftover FCG/HoD catalog rows
 * from Public / community listings. Used even after migration 041 so a restored
 * backup cannot re-list scraped catalogs.
 *
 * @param {string} [alias]
 */
export function scrapedCatalogPublicExcludeSql(alias = '') {
  const c = alias ? `${alias}.` : '';
  return `${c}user_id <> '__FCG_PUBLIC__' AND ${c}id NOT LIKE 'fcg-%' AND ${c}id NOT LIKE 'hod-%'`;
}
