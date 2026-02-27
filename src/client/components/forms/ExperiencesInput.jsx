import { Plus, Trash2 } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';

export function ExperiencesInput({ experiences, onChange }) {
  const addExperience = () => onChange([...experiences, { id: generateId(), name: '', modifier: 1 }]);
  const updateExperience = (id, key, val) => onChange(experiences.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeExperience = (id) => onChange(experiences.filter(e => e.id !== id));

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-slate-300">Experiences</h4>
        <button type="button" onClick={addExperience} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded flex items-center gap-1"><Plus size={12} /> Add</button>
      </div>
      <div className="space-y-3">
        {experiences.map(exp => (
          <div key={exp.id} className="flex items-center gap-2 relative bg-slate-950 p-2 rounded border border-slate-800 pr-8">
            <input type="text" placeholder="Experience Name" value={exp.name} onChange={e => updateExperience(exp.id, 'name', e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white" />
            <span className="text-slate-400 text-sm font-bold">+</span>
            <input type="number" min="1" placeholder="2" value={exp.modifier} onChange={e => updateExperience(exp.id, 'modifier', parseInt(e.target.value) || 1)} className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-center" />
            <button type="button" onClick={() => removeExperience(exp.id)} className="absolute right-2 text-slate-500 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
        {experiences.length === 0 && <p className="text-xs text-slate-500 italic">No experiences added.</p>}
      </div>
    </div>
  );
}
