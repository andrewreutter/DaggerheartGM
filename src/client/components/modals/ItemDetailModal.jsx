import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Undo2, Redo2, Trash2, BookCopy, Copy } from 'lucide-react';
import { generateRolzExport } from '../../lib/rolz-export.js';
import { useAutoSaveUndo } from '../../lib/useAutoSaveUndo.js';
import { AdversaryCardContent, EnvironmentCardContent } from '../DetailCardContent.jsx';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';
import { SceneForm } from '../forms/SceneForm.jsx';
import { AdventureForm } from '../forms/AdventureForm.jsx';
import { ExpandedTablePreview } from '../ItemDetailView.jsx';

const SOURCE_BADGE = {
  srd: { label: 'SRD', className: 'bg-violet-900/60 text-violet-300 border border-violet-700' },
  public: { label: 'Public', className: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
};

const COLLECTION_LABELS = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
};

/**
 * Unified item detail + edit modal.
 *
 * Editable items show a split layout:
 *   [Live Preview] | [Edit Form] | [Feature Library (adversaries/environments only, narrow)]
 *
 * Non-editable items (SRD/public/FCG) show only the display pane with Clone/Copy Rolz actions.
 *
 * Auto-saves on every change (debounced 800ms). Provides infinite undo/redo within the session.
 * Keyboard: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo, Escape = close.
 *
 * Props:
 *   item          – item to view/edit (pass `{}` for new)
   *   collection    – 'adversaries' | 'environments' | 'scenes' | 'adventures'
   *   data          – app-level data for ref resolution (scene preview)
 *   editable      – boolean; false for SRD/public/FCG items
 *   onSave        – async (formData) => void; called by auto-save with full item data
   *   onSaveElement – optional; for scene inline element edits
 *   onDelete      – optional () => void
 *   onClone       – optional async () => void
 *   onClose       – () => void
 */
