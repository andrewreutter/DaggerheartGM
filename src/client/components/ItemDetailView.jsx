import { useState } from 'react';
import { X, Copy, Edit } from 'lucide-react';
import { generateRolzExport } from '../lib/rolz-export.js';

export function ItemDetailView({ item, tab, data, onEdit, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopyRolz = async () => {
    try {
      const markdown = generateRolzExport(item, tab, data || {});
      try {
        await navigator.clipboard.writeText(markdown);
      } catch (clipErr) {
        const ta = document.createElement('textarea');
        ta.value = markdown;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Rolz export failed:', err);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg shadow-xl max-w-3xl relative overflow-hidden">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-10"><X size={20} /></button>

      {item.imageUrl && (
        <div className="w-full h-56 overflow-hidden bg-slate-950">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover opacity-90" onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}

      <div className="p-6">
        <div className="mb-6 pr-8">
          <h2 className="text-3xl font-bold text-white mb-1">{item.name}</h2>
          <div className="text-slate-400 uppercase tracking-wider text-sm font-medium mb-2">
            {tab === 'adversaries' && `Tier ${item.tier || 0} ${item.role}`}
            {tab === 'environments' && `Tier ${item.tier || 0} ${item.type} Environment`}
            {tab === 'groups' && 'Group'}
            {tab === 'scenes' && 'Scene'}
            {tab === 'adventures' && 'Adventure'}
          </div>
          {item.description && (
            <div className="text-slate-300 italic whitespace-pre-wrap text-sm">{item.description}</div>
          )}
        </div>

        {tab === 'adversaries' && (item.motive || (item.experiences && item.experiences.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {item.motive && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Motives & Tactics</h3>
                <p className="text-sm text-slate-300">{item.motive}</p>
              </div>
            )}
            {item.experiences && item.experiences.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase border-b border-slate-800 pb-1 mb-2">Experiences</h3>
                <div className="flex flex-wrap gap-2">
                  {item.experiences.map(exp => (
                    <span key={exp.id} className="text-sm bg-slate-950 border border-slate-800 text-slate-300 px-2 py-1 rounded">
                      {exp.name} <strong className="text-red-400">+{exp.modifier}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'adversaries' && (
          <div className="grid grid-cols-4 gap-4 mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Difficulty</span><span className="text-xl text-white">{item.difficulty || '-'}</span></div>
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">HP</span><span className="text-xl text-white">{item.hp_max || '-'}</span></div>
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Thresholds</span><span className="text-xl text-white">{item.hp_thresholds?.major || '-'}/{item.hp_thresholds?.severe || '-'}</span></div>
            <div className="flex flex-col"><span className="text-slate-500 text-xs uppercase">Stress</span><span className="text-xl text-white">{item.stress_max || '-'}</span></div>
          </div>
        )}

        {item.attack && item.attack.name && (
          <div className="mb-6 space-y-3">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Attack</h3>
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="font-bold text-red-400">{item.attack.name}:</span>
              <span className="text-slate-300"> {item.attack.modifier >= 0 ? '+' : ''}{item.attack.modifier} {item.attack.range} | {item.attack.damage} {item.attack.trait?.toLowerCase()}</span>
            </div>
          </div>
        )}

        {item.features && item.features.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Features</h3>
            {item.features.map(f => (
              <div key={f.id} className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-red-400">{f.name}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase tracking-wider">{f.type}</span>
                </div>
                <p className="text-sm text-slate-300">{f.description}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-slate-800">
          <button
            onClick={handleCopyRolz}
            className={`px-4 py-2 rounded font-medium flex items-center gap-2 text-sm transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
          >
            <Copy size={15} /> {copied ? 'Copied!' : 'Copy Rolz'}
          </button>
          <button onClick={onEdit} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium flex items-center gap-2">
            <Edit size={16} /> Edit {item.name}
          </button>
        </div>
      </div>
    </div>
  );
}
