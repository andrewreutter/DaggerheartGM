import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Undo2, Redo2, Trash2, Sparkles, RefreshCw, ExternalLink, Check } from 'lucide-react';
import { ItemActionButtons } from '../ItemActionButtons.jsx';
import { useAutoSaveUndo } from '../../lib/useAutoSaveUndo.js';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';
import { SceneForm } from '../forms/SceneForm.jsx';
import { AdventureForm } from '../forms/AdventureForm.jsx';
import { CharacterForm } from '../forms/CharacterForm.jsx';
import { SOURCE_BADGE, isOwnItem } from '../../lib/constants.js';
import { generateId } from '../../lib/helpers.js';
import { getBaselineStats, getUnscaledAdversary, computeScaledStats } from '../../lib/adversary-defaults.js';
import { useCharacterSrdData } from '../../lib/useCharacterSrdData.js';
import {
  CHARACTER_EDITOR_AUTOSAVE_HINT_KEY,
  ONBOARDING_RESET_EVENT,
  isCharacterEditorAutosaveHintDismissed,
} from '../../lib/onboarding-storage.js';
import { LibraryItemDisplayContent } from '../library/LibraryItemDisplayContent.jsx';
import { LibraryItemImageThumb } from '../library/LibraryItemImageThumb.jsx';
import { getLibraryItemImageUrls } from '../../lib/library-item-image-urls.js';
import { TierShieldBadge } from '../TierShieldBadge.jsx';
import { showLibraryTierShield } from '../../lib/library-tier-subtitle.js';

const COLLECTION_LABELS = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
  abilities: 'Ability',
  ancestries: 'Ancestry',
  armor: 'Armor',
  beastforms: 'Beastform',
  classes: 'Class',
  communities: 'Community',
  consumables: 'Consumable',
  domains: 'Domain',
  items: 'Item',
  subclasses: 'Subclass',
  weapons: 'Weapon',
};

