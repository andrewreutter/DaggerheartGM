/**
 * URL path for a library item modal. On the merged **All** tab, use `/library/all/:id`
 * so the route `tab` stays `all` (sidebar highlight). Otherwise use the item’s collection
 * in the path (same as browsing that collection).
 *
 * @param {string} activeTab — current library route tab (`all`, `adversaries`, …)
 * @param {string} itemCollection — `item._collection` or fallback tab when absent
 * @param {string} [itemId] — item id, or `'new'` when omitted
 */
export function buildLibraryModalPath(activeTab, itemCollection, itemId = 'new') {
  const urlTab = activeTab === 'all' ? 'all' : itemCollection;
  return `/library/${urlTab}/${itemId}`;
}
