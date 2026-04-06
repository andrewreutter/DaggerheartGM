function buildLibraryQueryString({ search = '', semantic = '', c = '' } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (semantic) params.set('semantic', semantic);
  if (c) params.set('c', c);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * URL path for a library browse tab, optionally preserving search / semantic query state.
 *
 * @param {string} tab — current library route tab (`all`, `adversaries`, …)
 * @param {{ search?: string, semantic?: string, c?: string }} [opts]
 */
export function buildLibraryBrowsePath(tab, opts = {}) {
  return `/library/${tab}${buildLibraryQueryString(opts)}`;
}

/**
 * URL path for a library item modal. On the merged **All** tab, use `/library/all/:id`
 * so the route `tab` stays `all` (sidebar highlight). Otherwise use the item’s collection
 * in the path (same as browsing that collection).
 *
 * @param {string} activeTab — current library route tab (`all`, `adversaries`, …)
 * @param {string} itemCollection — `item._collection` or fallback tab when absent
 * @param {string} [itemId] — item id, or `'new'` when omitted
 * @param {{ search?: string, semantic?: string, c?: string }} [opts]
 */
export function buildLibraryModalPath(activeTab, itemCollection, itemId = 'new', opts = {}) {
  const urlTab = activeTab === 'all' ? 'all' : itemCollection;
  return `/library/${urlTab}/${itemId}${buildLibraryQueryString(opts)}`;
}
