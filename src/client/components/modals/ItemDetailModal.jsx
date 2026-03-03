import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Undo2, Redo2, Trash2, BookCopy, Copy, Sparkles, ExternalLink } from 'lucide-react';
import { generateRolzExport } from '../../lib/rolz-export.js';
import { useAutoSaveUndo } from '../../lib/useAutoSaveUndo.js';
import { AdversaryCardContent, EnvironmentCardContent } from '../DetailCardContent.jsx';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';
import { SceneForm } from '../forms/SceneForm.jsx';
import { AdventureForm } from '../forms/AdventureForm.jsx';
import { ExpandedTablePreview } from '../ItemDetailView.jsx';
import { SOURCE_BADGE, isOwnItem, needsRedditParse } from '../../lib/constants.js';

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
 * Keyboard: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo, Escape = close lightbox (if open) or close modal.
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
  enriching = false,
  onSave,
  onSaveElement,
  onDelete,
  onClone,
  onParseReddit,
  onClose,
}) {
  const isNew = !item?.id;
  const showFeatureLibrary = editable && (collection === 'adversaries' || collection === 'environments');

  const [libraryPortal, setLibraryPortal] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cloningStatus, setCloningStatus] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
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
      else if (e.key === 'Escape') { if (lightboxUrl) { setLightboxUrl(null); } else { onClose(); } }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo, onClose, lightboxUrl, setLightboxUrl]);

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
  const isOwn = isOwnItem(item);

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

        {enriching && item?._source === 'reddit' ? (
          <div className="mb-3">
            <div className="px-3 py-2 rounded-lg bg-orange-950/40 border border-orange-800/50 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin shrink-0" />
                <span className="text-sm text-orange-300">Parsing post with AI…</span>
              </div>
              {item._redditAuthor && (
                <p className="text-xs text-slate-500 mt-1">by u/{item._redditAuthor} · r/{item._redditSubreddit}</p>
              )}
            </div>
            {item._redditSelftext && (
              <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
                {item._redditSelftext.slice(0, 1200)}{item._redditSelftext.length > 1200 ? '…' : ''}
              </p>
            )}
            {(item._redditImages || []).filter(url => url !== item.imageUrl).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(item._redditImages || []).filter(url => url !== item.imageUrl).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Post image ${i + 1}`}
                    className="max-h-48 rounded border border-slate-700 object-contain opacity-60 cursor-zoom-in"
                    onClick={() => setLightboxUrl(url)}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : enriching ? (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-800/50">
            <div className="w-3 h-3 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
            <span className="text-sm text-rose-300">Loading full details…</span>
          </div>
        ) : null}

        {item?._redditParseError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300">
            Could not parse post: {item._redditParseError}.{' '}
            {item._redditPermalink && (
              <a
                href={`https://reddit.com${item._redditPermalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-red-200"
              >
                View on Reddit
              </a>
            )}
          </div>
        )}

        {/* Reddit post preview — shown for unparsed stubs that are not currently being parsed */}
        {needsRedditParse(item) && !enriching && !item?._redditParseError && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
              {item._redditAuthor && <span>by u/{item._redditAuthor}</span>}
              {item._redditSubreddit && <span>· r/{item._redditSubreddit}</span>}
              {item._redditFlair && (
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">{item._redditFlair}</span>
              )}
              {item._redditPermalink && (
                <a
                  href={`https://reddit.com${item._redditPermalink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-orange-400 hover:text-orange-300"
                >
                  <ExternalLink size={12} /> Reddit
                </a>
              )}
            </div>

            {item._redditSelftext && (
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed mb-3 max-h-64 overflow-y-auto pr-1">
                {item._redditSelftext}
              </div>
            )}

            {(() => {
              const extraImages = (item._redditImages || []).filter(url => url !== item.imageUrl);
              return extraImages.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {extraImages.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Post image ${i + 1}`}
                      className="max-h-64 rounded border border-slate-700 object-contain cursor-zoom-in"
                      onClick={() => setLightboxUrl(url)}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ))}
                </div>
              ) : null;
            })()}

            {!item._redditSelftext && (!item._redditImages || item._redditImages.length === 0) && (
              <p className="text-sm text-slate-500 italic mb-3">No post text or images available.</p>
            )}

            {onParseReddit && (
              <button
                onClick={onParseReddit}
                className="px-4 py-2 rounded font-medium flex items-center gap-2 text-sm bg-orange-700 hover:bg-orange-600 text-white transition-colors"
              >
                <Sparkles size={14} /> Parse with AI
              </button>
            )}
          </div>
        )}

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

      {/* Lightbox overlay for Reddit images */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Enlarged image"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