/**
 * Unified item detail + edit modal.
 *
 * Editable items show a split layout:
 *   [Live Preview] | [Edit Form] | [Feature Library (adversaries/environments only, narrow)]
 *
 * Non-editable items (SRD/public/FCG) show only the display pane with a Clone action.
 *
 * Auto-saves on every change (debounced 800ms). Editable header shows status chips and a **Done** button (no separate close icon); characters may show a one-time dismissible tip. Provides infinite undo/redo within the session.
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
 *   onAddToTable  – optional () => void
 *   addToTableMenu – optional { tables: { id, name }[], onPick (tableId) => void }; when set, Play opens a table picker (Library)
 *   onEdit        – optional () => void
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
  saveImage,
  onDelete,
  onClone,
  onAddToTable,
  addToTableMenu,
  onEdit,
  isAdmin = false,
  onClose,
  partySize = 1,
  partyTier = 1,
  characters = [],
  onMergeAdversary,
}) {
  const isNew = !item?.id;
  const showFeatureLibrary = editable && (collection === 'adversaries' || collection === 'environments');

  const [libraryPortal, setLibraryPortal] = useState(null);
  const [cloningStatus, setCloningStatus] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showScaled, setShowScaled] = useState(true);
  const [charAutosaveHintDismissed, setCharAutosaveHintDismissed] = useState(isCharacterEditorAutosaveHintDismissed);
  const overlayRef = useRef(null);

  useEffect(() => {
    const onReset = () => setCharAutosaveHintDismissed(isCharacterEditorAutosaveHintDismissed());
    window.addEventListener(ONBOARDING_RESET_EVENT, onReset);
    return () => window.removeEventListener(ONBOARDING_RESET_EVENT, onReset);
  }, []);

  const dismissCharAutosaveHint = useCallback(() => {
    try {
      localStorage.setItem(CHARACTER_EDITOR_AUTOSAVE_HINT_KEY, '1');
    } catch {
      /* ignore quota / private mode */
    }
    setCharAutosaveHintDismissed(true);
  }, []);

  // Reset scaled toggle when item changes.
  useEffect(() => {
    setShowScaled(true);
  }, [item?.id]);

  // Build a stable initial value for useAutoSaveUndo.
  // Ensure features/experiences have unique IDs so list editors can key and update by ID.
  // For new items, merge in collection-specific defaults so forms have required shape (e.g. hp_thresholds, attack).
  const initialRef = useRef(null);
  if (!initialRef.current) {
    const raw = item || {};
    const ensureIds = (arr) => (arr || []).map(entry => entry.id ? entry : { ...entry, id: generateId() });
    const defaultsForNew = !raw.id && collection === 'adversaries' ? (() => {
      const baseline = getBaselineStats('standard', 1);
      return {
        tier: 1,
        role: 'standard',
        ...baseline,
        attack: { name: '', range: 'Melee', trait: 'Phy', ...baseline?.attack },
      };
    })() : !raw.id && collection === 'characters' ? {
      level: 1, baseTraits: {}, experiences: [{ name: '', score: 2, id: generateId() }, { name: '', score: 2, id: generateId() }],
    } : {};
    initialRef.current = {
      ...defaultsForNew,
      ...raw,
      // Assign a stable client-generated ID for new items so every auto-save
      // upserts the same row instead of creating a new one on each debounce fire.
      id: raw.id || generateId(),
      features: ensureIds(raw.features),
      ...(raw.experiences ? { experiences: ensureIds(raw.experiences) } : {}),
    };
  }

  const editorSessionKey = item?.id ?? initialRef.current?.id ?? collection;

  const { formData, setFormData, undo, redo, canUndo, canRedo, isSaving, debouncePending, showUnsavedDirtyHint, savedFlash } = useAutoSaveUndo({
    initial: initialRef.current,
    onSave: useCallback(async (d) => {
      if (onSave) await onSave(d);
    }, [onSave]),
    debounceMs: 800,
    isNew,
    sessionKey: editorSessionKey,
  });

  /** Amber "Unsaved" only after pointer/wheel/typing — not focus-trap autofocus (see onModalEditorUserGesture) */
  const [userHasInteractedWithEditor, setUserHasInteractedWithEditor] = useState(false);
  useEffect(() => {
    setUserHasInteractedWithEditor(false);
  }, [editorSessionKey]);

  /** Do not use focusin — modal/focus-trap autofocus would set this before any edit and bring back the amber flash */
  const onModalEditorUserGesture = useCallback((e) => {
    if (e.type === 'keydown') {
      const t = e.target;
      if (t?.tagName !== 'INPUT' && t?.tagName !== 'TEXTAREA' && t?.tagName !== 'SELECT') return;
      if (e.key === 'Tab' || e.key === 'Escape') return;
      setUserHasInteractedWithEditor(true);
      return;
    }
    setUserHasInteractedWithEditor(true);
  }, []);

  const { srdData: characterSrdData } = useCharacterSrdData();

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

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const baseDisplayItem = editable ? formData : item;
  const hasScaledToggle = collection === 'adversaries' && baseDisplayItem?._scaledFromTier != null;

  // Preserve scaled metadata when formData becomes unscaled (after toggle + edit), so we can recompute scaled view.
  const scaledInfoRef = useRef(null);
  useEffect(() => {
    if (collection === 'adversaries' && (editable ? formData : item)?._scaledFromTier != null) {
      const src = editable ? formData : item;
      scaledInfoRef.current = { fromTier: src._scaledFromTier, toTier: src.tier };
    }
  }, [collection, editable, formData?._scaledFromTier, formData?.tier, item?._scaledFromTier, item?.tier]);
  useEffect(() => {
    scaledInfoRef.current = null;
  }, [item?.id]);

  const displayItem = hasScaledToggle && !showScaled
    ? getUnscaledAdversary(baseDisplayItem)
    : baseDisplayItem;

  // Edit form should show the same data as the display pane when scaled toggle is active.
  const formValue = (() => {
    if (collection !== 'adversaries' || !hasScaledToggle) return baseDisplayItem;
    if (!showScaled) return getUnscaledAdversary(baseDisplayItem);
    if (baseDisplayItem._scaledFromTier != null) return baseDisplayItem;
    const info = scaledInfoRef.current;
    if (!info) return baseDisplayItem;
    const scaled = computeScaledStats(baseDisplayItem, baseDisplayItem.role || 'standard', baseDisplayItem.tier ?? info.fromTier, info.toTier);
    const baseName = (baseDisplayItem.name || '').replace(/^\[Scaled\]\s*/, '');
    return { ...baseDisplayItem, ...scaled, tier: info.toTier, name: baseName, _scaledFromTier: info.fromTier };
  })();
  const badge = SOURCE_BADGE[item?._source];
  const isOwn = isOwnItem(item);
  const headerItem = editable ? formData : item;
  const showTierByName = showLibraryTierShield(collection, headerItem);

  // --- Display Pane content ---
  const renderDisplayContent = () => {
    const allImages = getLibraryItemImageUrls(displayItem);

    return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 relative">
        <LibraryItemImageThumb item={displayItem} variant="modal" onOpenLightbox={setLightboxUrl} />
        <div className={allImages.length > 0 ? 'pr-32' : ''}>
        {editable && (
          <div className="mb-3">
            <h3 className="text-xl font-bold text-white truncate">
              {displayItem.name || <span className="text-slate-500 italic">Untitled</span>}
            </h3>
          </div>
        )}

        <LibraryItemDisplayContent
          item={displayItem}
          collection={collection}
          data={data}
          partySize={partySize}
          partyTier={partyTier}
          characters={characters}
          srdData={characterSrdData}
          enriching={enriching}
          adversaryScaledMeta={hasScaledToggle ? { fromTier: baseDisplayItem._scaledFromTier, showScaled } : null}
          onAdversaryScaledToggle={() => setShowScaled(s => !s)}
          onSaveElement={onSaveElement}
          isOwn={isOwn}
          cardKey="preview"
        />

        </div>
      </div>
    </div>
  );};

  // --- Edit Form Pane ---
  const renderFormContent = () => {
    const sharedProps = {
      value: collection === 'adversaries' && hasScaledToggle ? formValue : formData,
      onChange: setFormData,
      data,
      featureLibraryPortal: libraryPortal,
      partySize,
      partyTier,
      characters,
      onImageSaved: item?.id && saveImage ? (url, opts) => saveImage(collection, item.id, url, opts) : undefined,
      onMergeAdversary,
    };

    return (
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {collection === 'adversaries' && <AdversaryForm {...sharedProps} />}
        {collection === 'environments' && <EnvironmentForm {...sharedProps} />}
        {collection === 'scenes' && <SceneForm {...sharedProps} />}
        {collection === 'adventures' && <AdventureForm {...sharedProps} />}
        {collection === 'characters' && <CharacterForm {...sharedProps} />}
      </div>
    );
  };

  const maxWidth = showFeatureLibrary ? 'max-w-[110rem]' : editable ? 'max-w-[88rem]' : 'max-w-3xl';

  const showCharAutosaveHint = editable && collection === 'characters' && !charAutosaveHintDismissed;

  const saveStatus = (() => {
    if (!editable) return null;
    if (isSaving) {
      return <span className="text-xs text-slate-400 shrink-0">Saving…</span>;
    }
    if (showUnsavedDirtyHint && userHasInteractedWithEditor) {
      return <span className="text-xs text-amber-400/90 shrink-0">Unsaved changes…</span>;
    }
    if (savedFlash) {
      return (
        <span className="text-xs text-emerald-400/90 shrink-0 inline-flex items-center gap-1">
          <Check size={14} className="shrink-0" aria-hidden />
          Saved
        </span>
      );
    }
    return null;
  })();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 pt-[4.5rem] overflow-hidden"
      onClick={handleOverlayClick}
    >
      <div className={`flex gap-3 items-start w-full ${maxWidth}`}>
        {/* Main modal card */}
        <div
          className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex-1 min-w-0 flex flex-col overflow-hidden"
          style={{ height: 'calc(100dvh - 5.5rem)' }}
          {...(editable
            ? {
                onPointerDownCapture: onModalEditorUserGesture,
                onWheelCapture: onModalEditorUserGesture,
                onKeyDownCapture: onModalEditorUserGesture,
              }
            : {})}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 shrink-0 gap-3">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              {editable && (
                <>
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 mt-0.5"
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                    className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 mt-0.5"
                  >
                    <Redo2 size={16} />
                  </button>
                  <span className="w-px h-5 bg-slate-700 mx-1 shrink-0 mt-1" />
                </>
              )}
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                {showTierByName && (
                  <TierShieldBadge
                    tier={headerItem?.tier}
                    scaledFromTier={headerItem?._scaledFromTier}
                    className="shrink-0"
                  />
                )}
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  <h2 className="text-lg font-bold text-white truncate min-w-0">
                    {(editable ? formData.name : item?.name) ||
                      (isNew ? `New ${COLLECTION_LABELS[collection] || collection}` : 'Item')}
                  </h2>
                  {badge && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 shrink-0">
              <ItemActionButtons
                variant="header"
                isOwn={isOwn}
                itemName={displayItem?.name}
                addToTableMenu={addToTableMenu}
                onAddToTable={addToTableMenu ? undefined : onAddToTable}
                onClone={onClone ? handleClone : undefined}
                onEdit={onEdit}
                onDelete={onDelete}
                cloningStatus={cloningStatus}
              />
              {saveStatus}
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-medium text-slate-200 hover:text-white px-2.5 py-1.5 rounded-md border border-slate-600 hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>

          {showCharAutosaveHint && (
            <div className="flex items-start justify-between gap-3 px-5 py-2.5 border-b border-sky-900/40 bg-sky-950/35 shrink-0">
              <p className="text-sm text-sky-100/95 leading-snug">
                First time here? Your character is saved to your library as soon as you name them; after that, every change saves automatically. Close whenever you are finished.
              </p>
              <button
                type="button"
                onClick={dismissCharAutosaveHint}
                className="text-sm font-medium shrink-0 px-2.5 py-1 rounded-md bg-sky-900/80 hover:bg-sky-800 text-sky-100 border border-sky-700/60 transition-colors"
              >
                Got it
              </button>
            </div>
          )}

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
            style={{ height: 'calc(100dvh - 5.5rem)' }}
          />
        )}
      </div>

      {/* Lightbox overlay for images */}
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
