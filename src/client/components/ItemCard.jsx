import { useState } from 'react';
import { Edit, Trash2, Play, Copy, Flame } from 'lucide-react';
import { SOURCE_BADGE, isOwnItem, needsHodEnrich } from '../lib/constants.js';
import { computeSceneTier, computeBattlePoints, collectSceneAdversaries } from '../lib/battle-points.js';

export function ItemCard({ item, tab, data, onView, onEdit, onDelete, onClone, onAddToTable, partySize = 4, showSourceBadge = true }) {
  const [added, setAdded] = useState(false);
  const isOwn = isOwnItem(item);
  const badge = showSourceBadge ? (SOURCE_BADGE[item._source] ?? SOURCE_BADGE.own) : null;
  const popularity = item.popularity ?? ((item.clone_count || 0) + (item.play_count || 0));
  const isEnriching = needsHodEnrich(item);

  const sceneTier = tab === 'scenes' ? computeSceneTier(item, data) : null;
  const sceneBP = tab === 'scenes'
    ? computeBattlePoints(collectSceneAdversaries(item, data), partySize)
    : null;

  const handleAddToTable = () => {
    onAddToTable(item, tab);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  return (
    <div
      onClick={() => onView(item)}
      className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors group overflow-hidden flex flex-row h-44 w-[360px] relative"
    >
      <div className="p-2 flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors leading-tight truncate">{item.name}</h3>
            <div className="flex items-center gap-1 flex-wrap min-h-[18px]">
              {(tab === 'adversaries' || tab === 'environments') && (
                <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0" title={`Tier ${item.tier ?? '?'}`}>
                  <svg viewBox="0 0 20 22" className="absolute inset-0 w-full h-full" fill="none">
                    <path d="M10 1L19 5v7c0 5-4 8-9 9C5 20 1 17 1 12V5l9-4z" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  </svg>
                  <span className="relative text-[10px] font-bold text-slate-200 leading-none mt-0.5">{item.tier ?? '?'}</span>
                </span>
              )}
              {tab === 'scenes' && sceneTier != null && (
                <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0" title={`Tier ${sceneTier}`}>
                  <svg viewBox="0 0 20 22" className="absolute inset-0 w-full h-full" fill="none">
                    <path d="M10 1L19 5v7c0 5-4 8-9 9C5 20 1 17 1 12V5l9-4z" fill="#0f2040" stroke="#3b82f6" strokeWidth="1.5" />
                  </svg>
                  <span className="relative text-[10px] font-bold text-blue-200 leading-none mt-0.5">{sceneTier}</span>
                </span>
              )}
              {tab === 'scenes' && sceneBP > 0 && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700" title="Battle Points cost">
                  {sceneBP} BP
                </span>
              )}
              {badge && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${badge.className}`}>
                  {badge.label}
                </span>
              )}
              {popularity > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-900/50 text-orange-300 border border-orange-700/60" title={`${item.clone_count || 0} clones · ${item.play_count || 0} plays`}>
                  <Flame size={9} />
                  {popularity}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 ml-1 shrink-0" onClick={e => e.stopPropagation()}>
            {onAddToTable && (
              <button
                onClick={handleAddToTable}
                className={`transition-colors duration-150 ${added ? 'text-yellow-400' : 'text-slate-400 hover:text-white'}`}
                title="Add to GM Table"
              >
                <Play size={14} />
              </button>
            )}
            {onClone && (
              <button onClick={(e) => { e.stopPropagation(); onClone(item); }} className="text-slate-400 hover:text-violet-400" title="Clone to My Library">
                <Copy size={14} />
              </button>
            )}
            {isOwn && onEdit && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="text-slate-400 hover:text-blue-400" title="Edit">
                <Edit size={14} />
              </button>
            )}
            {isOwn && onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(tab, item.id); }} className="text-slate-400 hover:text-red-400" title="Delete">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-400 flex-1">
          {tab === 'adversaries' && <span className="capitalize">Tier {item.tier ?? '?'} {item.role}</span>}
          {tab === 'environments' && (
            <>
              <span className="capitalize">Tier {item.tier ?? '?'} {item.type}</span>
              {Array.isArray(item.potential_adversaries) && item.potential_adversaries.length > 0 && (
                <span className="ml-1.5 not-italic text-[10px] text-slate-500 normal-case">
                  · {item.potential_adversaries.length} adversar{item.potential_adversaries.length === 1 ? 'y' : 'ies'}
                </span>
              )}
            </>
          )}
          {tab === 'scenes' && (() => {
            const chips = [
              ...(item.environments || []).map((envEntry, i) => {
                if (envEntry !== null && typeof envEntry === 'object' && envEntry.data) {
                  return { key: `env-owned-${i}`, label: envEntry.data.name, owned: true, nested: false };
                }
                const env = data?.environments?.find(e => e.id === envEntry);
                return env ? { key: `env-${envEntry}`, label: env.name, owned: false, nested: false } : null;
              }),
              ...(item.adversaries || []).map((advRef, i) => {
                const name = advRef.data ? advRef.data.name : data?.adversaries?.find(a => a.id === advRef.adversaryId)?.name;
                const count = advRef.count || 1;
                const key = advRef.data ? `adv-owned-${i}` : `adv-${advRef.adversaryId}`;
                return name ? { key, label: name + (count > 1 ? ` ×${count}` : ''), owned: !!advRef.data, nested: false } : null;
              }),
              ...(item.scenes || []).map(sceneId => {
                const scene = data?.scenes?.find(s => s.id === sceneId);
                return scene ? { key: `scene-${sceneId}`, label: scene.name, owned: false, nested: true } : null;
              }),
            ].filter(Boolean);
            return chips.length > 0
              ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {chips.map(chip => (
                    <span key={chip.key} className={`text-xs border px-2 py-0.5 rounded-full ${chip.owned ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' : chip.nested ? 'bg-blue-900/30 border-blue-700/50 text-blue-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              )
              : <span className="text-xs italic text-slate-500">Empty scene</span>;
          })()}
          {tab === 'adventures' && `${item.scenes?.length || 0} scenes`}

          {item.motive && <p className="mt-0.5 text-[10px] italic text-slate-400 line-clamp-3 pr-24">{item.motive}</p>}
          {item.description && <p className="mt-0.5 text-[10px] opacity-80 line-clamp-3 pr-24">{item.description}</p>}
          {isEnriching && <p className="mt-1 text-[10px] text-rose-400/70 animate-pulse">Loading details…</p>}
        </div>
      </div>

      {item.imageUrl && (
        <div className="absolute bottom-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
    </div>
  );
}
