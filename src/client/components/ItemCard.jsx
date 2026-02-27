import { useState } from 'react';
import { Edit, Trash2, Play, Copy } from 'lucide-react';

const SOURCE_BADGE = {
  srd: { label: 'SRD', className: 'bg-violet-900/60 text-violet-300 border border-violet-700' },
  public: { label: 'Public', className: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
};

export function ItemCard({ item, tab, data, onView, onEdit, onDelete, onClone, onStartScene, onAddToTable }) {
  const [added, setAdded] = useState(false);
  const isOwn = !item._source || item._source === 'own';
  const badge = SOURCE_BADGE[item._source];

  const handleAddToTable = () => {
    onAddToTable(item, tab);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  };

  return (
    <div
      onClick={() => onView(item)}
      className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors flex flex-col group overflow-hidden"
    >
      {item.imageUrl && (
        <div className="w-full h-32 overflow-hidden bg-slate-950">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors leading-tight">{item.name}</h3>
            {badge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded self-start uppercase tracking-wide ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <div className="flex gap-2 ml-2 shrink-0" onClick={e => e.stopPropagation()}>
            {onAddToTable && (
              <button
                onClick={handleAddToTable}
                className={`transition-colors duration-150 ${added ? 'text-yellow-400' : 'text-slate-400 hover:text-white'}`}
                title="Add to GM Table"
              >
                <Play size={16} />
              </button>
            )}
            {onClone && (
              <button onClick={(e) => { e.stopPropagation(); onClone(item); }} className="text-slate-400 hover:text-violet-400" title="Clone to My Library">
                <Copy size={16} />
              </button>
            )}
            {isOwn && onEdit && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="text-slate-400 hover:text-blue-400" title="Edit">
                <Edit size={16} />
              </button>
            )}
            {isOwn && onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(tab, item.id); }} className="text-slate-400 hover:text-red-400" title="Delete">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-400 flex-1">
          {tab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
          {tab === 'environments' && `Tier ${item.tier || 0} ${item.type}`}
          {tab === 'groups' && (
            item.adversaries?.length > 0
              ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.adversaries.map((advRef, i) => {
                    const name = advRef.data ? advRef.data.name : data?.adversaries?.find(a => a.id === advRef.adversaryId)?.name;
                    const count = advRef.count || 1;
                    const key = advRef.data ? `owned-${i}` : advRef.adversaryId;
                    return name ? (
                      <span key={key} className={`text-xs border px-2 py-0.5 rounded-full ${advRef.data ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                        {name}{count > 1 ? ` ×${count}` : ''}
                      </span>
                    ) : null;
                  })}
                </div>
              )
              : <span className="text-xs italic text-slate-500">No adversaries</span>
          )}
          {tab === 'scenes' && (() => {
            const chips = [
              ...(item.environments || []).map((envEntry, i) => {
                if (typeof envEntry === 'object' && envEntry.data) {
                  return { key: `env-owned-${i}`, label: envEntry.data.name, owned: true };
                }
                const env = data?.environments?.find(e => e.id === envEntry);
                return env ? { key: `env-${envEntry}`, label: env.name, owned: false } : null;
              }),
              ...(item.adversaries || []).map((advRef, i) => {
                const name = advRef.data ? advRef.data.name : data?.adversaries?.find(a => a.id === advRef.adversaryId)?.name;
                const count = advRef.count || 1;
                const key = advRef.data ? `adv-owned-${i}` : `adv-${advRef.adversaryId}`;
                return name ? { key, label: name + (count > 1 ? ` ×${count}` : ''), owned: !!advRef.data } : null;
              }),
              ...(item.groups || []).flatMap(gId => {
                const group = data?.groups?.find(g => g.id === gId);
                if (!group) return [];
                const overrideIds = new Set((item.groupOverrides || []).filter(ov => ov.groupId === gId).map(ov => ov.adversaryId));
                return (group.adversaries || []).map((advRef, i) => {
                  if (overrideIds.has(advRef.adversaryId)) return null;
                  const name = advRef.data ? advRef.data.name : data?.adversaries?.find(a => a.id === advRef.adversaryId)?.name;
                  const count = advRef.count || 1;
                  return name ? { key: `grp-${gId}-adv-${advRef.adversaryId || i}`, label: name + (count > 1 ? ` ×${count}` : ''), owned: !!advRef.data } : null;
                }).filter(Boolean);
              }),
            ].filter(Boolean);
            return chips.length > 0
              ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {chips.map(chip => (
                    <span key={chip.key} className={`text-xs border px-2 py-0.5 rounded-full ${chip.owned ? 'bg-amber-900/30 border-amber-700/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              )
              : <span className="text-xs italic text-slate-500">Empty scene</span>;
          })()}
          {tab === 'adventures' && `${item.scenes?.length || 0} scenes`}

          {item.motive && <p className="mt-2 text-xs italic text-slate-300">"{item.motive}"</p>}
          {item.description && <p className="mt-1 text-xs opacity-80 line-clamp-2">{item.description}</p>}
        </div>
      </div>
    </div>
  );
}
