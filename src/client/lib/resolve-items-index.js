/**
 * After `resolveItems(..., { adopt: true })`, cloned adversaries/environments get new
 * `id`s but retain `_clonedFrom` pointing at the catalog/source id. Index by both so
 * callers can look up by plan row id (e.g. `srd-adv-*`).
 * @param {object[]|undefined} items
 * @returns {Record<string, object>}
 */
export function indexResolvedItemsByRequestId(items) {
  /** @type {Record<string, object>} */
  const m = Object.create(null);
  for (const item of items || []) {
    if (!item) continue;
    m[item.id] = item;
    if (item._clonedFrom) m[item._clonedFrom] = item;
  }
  return m;
}
