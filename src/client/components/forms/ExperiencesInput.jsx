import { useEffect, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';

export function ExperiencesInput({ experiences, onChange, highlightedId }) {
  const highlightedRef = useRef(null);

  useEffect(() => {
    if (highlightedId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedId]);

  const addExperience = () => onChange([...experiences, { id: generateId(), name: '', modifier: 1 }]);
  const updateExperience = (id, key, val) => onChange(experiences.map(e => e.id === id ? { ...e, [key]: val } : e));
  const removeExperience = (id) => onChange(experiences.filter(e => e.id !== id));

  return (
    <div className="mt-6 border-t border-dh-border pt-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-dh">Experiences</h4>
        <button type="button" onClick={addExperience} className="text-xs bg-dh-raised hover:bg-dh-hover text-dh px-2 py-1 rounded flex items-center gap-1"><Plus size={12} /> Add</button>
      </div>
      <div className="space-y-3">
        {experiences.map(exp => (
          <div
            key={exp.id}
            ref={exp.id === highlightedId ? highlightedRef : null}
            className={`flex items-center gap-2 relative p-2 rounded pr-8 transition-all duration-300 ${
              exp.id === highlightedId
                ? 'bg-amber-900/30 border-2 border-amber-500/70 ring-2 ring-amber-400/40'
                : 'bg-dh-inset border border-dh-border'
            }`}
          >
            <input type="text" placeholder="Experience Name" value={exp.name} onChange={e => updateExperience(exp.id, 'name', e.target.value)} className="flex-1 bg-dh-surface border border-dh-border rounded px-2 py-1 text-sm text-dh" />
            <span className="text-dh-muted text-sm font-bold">+</span>
            <input type="number" min="1" placeholder="2" value={exp.modifier} onChange={e => updateExperience(exp.id, 'modifier', parseInt(e.target.value) || 1)} className="w-16 bg-dh-surface border border-dh-border rounded px-2 py-1 text-sm text-dh text-center" />
            <button type="button" onClick={() => removeExperience(exp.id)} className="absolute right-2 text-dh-muted hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
        {experiences.length === 0 && <p className="text-xs text-dh-muted italic">No experiences added.</p>}
      </div>
    </div>
  );
}
