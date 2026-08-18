import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus } from 'lucide-react';
import { useCollectionSearch } from '../../lib/useCollectionSearch.js';
import { LibrarySearchField } from '../CollectionFilters.jsx';
import { LIBRARY_DEFAULT_INCLUDES } from '../../lib/library-default-filters.js';
import { DH_OUTSIDE_DISMISS_EXEMPT_ATTR } from '../../lib/useHoverOverlay.js';
import { PICKER_COUNT_MIN, PICKER_COUNT_MAX } from '../../lib/item-picker-selection.js';
import {
  toggleLibraryInventorySelection,
  addCustomInventorySelection,
  removeInventorySelection,
  setInventorySelectionCount,
  inventorySelectionTotalCount,
  inventorySelectionToEntries,
  libraryInventorySelectionKey,
} from '../../lib/inventory-item-picker.js';

const TABS = [
  { id: 'weapons', label: 'Weapons' },
  { id: 'armor', label: 'Armor' },
  { id: 'items', label: 'Items' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'custom', label: 'Custom' },
];

const PICKER_DEFAULT_FILTERS = { includes: [...LIBRARY_DEFAULT_INCLUDES] };

/**
 * Game Table inventory picker: Mine+SRD library tabs plus a free-text Custom tab.
 * Clicking library rows (or adding a custom name) accumulates a footer basket;
 * Apply confirms one inventory entry per chip `{ uid, name, quantity, id?, refCollection? }`.
 */
