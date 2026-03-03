import { AlertTriangle } from 'lucide-react';

/**
 * Preview card for import / queue items.
 *
 * Shows a collapsed summary of the item. Clicking the edit (pencil) button fires
 * onEditDetail so the parent can open ItemDetailModal stacked on top of the import
 * shell for the full side-by-side editing experience.
 *
 * Props:
 *   item             - the item object (must have .id and .name)
 *   collection       - 'adversaries' | 'environments' | 'scenes'
 *   existingItems    - items already in the library, used for name-based duplicate detection
 *   selected         - whether this item is checked for import
 *   onToggleSelect   - called when the checkbox changes
 *   onUpdate         - called with the full updated item when edited (unused here, kept for compatibility)
 *   onEditDetail     - called when the user clicks the edit button (opens stacked ItemDetailModal)
 *   colorScheme      - 'red' | 'green'
 *   summaryContent   - optional React node to override the collapsed summary line
 *   replaceMode      - when true, import will overwrite the existing item instead of creating a new one
 *   onToggleReplace  - called when the user toggles between "Add as new" and "Replace existing"
 */
export function ImportPreviewCard({
  item,
  collection,
  existingItems = [],
  selected,
  onToggleSelect,
  onUpdate,
  onEditDetail = null,
  colorScheme = 'red',
  summaryContent = null,
  replaceMode = false,
  onToggleReplace = () => {},
}) {
  const duplicate = existingItems.find(
    e => e.name.trim().toLowerCase() === item.name.trim().toLowerCase()
  );

  const accentColor = colorScheme === 'green' ? '#22c55e' : '#ef4444';

  const defaultSummary = (
    <>
      {collection === 'adversaries' && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 leading-relaxed">
          <span className="capitalize">{item.role} · Tier {item.tier}</span>
          <span>
            DC {item.difficulty} · HP {item.hp_max} · Thresholds {item.hp_thresholds?.major}/{item.hp_thresholds?.severe} · Stress {item.stress_max}
          </span>
          {item.attack?.name && (
            <span>
              ⚔ {item.attack.name}: {item.attack.modifier >= 0 ? '+' : ''}{item.attack.modifier} {item.attack.range} | {item.attack.damage}
            </span>
          )}
          {(item.features?.length > 0 || item.experiences?.length > 0) && (
            <span>{item.features?.length || 0} feature(s) · {item.experiences?.length || 0} experience(s)</span>
          )}
        </div>
      )}
      {collection === 'environments' && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <span className="capitalize">Tier {item.tier} {item.type}</span>
          {item.difficulty != null && (
            <span>DC <strong className="text-slate-200">{item.difficulty}</strong></span>
          )}
          {item.features?.length > 0 && <span>{item.features.length} feature(s)</span>}
          {item.description && <span className="italic opacity-75 line-clamp-1">{item.description}</span>}
        </div>
      )}
      {collection === 'scenes' && (
        <span className="italic opacity-75">{item.description || 'Auto-generated'}</span>
      )}
    </>
  );

  const clickable = !!onEditDetail;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-opacity ${
        selected
          ? 'border-slate-700 bg-slate-950'
          : 'border-slate-800/50 bg-slate-900/10 opacity-40'
      } ${clickable ? 'cursor-pointer' : ''}`}
      onClick={clickable ? () => onEditDetail(item) : undefined}
    >
      <div className={`p-3 flex items-start gap-2.5 ${clickable ? 'hover:bg-white/[0.03] transition-colors' : ''}`}>
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="mt-0.5 flex-shrink-0 cursor-pointer"
            style={{ accentColor }}
          />
        )}

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`font-semibold text-sm ${selected ? 'text-white' : 'text-slate-500'}`}>
              {item.name || '(unnamed)'}
            </span>

            {collection === 'adversaries' && onToggleSelect && (
              <div
                className="flex items-center gap-1 text-xs text-slate-400"
                onClick={e => e.stopPropagation()}
              >
                <span>×</span>
                <input
                  type="number"
                  min="1"
                  value={item.count ?? 1}
                  onChange={e => onUpdate?.({ ...item, count: parseInt(e.target.value) || 1 })}
                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-white text-center text-xs outline-none"
                />
              </div>
            )}

            {duplicate && (
              <>
                <span className="flex items-center gap-1 text-[10px] bg-yellow-900/40 border border-yellow-700/60 text-yellow-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  <AlertTriangle size={9} /> Possible duplicate: &quot;{duplicate.name}&quot;
                </span>
                {selected && onToggleSelect && (
                  <div
                    className="flex items-center text-[10px] rounded-full border border-slate-700 overflow-hidden flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => replaceMode && onToggleReplace()}
                      className={`px-2 py-0.5 transition-colors ${
                        !replaceMode
                          ? 'bg-slate-700 text-slate-200'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Add as new
                    </button>
                    <button
                      onClick={() => !replaceMode && onToggleReplace()}
                      className={`px-2 py-0.5 border-l border-slate-700 transition-colors ${
                        replaceMode
                          ? 'bg-yellow-900/60 text-yellow-300'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      Replace existing
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Summary */}
          <div className="text-xs text-slate-400">
            {summaryContent ?? defaultSummary}
          </div>
        </div>
      </div>
    </div>
  );
}
