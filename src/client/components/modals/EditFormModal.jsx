import { useState } from 'react';
import { X } from 'lucide-react';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';

/**
 * Full-screen modal overlay hosting AdversaryForm or EnvironmentForm for inline editing
 * from the GM Table, Scene detail, or Group detail.
 *
 * The Feature Library panel renders into a sibling portal target to the right of the
 * form card, so it doesn't affect the card's height and scrolls independently.
 */
export function EditFormModal({ item, collection, data, onSave, onClose }) {
  const [libraryPortal, setLibraryPortal] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="flex gap-4 items-start my-8 w-full max-w-[88rem]">
        {/* Form card — scrolls independently */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex-1 min-w-0 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
            <h2 className="text-xl font-bold text-white">Edit {item?.name || 'Item'}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
          </div>
          <div className="p-6">
            {collection === 'adversaries' && (
              <AdversaryForm
                initial={item}
                onSave={onSave}
                onCancel={onClose}
                allItems={data?.adversaries}
                featureLibraryPortal={libraryPortal}
              />
            )}
            {collection === 'environments' && (
              <EnvironmentForm
                initial={item}
                onSave={onSave}
                onCancel={onClose}
                allItems={data?.environments}
                featureLibraryPortal={libraryPortal}
              />
            )}
          </div>
        </div>

        {/* Feature Library portal target — sits to the right of the card, same max-h */}
        {(collection === 'adversaries' || collection === 'environments') && data && (
          <div
            ref={setLibraryPortal}
            className="w-72 shrink-0 h-[calc(100vh-4rem)] overflow-hidden rounded-xl"
          />
        )}
      </div>
    </div>
  );
}