export function InventoryItemPickerModal({ onClose, onConfirm }) {
  const [tab, setTab] = useState('items');
  const [customName, setCustomName] = useState('');
  const [selected, setSelected] = useState([]);
  const collection = tab === 'custom' ? 'items' : tab;
  const search = useCollectionSearch(collection, {
    limit: 40,
    enabled: tab !== 'custom',
    infinite: true,
    persistKey: null,
    defaultFilters: PICKER_DEFAULT_FILTERS,
  });
  const resultsRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = resultsRef.current;
    if (!sentinel || !container || !search.hasMore || !search.loadMore || search.isLoadingMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) search.loadMore(); },
      { root: container, rootMargin: '150px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [search.hasMore, search.isLoadingMore, search.loadMore]);

  const items = useMemo(() => search.items || [], [search.items]);
  const selectedByKey = useMemo(() => {
    const map = new Map();
    for (const row of selected) map.set(row.key, row);
    return map;
  }, [selected]);
  const addCount = useMemo(() => inventorySelectionTotalCount(selected), [selected]);

  const commitSelection = useCallback(() => {
    if (!selected.length) return;
    onConfirm?.(inventorySelectionToEntries(selected));
    onClose();
  }, [selected, onConfirm, onClose]);

  const addCustomToSelection = useCallback(() => {
    const name = customName.trim();
    if (!name) return;
    setSelected((prev) => addCustomInventorySelection(prev, name));
    setCustomName('');
  }, [customName]);

  if (typeof document === 'undefined') return null;

  const modal = (
    <div
      className="fixed inset-0 z-[80] bg-black/70 flex items-start justify-center p-4 pt-24"
      onClick={onClose}
      {...{ [DH_OUTSIDE_DISMISS_EXEMPT_ATTR]: '' }}
    >
      <div
        className="bg-dh-surface border border-dh-border rounded-xl shadow-2xl w-full max-w-xl max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dh-border shrink-0">
          <h2 className="font-bold text-white text-lg">Add inventory items</h2>
          <button type="button" tabIndex={0} onClick={onClose} className="text-dh-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-dh-border shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              tabIndex={0}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-semibold shrink-0 transition-colors ${
                tab === t.id
                  ? 'text-dh border-b-2 border-sky-500'
                  : 'text-dh-muted hover:text-dh'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'custom' ? (
          <div className="p-5 space-y-3 shrink-0">
            <label className="block space-y-1">
              <span className="text-[11px] text-dh-muted uppercase tracking-wide">Name</span>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomToSelection(); }}
                placeholder="Custom item"
                className="w-full bg-dh-raised border border-dh-border rounded px-2 py-1.5 text-sm text-dh placeholder-dh-muted focus:outline-none focus:border-dh-strong"
              />
            </label>
            <button
              type="button"
              onClick={addCustomToSelection}
              disabled={!customName.trim()}
              className="w-full py-2 rounded bg-sky-800 text-sky-100 text-sm font-semibold hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add to selection
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-dh-border shrink-0">
              <LibrarySearchField
                collection={collection}
                value={search.filters.search}
                onChange={(v) => search.setFilter('search', v)}
              />
            </div>
            <div ref={resultsRef} className="flex-1 overflow-y-auto min-h-0">
              {search.loading && !items.length && (
                <p className="px-5 py-4 text-xs text-dh-muted">Loading…</p>
              )}
              {!search.loading && !items.length && (
                <p className="px-5 py-4 text-xs text-dh-muted">No items found.</p>
              )}
              {items.map((item) => {
                const key = libraryInventorySelectionKey(tab, item.id);
                const isPicked = selectedByKey.has(key);
                return (
                  <button
                    key={item.id}
                    type="button"
                    tabIndex={0}
                    aria-pressed={isPicked}
                    onClick={() => setSelected((prev) => toggleLibraryInventorySelection(prev, tab, item))}
                    className={`w-full text-left px-5 py-2 border-b border-dh-border/60 transition-colors ${
                      isPicked ? 'bg-amber-950/40 hover:bg-amber-950/55' : 'hover:bg-dh-inset'
                    }`}
                  >
                    <span className="text-sm text-dh">{item.name}</span>
                  </button>
                );
              })}
              <div ref={sentinelRef} className="h-2" />
              {search.isLoadingMore && (
                <p className="px-5 py-2 text-[11px] text-dh-muted">Loading more…</p>
              )}
            </div>
          </>
        )}

        {tab === 'custom' && <div className="flex-1 min-h-0" />}

        <div className="shrink-0 border-t border-dh-border px-5 py-3 flex items-center gap-3 min-w-0">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 w-max min-h-[2rem]">
              {selected.map((row) => {
                const name = row.item?.name || 'Untitled';
                return (
                  <span
                    key={row.key}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-700/50 bg-amber-950/50 pl-2.5 pr-1 py-0.5 text-xs text-amber-100"
                  >
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => setSelected((prev) => removeInventorySelection(prev, row.key))}
                      className="inline-flex items-center gap-1 hover:text-white max-w-[12rem]"
                      aria-label={`Remove ${name}`}
                    >
                      <span className="truncate">{name}</span>
                      <X size={12} className="shrink-0 opacity-70" />
                    </button>
                    <span
                      className="inline-flex items-center gap-0.5 pl-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        tabIndex={0}
                        disabled={row.count <= PICKER_COUNT_MIN}
                        onClick={() => setSelected((prev) => setInventorySelectionCount(prev, row.key, row.count - 1))}
                        className="w-5 h-5 rounded-full border border-amber-800/60 text-amber-100 hover:bg-amber-900/70 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                        aria-label={`Decrease ${name} quantity`}
                      >
                        <Minus size={10} />
                      </button>
                      <input
                        type="number"
                        min={PICKER_COUNT_MIN}
                        max={PICKER_COUNT_MAX}
                        value={row.count}
                        aria-label={`${name} quantity`}
                        onChange={(e) => setSelected((prev) => setInventorySelectionCount(prev, row.key, e.target.value))}
                        className="w-8 h-5 bg-transparent border-0 text-center text-[11px] text-amber-50 tabular-nums outline-none"
                      />
                      <button
                        type="button"
                        tabIndex={0}
                        disabled={row.count >= PICKER_COUNT_MAX}
                        onClick={() => setSelected((prev) => setInventorySelectionCount(prev, row.key, row.count + 1))}
                        className="w-5 h-5 rounded-full border border-amber-800/60 text-amber-100 hover:bg-amber-900/70 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                        aria-label={`Increase ${name} quantity`}
                      >
                        <Plus size={10} />
                      </button>
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            tabIndex={0}
            disabled={addCount < 1}
            onClick={commitSelection}
            className="shrink-0 px-4 py-2 rounded-md text-sm font-semibold bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {addCount < 1
              ? 'Add items'
              : `Add ${addCount} ${addCount === 1 ? 'item' : 'items'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
