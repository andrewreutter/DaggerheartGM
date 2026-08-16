/**
 * Resolve `/library/:tab/:itemId` against the current library list.
 *
 * LibraryView stays mounted (hidden) on the Game Table, so paginated search
 * results can be stale. A just-saved Scene is often already in `data.scenes`
 * (saveItem optimistic bag) but missing from `search.items`. Treating that as
 * "deleted" used to rewrite the URL to the list and skip a refresh — the new
 * Scene only appeared after a full reload.
 *
 * @param {object} opts
 * @param {string|null|undefined} opts.itemId
 * @param {Array<{ id?: string }>} [opts.items] currently displayed search/list rows
 * @param {Array<{ id?: string }>} [opts.fallbackItems] app-level bag (e.g. data.scenes)
 * @param {boolean} [opts.loading]
 * @param {boolean} [opts.isPaginated]
 * @param {boolean} [opts.refreshAttempted] we already kicked a search.refresh() for this id
 * @param {string|null} [opts.modalItemId] item already held in modalState
 * @param {boolean} [opts.nonPaginatedReady] non-paginated tab has finished its first load
 * @returns {{ action: 'ignore'|'open'|'open-and-refresh'|'wait'|'refresh'|'keep-modal'|'leave', item?: object }}
 */
export function resolveLibraryItemDeepLink({
  itemId,
  items = [],
  fallbackItems = [],
  loading = false,
  isPaginated = false,
  refreshAttempted = false,
  modalItemId = null,
  nonPaginatedReady = true,
} = {}) {
  if (!itemId || itemId === 'new') return { action: 'ignore' };

  const fromList = items.find((i) => i.id === itemId);
  if (fromList) return { action: 'open', item: fromList };

  const fromFallback = fallbackItems.find((i) => i.id === itemId);
  if (fromFallback) return { action: 'open-and-refresh', item: fromFallback };

  if (loading) return { action: 'wait' };
  if (!isPaginated && !nonPaginatedReady) return { action: 'wait' };
  if (isPaginated && !refreshAttempted) return { action: 'refresh' };
  if (modalItemId === itemId) return { action: 'keep-modal' };
  return { action: 'leave' };
}