export function ItemDetailModal({
  item,
  collection,
  data,
  editable,
  onSave,
  onSaveElement,
  onDelete,
  onClone,
  onClose,
}) {
  const isNew = !item?.id;
  const showFeatureLibrary = editable && (collection === 'adversaries' || collection === 'environments');

  const [libraryPortal, setLibraryPortal] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cloningStatus, setCloningStatus] = useState('');
  const overlayRef = useRef(null);

  // Build a stable initial value for useAutoSaveUndo.
  // For non-editable items this formData is unused, but the hook still needs to init.
  const initialRef = useRef(null);
  if (!initialRef.current) {
    initialRef.current = item || {};
  }

  const { formData, setFormData, undo, redo, canUndo, canRedo, isSaving } = useAutoSaveUndo({
    initial: initialRef.current,
    onSave: useCallback(async (d) => {
      if (onSave) await onSave(d);
    }, [onSave]),
    debounceMs: 800,
    isNew,
  });

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (e.key === 'Escape') { onClose(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo, onClose]);

  const handleCopyRolz = async () => {
    try {
      const src = editable ? formData : item;
      const markdown = generateRolzExport(src, collection, data || {});
      try {
        await navigator.clipboard.writeText(markdown);
      } catch {
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

  const handleClone = async () => {
    if (!onClone) return;
    setCloningStatus('Cloning...');
    try {
      await onClone();
      setCloningStatus('Cloned!');
      setTimeout(() => setCloningStatus(''), 2000);
    } catch {
      setCloningStatus('Error');
      setTimeout(() => setCloningStatus(''), 2000);
    }
  };

  // Click outside closes the modal.
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const displayItem = editable ? formData : item;
  const badge = SOURCE_BADGE[item?._source];
  const isOwn = !item?._source || item?._source === 'own';

  // --- Display Pane content ---
  const renderDisplayContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {displayItem.imageUrl && (
        <div className="w-full h-40 overflow-hidden bg-slate-950 shrink-0">
          <img
            src={displayItem.imageUrl}
            alt={displayItem.name}
            className="w-full h-full object-cover opacity-90"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <h3 className="text-xl font-bold text-white">
            {displayItem.name || <span className="text-slate-500 italic">Untitled</span>}
          </h3>
          {badge && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        {collection === 'adversaries' && (
          <AdversaryCardContent element={displayItem} hoveredFeature={null} cardKey="preview" />
        )}
        {collection === 'environments' && (
          <EnvironmentCardContent element={displayItem} hoveredFeature={null} cardKey="preview" />
        )}
        {collection === 'scenes' && data && (
          <>
            {displayItem.description && (
              <p className="text-sm italic text-slate-300 mb-3 whitespace-pre-wrap">{displayItem.description}</p>
            )}
            <ExpandedTablePreview
              item={displayItem}
              tab={collection}
              data={data}
              onSaveElement={onSaveElement}
              isOwn={isOwn}
            />
          </>
        )}
        {collection === 'adventures' && displayItem.description && (
          <p className="text-sm italic text-slate-300 whitespace-pre-wrap">{displayItem.description}</p>
        )}

        {/* Actions: always show Copy Rolz; Clone only for non-editable */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-800">
          <button
            onClick={handleCopyRolz}
            className={`px-3 py-1.5 rounded font-medium flex items-center gap-1.5 text-sm transition-colors ${copied ? 'bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
          >
            <Copy size={14} /> {copied ? 'Copied!' : 'Copy Rolz'}
          </button>
          {!editable && onClone && (
            <button
              onClick={handleClone}
              disabled={!!cloningStatus}
              className="px-3 py-1.5 rounded font-medium flex items-center gap-1.5 text-sm bg-violet-700 hover:bg-violet-600 text-white transition-colors disabled:opacity-60"
            >
              <BookCopy size={14} /> {cloningStatus || 'Clone to My Library'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // --- Edit Form Pane ---
  const renderFormContent = () => {
    const sharedProps = {
      value: formData,
      onChange: setFormData,
      data,
      featureLibraryPortal: libraryPortal,
    };

    return (
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {collection === 'adversaries' && <AdversaryForm {...sharedProps} />}
        {collection === 'environments' && <EnvironmentForm {...sharedProps} />}
        {collection === 'scenes' && <SceneForm {...sharedProps} />}
        {collection === 'adventures' && <AdventureForm {...sharedProps} />}
      </div>
    );
  };

  const maxWidth = showFeatureLibrary ? 'max-w-[110rem]' : editable ? 'max-w-[88rem]' : 'max-w-3xl';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-hidden"
      onClick={handleOverlayClick}
    >
      <div className={`flex gap-3 items-start w-full ${maxWidth}`}>
        {/* Main modal card */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex-1 min-w-0 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 2rem)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {editable && (
                <>
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                    className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Redo2 size={16} />
                  </button>
                  <span className="w-px h-5 bg-slate-700 mx-1 shrink-0" />
                </>
              )}
              <h2 className="text-lg font-bold text-white truncate">
                {(editable ? formData.name : item?.name) ||
                  (isNew ? `New ${COLLECTION_LABELS[collection] || collection}` : 'Item')}
              </h2>
              {badge && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.className}`}>
                  {badge.label}
                </span>
              )}
              {isSaving && <span className="text-xs text-slate-500 ml-2 shrink-0">Saving…</span>}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-3">
              {onDelete && isOwn && (
                <button
                  onClick={onDelete}
                  title="Delete"
                  className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden flex min-h-0">
            {editable ? (
              <>
                {/* Preview pane — fixed 42% width */}
                <div className="w-[42%] shrink-0 border-r border-slate-800 overflow-hidden flex flex-col">
                  {renderDisplayContent()}
                </div>
                {/* Form pane */}
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                  {renderFormContent()}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {renderDisplayContent()}
              </div>
            )}
          </div>
        </div>

        {/* Feature Library portal target — narrow column to the right of the card.
            Must use a concrete height (not maxHeight) so FeatureLibrary's h-full
            resolves correctly and the inner scroll list gets a bounded height. */}
        {showFeatureLibrary && (
          <div
            ref={setLibraryPortal}
            className="w-72 shrink-0 rounded-xl"
            style={{ height: 'calc(100vh - 2rem)' }}
          />
        )}
      </div>
    </div>
  );
}
