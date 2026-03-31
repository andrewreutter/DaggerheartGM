import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';

/**
 * Collapsible card for import preview items.
 *
 * Uses controlled mode for AdversaryForm/EnvironmentForm so edits propagate
 * immediately — the card header updates in real-time and collapsing/expanding
 * preserves all changes.
 *
 * Props:
 *   item             - the item object (must have .id and .name)
 *   collection       - 'adversaries' | 'environments' | 'scenes'
 *   existingItems    - items already in the library, used for name-based duplicate detection
 *   selected         - whether this item is checked for import
 *   onToggleSelect   - called when the checkbox changes
 *   onUpdate         - called with the full updated item when edited
 *   colorScheme      - 'red' (Rolz) | 'green' (FCG)
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
  colorScheme = 'red',
  summaryContent = null,
  replaceMode = false,
  onToggleReplace = () => {},
}) {
  const [expanded, setExpanded] = useState(false);

  const duplicate = existingItems.find(
    e => e.name.trim().toLowerCase() === item.name.trim().toLowerCase()
  );

  const focusClass = colorScheme === 'green' ? 'focus:border-green-600' : 'focus:border-red-500';
  const accentColor = colorScheme === 'green' ? '#22c55e' : '#ef4444';

  const handleControlledChange = (formData) => {
    onUpdate({ ...item, ...formData });
  };

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
            <span>DC <strong className="text-dh">{item.difficulty}</strong></span>
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

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-opacity ${
        selected
          ? 'border-dh-border bg-dh-inset'
          : 'border-dh-border/50 bg-dh-surface/10 opacity-40'
      }`}
    >
      {/* Header row */}
      <div className="p-3 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 flex-shrink-0 cursor-pointer"
          style={{ accentColor }}
        />

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded(v => !v)}
        >
          {/* Name row */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`font-semibold text-sm ${selected ? 'text-white' : 'text-dh-muted'}`}>
              {item.name || '(unnamed)'}
            </span>

            {collection === 'adversaries' && (
              <div
                className="flex items-center gap-1 text-xs text-dh-muted"
                onClick={e => e.stopPropagation()}
              >
                <span>×</span>
                <input
                  type="number"
                  min="1"
                  value={item.count ?? 1}
                  onChange={e => onUpdate({ ...item, count: parseInt(e.target.value) || 1 })}
                  className="w-12 bg-dh-surface border border-dh-border rounded px-1 py-0.5 text-dh text-center text-xs outline-none"
                />
              </div>
            )}

            {duplicate && (
              <>
                <span className="flex items-center gap-1 text-[10px] bg-yellow-900/40 border border-yellow-700/60 text-yellow-400 px-2 py-0.5 rounded-full flex-shrink-0">
                  <AlertTriangle size={9} /> Possible duplicate: &quot;{duplicate.name}&quot;
                </span>
                {selected && (
                  <div
                    className="flex items-center text-[10px] rounded-full border border-dh-border overflow-hidden flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => replaceMode && onToggleReplace()}
                      className={`px-2 py-0.5 transition-colors ${
                        !replaceMode
                          ? 'bg-dh-hover text-dh'
                          : 'text-dh-muted hover:text-dh'
                      }`}
                    >
                      Add as new
                    </button>
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={() => !replaceMode && onToggleReplace()}
                      className={`px-2 py-0.5 border-l border-dh-border transition-colors ${
                        replaceMode
                          ? 'bg-yellow-900/60 text-yellow-300'
                          : 'text-dh-muted hover:text-dh'
                      }`}
                    >
                      Replace existing
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Collapsed summary */}
          {!expanded && (
            <div className="text-xs text-dh-muted">
              {summaryContent ?? defaultSummary}
            </div>
          )}
        </div>

        <button
          type="button"
          tabIndex={0}
          onClick={() => setExpanded(v => !v)}
          className="text-dh-muted hover:text-dh flex-shrink-0 mt-0.5"
          title={expanded ? 'Collapse' : 'Expand to edit'}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Expanded content — controlled mode: edits propagate immediately */}
      {expanded && (
        <div className="border-t border-dh-border p-4">
          {collection === 'adversaries' && (
            <AdversaryForm
              value={item}
              onChange={handleControlledChange}
            />
          )}
          {collection === 'environments' && (
            <EnvironmentForm
              value={item}
              onChange={handleControlledChange}
            />
          )}
          {collection === 'scenes' && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-dh-muted uppercase tracking-wider">
                  Name
                </label>
                <input
                  type="text"
                  value={item.name}
                  onChange={e => onUpdate({ ...item, name: e.target.value })}
                  className={`bg-dh-surface border border-dh-border rounded px-3 py-2 text-dh text-sm outline-none ${focusClass}`}
                />
              </div>
              {'description' in item && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-dh-muted uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={item.description || ''}
                    onChange={e => onUpdate({ ...item, description: e.target.value })}
                    rows={3}
                    className={`bg-dh-surface border border-dh-border rounded px-3 py-2 text-dh text-sm outline-none resize-none ${focusClass}`}
                  />
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setExpanded(false)}
                  className="px-3 py-1.5 text-xs text-dh-muted hover:text-white"
                >
                  Collapse
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
