import { useState } from 'react';
import { X } from 'lucide-react';
import { ImportPreviewCard } from './ImportPreviewCard.jsx';

/**
 * Hook for managing the selectedIds Set used by both import modals.
 * Returns { selectedIds, setSelectedIds, toggleId }.
 */
export function useImportSelection() {
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const toggleId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return { selectedIds, setSelectedIds, toggleId };
}

/**
 * Shared modal chrome: overlay, rounded panel, header (title + close), scrollable body, footer.
 * Props: title, onClose, children (body content), footer (footer JSX).
 */
export function ImportModalShell({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
        <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

/**
 * Success step shown after import completes.
 * Props: importedItems, onImportSuccess, onClose, colorScheme ('red' | 'green').
 */
export function ImportSuccessStep({ importedItems, onImportSuccess, onClose, colorScheme = 'red' }) {
  const hoverClass = colorScheme === 'green' ? 'group-hover:text-green-400' : 'group-hover:text-red-400';
  return (
    <div className="space-y-4">
      <p className="text-green-400 font-medium">Import complete! The following items were created:</p>
      <div className="space-y-2">
        {importedItems.map(item => (
          <button
            key={`${item.collection}-${item.id}`}
            onClick={() => { onImportSuccess(item.collection, item.id); onClose(); }}
            className="w-full text-left bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-lg p-3 flex items-center justify-between group transition-colors"
          >
            <span className={`text-white font-medium text-sm ${hoverClass}`}>{item.name}</span>
            <span className="text-xs text-slate-500 capitalize">{item.collection.replace(/s$/, '')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Section heading + list of ImportPreviewCards for one collection.
 * Props:
 *   label        - section heading text (count appended automatically)
 *   items        - array of items to display
 *   collection   - 'adversaries' | 'environments' | 'scenes' | 'groups'
 *   existingItems - library items for duplicate detection
 *   selectedIds  - Set of selected item IDs
 *   onToggleId   - (id) => void
 *   onUpdateItem - (updatedItem) => void — called with full updated item
 *   colorScheme  - 'red' | 'green'
 *   renderCard   - optional (item) => JSX override for custom card rendering
 */
export function ImportPreviewSection({
  label,
  items,
  collection,
  existingItems,
  selectedIds,
  onToggleId,
  onUpdateItem,
  colorScheme,
  renderCard = null,
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-800 pb-1">
        {label} ({items.length})
      </h3>
      <div className="space-y-2">
        {items.map(item =>
          renderCard ? renderCard(item) : (
            <ImportPreviewCard
              key={item.id}
              item={item}
              collection={collection}
              existingItems={existingItems}
              selected={selectedIds.has(item.id)}
              onToggleSelect={() => onToggleId(item.id)}
              onUpdate={onUpdateItem}
              colorScheme={colorScheme}
            />
          )
        )}
      </div>
    </div>
  );
}

/**
 * "Will create: ..." summary line shown at the bottom of the preview step.
 */
export function ImportPreviewSummary({ summaryParts }) {
  return (
    <div className="text-xs text-slate-500 bg-slate-950 rounded-lg p-3 border border-slate-800">
      Will create: {summaryParts || 'nothing selected'}
    </div>
  );
}
