import { X } from 'lucide-react';

/**
 * Small modal that lets the user choose between editing a local copy (table/scene/group)
 * or the library original. If canEditOriginal is false, only "Edit Copy" is available.
 */
export function EditChoiceDialog({ itemName, contextLabel, canEditOriginal, forceMessage, onEditCopy, onEditOriginal, onClose }) {
  return (
    <div className="fixed inset-0 z-[53] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-dh-surface border border-dh-border rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-white truncate pr-2">Edit "{itemName}"</h2>
          <button onClick={onClose} className="text-dh-muted hover:text-white flex-shrink-0"><X size={18} /></button>
        </div>
        <p className="text-dh-muted text-sm mb-5">
          This item is referenced from your library. How would you like to edit it?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onEditCopy}
            className="w-full px-4 py-3 bg-dh-raised hover:bg-dh-hover border border-dh-strong hover:border-dh-strong text-dh rounded-lg text-left transition-colors"
          >
            <div className="text-sm font-semibold mb-0.5">Edit {contextLabel} Copy</div>
            <div className="text-dh-muted text-xs font-normal">
              Create a local version just for this {contextLabel.toLowerCase()}. The library original stays unchanged.
            </div>
          </button>
          {canEditOriginal ? (
            <button
              onClick={onEditOriginal}
              className="w-full px-4 py-3 bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700/50 hover:border-blue-600/60 text-blue-200 rounded-lg text-left transition-colors"
            >
              <div className="text-sm font-semibold mb-0.5">Edit Library Original</div>
              <div className="text-blue-300/70 text-xs font-normal">
                Update the item in your library. Changes will be reflected everywhere it's used.
              </div>
            </button>
          ) : (
            <div className="text-xs text-dh-muted text-center pt-1">
              {forceMessage || 'You can only edit a copy — this item is SRD or public content.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
