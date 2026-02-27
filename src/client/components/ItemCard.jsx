import { useState } from 'react';
import { Edit, Trash2, Play } from 'lucide-react';

export function ItemCard({ item, tab, data, onView, onEdit, onDelete, onStartScene, onAddToTable }) {
  const [added, setAdded] = useState(false);

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
          <h3 className="font-bold text-lg text-white group-hover:text-red-400 transition-colors">{item.name}</h3>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            {onAddToTable && (
              <button
                onClick={handleAddToTable}
                className={`transition-colors duration-150 ${added ? 'text-yellow-400' : 'text-slate-400 hover:text-white'}`}
                title="Add to GM Table"
              >
                <Play size={16} />
              </button>
            )}
            <button onClick={() => onEdit(item)} className="text-slate-400 hover:text-blue-400"><Edit size={16} /></button>
            <button onClick={() => onDelete(tab, item.id)} className="text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
          </div>
        </div>
        <div className="text-sm text-slate-400 flex-1">
          {tab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
          {tab === 'environments' && `Tier ${item.tier || 0} ${item.type}`}
          {tab === 'groups' && (
            item.adversaries?.length > 0
              ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.adversaries.map(advRef => {
                    const adv = data?.adversaries?.find(a => a.id === advRef.adversaryId);
                    return adv ? (
                      <span key={advRef.adversaryId} className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        {adv.name}{advRef.count > 1 ? ` ×${advRef.count}` : ''}
                      </span>
                    ) : null;
                  })}
                </div>
              )
              : <span className="text-xs italic text-slate-500">No adversaries</span>
          )}
          {tab === 'scenes' && (() => {
            const chips = [
              ...(item.environments || []).map(envId => {
                const env = data?.environments?.find(e => e.id === envId);
                return env ? { key: `env-${envId}`, label: env.name } : null;
              }),
              ...(item.adversaries || []).map(advRef => {
                const adv = data?.adversaries?.find(a => a.id === advRef.adversaryId);
                return adv ? { key: `adv-${advRef.adversaryId}`, label: adv.name + (advRef.count > 1 ? ` ×${advRef.count}` : '') } : null;
              }),
              ...(item.groups || []).flatMap(gId => {
                const group = data?.groups?.find(g => g.id === gId);
                if (!group) return [];
                return (group.adversaries || []).map(advRef => {
                  const adv = data?.adversaries?.find(a => a.id === advRef.adversaryId);
                  return adv ? { key: `grp-${gId}-adv-${advRef.adversaryId}`, label: adv.name + (advRef.count > 1 ? ` ×${advRef.count}` : '') } : null;
                }).filter(Boolean);
              }),
            ].filter(Boolean);
            return chips.length > 0
              ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {chips.map(chip => (
                    <span key={chip.key} className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
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
