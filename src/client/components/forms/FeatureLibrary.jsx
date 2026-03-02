import { useState, useEffect } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { TIERS, ROLES, ENV_TYPES } from '../../lib/constants.js';

const SOURCE_ORDER = { own: 0, srd: 1, public: 2 };

const SOURCE_BADGE = {
  own: 'bg-blue-900/60 text-blue-300',
  srd: 'bg-purple-900/60 text-purple-300',
  public: 'bg-slate-700 text-slate-300',
};

const TYPE_BADGE = {
  action: 'bg-amber-900/60 text-amber-300',
  reaction: 'bg-teal-900/60 text-teal-300',
  passive: 'bg-slate-700/80 text-slate-300',
};

const SUBTYPE_OPTIONS = { role: ROLES, type: ENV_TYPES };

function buildKey(feature) {
  return `${(feature.name || '').trim().toLowerCase()}|${feature.type}|${(feature.description || '').trim()}`;
}

export function FeatureLibrary({ items, tier, subtype, subtypeKey, currentFeatures, onAdd }) {
  const [hovered, setHovered] = useState(null); // { key, top }

  // Local filter state — tracks the form by default, user can override
  const [localTier, setLocalTier] = useState(tier ?? 'all');
  const [localSubtype, setLocalSubtype] = useState(subtype ?? 'all');

  // Follow form changes unless user has already moved to a different value
  useEffect(() => { setLocalTier(tier ?? 'all'); }, [tier]);
  useEffect(() => { setLocalSubtype(subtype ?? 'all'); }, [subtype]);

  const subtypeOptions = SUBTYPE_OPTIONS[subtypeKey] || [];

  const currentKeys = new Set((currentFeatures || []).map(buildKey));

  const candidateMap = new Map(); // key -> { feature, source, sourceName }
  (items || [])
    .filter(item =>
      (localTier === 'all' || item.tier === localTier) &&
      (localSubtype === 'all' || item[subtypeKey] === localSubtype)
    )
    .forEach(item => {
      (item.features || []).forEach(feat => {
        const key = buildKey(feat);
        if (currentKeys.has(key)) return;
        const existing = candidateMap.get(key);
        const src = item._source || 'own';
        if (!existing || SOURCE_ORDER[src] < SOURCE_ORDER[existing.source]) {
          candidateMap.set(key, { feature: feat, source: src, sourceName: item.name });
        }
      });
    });

  const candidates = Array.from(candidateMap.entries())
    .sort(([, a], [, b]) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source])
    .map(([key, val]) => ({ key, ...val }));

  const selectClass = 'bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-slate-200 cursor-pointer hover:border-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="h-full bg-slate-900 border border-slate-700 rounded-xl flex flex-col overflow-hidden">
      {/* Header with filter dropdowns */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 shrink-0">
        <h4 className="font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2 mb-2">
          <BookOpen size={15} className="text-blue-400" /> Feature Library
        </h4>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={localTier}
            onChange={e => setLocalTier(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            className={selectClass}
          >
            <option value="all">All Tiers</option>
            {TIERS.map(t => <option key={t} value={t}>Tier {t}</option>)}
          </select>
          <select
            value={localSubtype}
            onChange={e => setLocalSubtype(e.target.value)}
            className={selectClass}
          >
            <option value="all">All {subtypeKey === 'role' ? 'Roles' : 'Types'}</option>
            {subtypeOptions.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scrollable feature list */}
      <div className="p-3 space-y-2 overflow-y-auto flex-1">
        {candidates.length === 0 && (
          <p className="text-xs text-slate-500 italic mt-2">
            No features found for the selected filter.
          </p>
        )}

        {candidates.map(({ key, feature, source, sourceName }) => (
          <div key={key} className="relative group">
            <button
              type="button"
              onClick={() => onAdd({ ...feature, id: generateId() })}
              onMouseEnter={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHovered({ key, top: Math.max(8, Math.min(rect.top, window.innerHeight - 300)) });
              }}
              onMouseLeave={() => setHovered(null)}
              className="w-full text-left bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 p-2.5 rounded transition-colors"
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className="font-medium text-slate-200 text-xs leading-tight">{feature.name || '(unnamed)'}</span>
                <Plus size={12} className="text-slate-500 group-hover:text-green-400 shrink-0 mt-0.5 transition-colors" />
              </div>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {feature.type && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_BADGE[feature.type] || 'bg-slate-700 text-slate-300'}`}>
                    {feature.type}
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_BADGE[source] || 'bg-slate-700 text-slate-300'}`}>
                  {source}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-snug">{feature.description}</p>
            </button>

            {/* Hover popover to the left */}
            {hovered?.key === key && (
              <div
                className="fixed z-[60] pointer-events-none"
                style={{ right: 'calc(18rem + 12px)', top: hovered.top, width: '22rem' }}
              >
                <div className="bg-slate-900 border border-slate-600 rounded-xl shadow-2xl p-4 max-h-72 overflow-y-auto">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-white text-sm leading-tight">{feature.name || '(unnamed)'}</span>
                    <div className="flex flex-wrap gap-1 shrink-0">
                      {feature.type && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_BADGE[feature.type] || ''}`}>
                          {feature.type}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_BADGE[source] || ''}`}>
                        {source}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{feature.description}</p>
                  {sourceName && (
                    <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-700 pt-2">
                      From: {sourceName}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
