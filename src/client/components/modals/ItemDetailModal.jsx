import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Undo2, Redo2, Trash2, Sparkles, RefreshCw, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { ItemActionButtons } from '../ItemActionButtons.jsx';
import { Tooltip } from '../Tooltip.jsx';
import { useAutoSaveUndo } from '../../lib/useAutoSaveUndo.js';
import { AdversaryCardContent, EnvironmentCardContent } from '../DetailCardContent.jsx';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';
import { SceneForm } from '../forms/SceneForm.jsx';
import { AdventureForm } from '../forms/AdventureForm.jsx';
import { ExpandedTablePreview } from '../ItemDetailView.jsx';
import { SOURCE_BADGE, isOwnItem } from '../../lib/constants.js';
import { MarkdownText } from '../../lib/markdown.js';
import { computeSceneBudget } from '../../lib/battle-points.js';
import { generateId } from '../../lib/helpers.js';
import { getBaselineStats, getUnscaledAdversary, computeScaledStats } from '../../lib/adversary-defaults.js';

const COLLECTION_LABELS = {
  adversaries: 'Adversary',
  environments: 'Environment',
  scenes: 'Scene',
  adventures: 'Adventure',
};

/**
 * Compact battle budget summary bar for scene detail view.
 * Shows tier, BP cost, adjusted budget with modifiers.
 * Includes an inline party size control so the user can adjust it right here.
 */
