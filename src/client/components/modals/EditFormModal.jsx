import { X } from 'lucide-react';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';

/**
 * Full-screen modal overlay hosting AdversaryForm or EnvironmentForm for inline editing
 * from the GM Table, Scene detail, or Group detail.
 */
export function EditFormModal({ item, collection, data, onSave, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Edit {item?.name || 'Item'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6">
          {collection === 'adversaries' && (
            <AdversaryForm initial={item} onSave={onSave} onCancel={onClose} />
          )}
          {collection === 'environments' && (
            <EnvironmentForm initial={item} onSave={onSave} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}
