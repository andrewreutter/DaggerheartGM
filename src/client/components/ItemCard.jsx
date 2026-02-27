import { useState } from 'react';
import { Edit, Trash2, Play } from 'lucide-react';

export function ItemCard({ item, tab, onView, onEdit, onDelete, onStartScene, onAddToTable }) {
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
          {tab === 'groups' && `${item.adversaries?.length || 0} adversary types`}
          {tab === 'scenes' && `${(item.environments?.length || 0) + (item.groups?.length || 0) + (item.adversaries?.length || 0)} elements`}
          {tab === 'adventures' && `${item.scenes?.length || 0} scenes`}

          {item.motive && <p className="mt-2 text-xs italic text-slate-300">"{item.motive}"</p>}
          {item.description && <p className="mt-1 text-xs opacity-80 line-clamp-2">{item.description}</p>}
        </div>
      </div>
    </div>
  );
}