function SceneBudgetBar({ item, data, partySize = 4, onPartySizeChange }) {
  const { tier, bp, budget, autoMods, userMods, totalMod, adjustedBudget } = computeSceneBudget(item, data, partySize);

  const hasAdversaries = bp > 0 || tier != null;
  if (!hasAdversaries) return null;

  const diff = bp - adjustedBudget;
  const diffColor = diff > 0 ? 'text-red-400' : diff < 0 ? 'text-emerald-400' : 'text-slate-400';

  const activeMods = [
    autoMods.twoOrMoreSolos.active && { label: '2+ Solos', value: -2, auto: true },
    autoMods.lowerTierAdversary.active && { label: 'Lower-tier adversary', value: +1, auto: true },
    autoMods.noHeavyRoles.active && { label: 'No heavy roles', value: +1, auto: true },
    userMods.lessDifficult && { label: 'Less difficult', value: -1, auto: false },
    userMods.damageBoostD4 && { label: '+1d4 damage', value: -2, auto: false },
    userMods.damageBoostStatic && { label: '+2 damage', value: -2, auto: false },
    userMods.moreDangerous && { label: 'More dangerous', value: +2, auto: false },
  ].filter(Boolean);

  return (
    <div className="mb-3 p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg">
      <div className="flex items-center gap-3 flex-wrap">
        {tier != null && (
          <span className="relative inline-flex items-center justify-center w-6 h-6 shrink-0" title={`Tier ${tier}`}>
            <svg viewBox="0 0 20 22" className="absolute inset-0 w-full h-full" fill="none">
              <path d="M10 1L19 5v7c0 5-4 8-9 9C5 20 1 17 1 12V5l9-4z" fill="#0f2040" stroke="#3b82f6" strokeWidth="1.5" />
            </svg>
            <span className="relative text-[11px] font-bold text-blue-200 leading-none mt-0.5">{tier}</span>
          </span>
        )}
        <span className="text-sm text-slate-300">
          <span className="font-bold text-white">{bp}</span>
          <span className="text-slate-500"> BP</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-sm text-slate-300">
          Budget <span className="font-bold text-white">{adjustedBudget}</span>
          {totalMod !== 0 && (
            <span className={`ml-1 text-xs ${totalMod > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ({totalMod > 0 ? '+' : ''}{totalMod})
            </span>
          )}
        </span>
        <span className={`text-xs font-semibold ${diffColor}`}>
          {diff === 0 ? 'On budget' : diff > 0 ? `+${diff} over budget` : `${Math.abs(diff)} under budget`}
        </span>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-slate-500">PCs</span>
          <input
            type="number"
            min={1}
            max={8}
            value={partySize}
            onChange={e => onPartySizeChange && onPartySizeChange(Math.max(1, Math.min(8, parseInt(e.target.value) || 4)))}
            onClick={e => e.stopPropagation()}
            className="w-10 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-white text-xs text-center"
          />
        </div>
      </div>
      {activeMods.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {activeMods.map((m, i) => (
            <span
              key={i}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                m.value > 0
                  ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300'
                  : 'bg-red-900/40 border-red-700/50 text-red-300'
              } ${m.auto ? '' : 'border-dashed'}`}
            >
              {m.label} {m.value > 0 ? '+' : ''}{m.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Unified item detail + edit modal.
 *
 * Editable items show a split layout:
 *   [Live Preview] | [Edit Form] | [Feature Library (adversaries/environments only, narrow)]
 *
 * Non-editable items (SRD/public/FCG) show only the display pane with a Clone action.
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
 *   onAddToTable  – optional () => void
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
  onEdit,
  isAdmin = false,
  onClose,
  partySize = 4,
  onPartySizeChange,
  onMergeAdversary,
}) {
  const isNew = !item?.id;
  const showFeatureLibrary = editable && (collection === 'adversaries' || collection === 'environments');

  const [libraryPortal, setLibraryPortal] = useState(null);
  const [cloningStatus, setCloningStatus] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [showScaled, setShowScaled] = useState(true);
  const overlayRef = useRef(null);

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
    })() : {};
    initialRef.current = {
      ...defaultsForNew,
      ...raw,
      features: ensureIds(raw.features),
      experiences: ensureIds(raw.experiences),
    };
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
    return { ...baseDisplayItem, ...scaled, tier: info.toTier, name: `[Scaled] ${baseName}`, _scaledFromTier: info.fromTier };
  })();
  const badge = SOURCE_BADGE[item?._source];
  const isOwn = isOwnItem(item);

  // --- Display Pane content ---
  const renderDisplayContent = () => {
    const allImages = [displayItem.imageUrl].filter(Boolean);
    const hasCarousel = allImages.length > 1;
    const safeIdx = allImages.length > 0 ? carouselIdx % allImages.length : 0;

    return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 relative">
        {!!displayItem.imageUrl && (
          <div
            className="absolute top-0 right-0 w-16 aspect-square overflow-hidden rounded-bl-xl cursor-pointer group"
            onClick={() => setLightboxUrl(allImages[safeIdx])}>
            <img
              src={allImages[safeIdx]}
              alt={displayItem.name}
              className="w-full h-full object-cover opacity-90"
              onError={e => { e.target.parentElement.style.display = 'none'; }}
            />
            {hasCarousel && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setCarouselIdx((safeIdx - 1 + allImages.length) % allImages.length); }}
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setCarouselIdx((safeIdx + 1) % allImages.length); }}
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                >
                  <ChevronRight size={12} />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                  {allImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); setCarouselIdx(i); }}
                      className={`w-1 h-1 rounded-full transition-colors ${i === safeIdx ? 'bg-white' : 'bg-white/40 hover:bg-white/70'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div>
        {editable && (
          <div className={`mb-3 flex items-center gap-2 flex-wrap ${!!displayItem.imageUrl ? 'pr-20' : ''}`}>
            <h3 className="text-xl font-bold text-white">
              {displayItem.name || <span className="text-slate-500 italic">Untitled</span>}
            </h3>
            {badge && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
        )}

        {enriching ? (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-800/50">
            <div className="w-3 h-3 rounded-full border-2 border-rose-400 border-t-transparent animate-spin" />
            <span className="text-sm text-rose-300">Loading full details…</span>
          </div>
        ) : null}

        {collection === 'adversaries' && (
          <AdversaryCardContent
            element={displayItem}
            hoveredFeature={null}
            cardKey="preview"
            scaledMeta={hasScaledToggle ? { fromTier: baseDisplayItem._scaledFromTier, showScaled } : null}
            onScaledToggle={() => setShowScaled(s => !s)}
          />
        )}
        {collection === 'environments' && (
          <EnvironmentCardContent element={displayItem} hoveredFeature={null} cardKey="preview" />
        )}
        {collection === 'scenes' && data && (
          <>
            {displayItem.description && (
              <MarkdownText text={displayItem.description} className="text-sm italic text-slate-300 mb-3" />
            )}
            <SceneBudgetBar item={displayItem} data={data} partySize={partySize} onPartySizeChange={onPartySizeChange} />
            <ExpandedTablePreview
              item={displayItem}
              tab={collection}
              data={data}
              onSaveElement={onSaveElement}
              isOwn={isOwn}
              damageBoost={
                displayItem.battleMods?.damageBoostD4 ? 'd4'
                : displayItem.battleMods?.damageBoostStatic ? 'static'
                : null
              }
            />
          </>
        )}
        {collection === 'adventures' && displayItem.description && (
          <MarkdownText text={displayItem.description} className="text-sm italic text-slate-300" />
        )}

        {/* Additional images (OCR'd stat block images or extra post images) */}
        {(displayItem._additionalImages || []).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {displayItem._additionalImages.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Additional image ${i + 1}`}
                className="max-h-64 rounded border border-slate-700 object-contain cursor-zoom-in"
                onClick={() => setLightboxUrl(url)}
                onError={e => { e.target.style.display = 'none'; }}
              />
            ))}
          </div>
        )}

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
      onPartySizeChange,
      onImageSaved: item?.id && saveImage ? (url, opts) => saveImage(collection, item.id, url, opts) : undefined,
      onMergeAdversary,
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
              <ItemActionButtons
                variant="header"
                isOwn={isOwn}
                onAddToTable={onAddToTable}
                onClone={onClone ? handleClone : undefined}
                onEdit={onEdit}
                onDelete={onDelete}
                cloningStatus={cloningStatus}
              />
              <Tooltip label="Close">
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={18} aria-hidden />
                </button>
              </Tooltip>
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
