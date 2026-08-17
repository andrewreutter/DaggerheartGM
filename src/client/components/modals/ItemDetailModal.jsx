import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { X, Undo2, Redo2, Trash2, Sparkles, RefreshCw, ExternalLink, Check, User, AlertTriangle } from 'lucide-react';
import { ItemActionButtons } from '../ItemActionButtons.jsx';
import { useAutoSaveUndo } from '../../lib/useAutoSaveUndo.js';
import { AdversaryForm } from '../forms/AdversaryForm.jsx';
import { EnvironmentForm } from '../forms/EnvironmentForm.jsx';
import { SceneForm } from '../forms/SceneForm.jsx';
import { MapForm } from '../forms/MapForm.jsx';
import { AdventureForm } from '../forms/AdventureForm.jsx';
import { CharacterForm } from '../forms/CharacterForm.jsx';
import { GenericSrdLibraryForm } from '../forms/GenericSrdLibraryForm.jsx';
import { SOURCE_BADGE, isOwnItem, DEFAULT_CHARACTER_STARTING_HOPE } from '../../lib/constants.js';
import { isCatalogSource } from '../../lib/library-catalog-edit.js';
import { generateId } from '../../lib/helpers.js';
import { ensureEditorListIds } from '../../lib/ensure-editor-list-ids.js';
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
import { LevelBadge } from '../LevelBadge.jsx';
import { showLibraryTierShield, showLibraryLevelBadge } from '../../lib/library-tier-subtitle.js';
import {
  resolveV2FeatureSourcePath,
  resolveV2LibraryItemSourcePath,
} from '../../../features-v2/resolve-feature-source-path.js';
import { MarkdownText } from '../../lib/markdown.js';
import { V2SourceInspectButton } from '../V2SourceInspectButton.jsx';
import { SRD_UNIFIED_COLLECTIONS, LIBRARY_CUSTOM_DETAIL_COLLECTIONS } from '../../lib/library-filter-config.js';
import { buildDefaultNewSrdLibraryItem } from '../../lib/library-default-new-item.js';
import { buildEmptyLibraryMap, isLibraryMapPersistable, persistLibraryMap } from '../../lib/map-library.js';
import { isCharacterComplete } from '../../lib/character-calc.js';
import { CharacterIdentityTitleRow } from '../CharacterDisplay.jsx';
import { useUnifiedImport } from '../../lib/unified-import-context.jsx';

const SRD_UNIFIED_SET = new Set(SRD_UNIFIED_COLLECTIONS);

const COLLECTION_LABELS = {
  adversaries: 'Adversary',
  environments: 'Environment',
  maps: 'Map',
  scenes: 'Scene',
  adventures: 'Adventure',
  characters: 'Character',
  abilities: 'Ability',
  ancestries: 'Ancestry',
  armor: 'Armor',
  beastforms: 'Beastform',
  campaign_frames: 'Campaign Frame',
  classes: 'Class',
  communities: 'Community',
  consumables: 'Consumable',
  domains: 'Domain',
  items: 'Item',
  rules: 'Rule',
  subclasses: 'Subclass',
  weapons: 'Weapon',
  features: 'Feature',
};

/**
 * Unified item detail + edit modal.
 *
 * Editable items show a split layout:
 *   [Live Preview] | [Edit Form] | [Feature Library (adversaries/environments only, narrow)]
 *
 * Non-editable items (SRD/public, including Fresh Cut Grass catalog) show only the display pane with a Clone action.
 *
 * Auto-saves on every change (debounced 800ms). Editable header shows status chips and a **Done** button (no separate close icon); characters may show a one-time dismissible tip. Provides infinite undo/redo within the session.
 * Keyboard: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z = redo, Escape = close lightbox (if open) or close modal.
 *
 * Props:
 *   item          – item to view/edit (pass `{}` for new)
 *   collection    – 'adversaries' | 'environments' | 'scenes' | 'adventures'
  *   data          – app-level data for ref resolution (adventure sub-item preview)
 *   editable      – boolean; false for catalog/public items unless admin is editing official SRD/DT
 *   officialCatalogEdit – optional; when true, show the “official catalog” warning chip. Defaults to editable + srd/dt `_source` (Library). Game Table copy mode must pass false.
 *   onSave        – async (formData) => void; called by auto-save with full item data
   *   onSaveElement – optional; for scene inline element edits
 *   onDelete      – optional () => void
 *   onClone       – optional async () => void
 *   onAddToTable  – optional () => void
 *   addToTableMenu – optional { tables: { id, name }[], onPick (tableId) => void }; when set, Play opens a table picker (Library)
 *   onEdit        – optional () => void
 *   onClose       – () => void
 *   presentation  – 'center' (default) full-screen modal; 'rightDrawer' slides the editor in from the right (form only, no preview — Game Table character edit).
 *   rightDrawerPortalTo — optional; with `rightDrawer`, mount the editor into this element (unified sheet card on the Game Table). Omit for fixed-viewport fallback; `null` means waiting for the portal node.
 *   onCharacterDrawerChromeSync — optional; when the Game Table portals the character editor, called with form + save UI state for the shared title bar (header is omitted in the modal).
 *   isNew         – optional override for autosave gating. Defaults to `!item?.id`. Game Table "Create new character" stubs already have an id (table row + deep-link) but must still skip library save until named — pass `true` when `editState.mode === 'new'`.
 */
export const ItemDetailModal = forwardRef(function ItemDetailModal({
  item,
  collection,
  data,
  editable,
  onSave,
  onSaveElement,
  saveImage,
  onDelete,
  onClone,
  onAddToTable,
  addToTableMenu,
  onEdit,
  isAdmin = false,
  officialCatalogEdit,
  onClose,
  partySize = 1,
  partyTier = 1,
  characters = [],
  onMergeAdversary,
  presentation = 'center',
  rightDrawerPortalTo,
  onCharacterDrawerChromeSync,
  pendingCharacterAiConcept,
  onPendingCharacterAiConceptConsumed,
  pendingAdversaryAiConcept,
  onPendingAdversaryAiConceptConsumed,
  pendingEnvironmentAiConcept,
  onPendingEnvironmentAiConceptConsumed,
  /** Game Table: level history preview slider (1…saved level) */
  characterLevelPreview,
  onCharacterLevelPreviewChange,
  isNew: isNewProp,
  libraryCardDimensions = null,
  userUid,
}, ref) {
  // Prefer explicit override: Game Table new-character stubs carry an id before the first library save.
  const isNew = typeof isNewProp === 'boolean' ? isNewProp : !item?.id;
  const isRightDrawer = presentation === 'rightDrawer';
  const showFeatureLibrary = editable && (collection === 'adversaries' || collection === 'environments') && !isRightDrawer;

  const [libraryPortal, setLibraryPortal] = useState(null);
  const [cloningStatus, setCloningStatus] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showScaled, setShowScaled] = useState(true);
  const [charAutosaveHintDismissed, setCharAutosaveHintDismissed] = useState(isCharacterEditorAutosaveHintDismissed);
  const overlayRef = useRef(null);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [aiConceptBusy, setAiConceptBusy] = useState(false);

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
  const prevItemIdForInitialRef = useRef(item?.id);
  if (prevItemIdForInitialRef.current !== item?.id) {
    prevItemIdForInitialRef.current = item?.id;
    initialRef.current = null;
  }
  if (!initialRef.current) {
    const raw = item || {};
    let defaultsForNew = {};
    if (!raw.id) {
      if (collection === 'adversaries') {
        const baseline = getBaselineStats('standard', 1);
        defaultsForNew = {
          tier: 1,
          role: 'standard',
          ...baseline,
          attack: { name: '', range: 'Melee', trait: 'Phy', ...baseline?.attack },
        };
      } else if (collection === 'characters') {
        defaultsForNew = {
          level: 1,
          baseTraits: {},
          hope: DEFAULT_CHARACTER_STARTING_HOPE,
          experiences: [
            { name: '', score: 2, id: generateId() },
            { name: '', score: 2, id: generateId() },
          ],
        };
      } else if (collection === 'maps') {
        defaultsForNew = buildEmptyLibraryMap();
      } else if (SRD_UNIFIED_SET.has(collection)) {
        defaultsForNew = buildDefaultNewSrdLibraryItem(collection);
      }
    }
    const experiencesSource =
      raw.experiences !== undefined
        ? raw.experiences
        : defaultsForNew.experiences !== undefined
          ? defaultsForNew.experiences
          : [];
    initialRef.current = {
      ...defaultsForNew,
      ...raw,
      // Assign a stable client-generated ID for new items so every auto-save
      // upserts the same row instead of creating a new one on each debounce fire.
      id: raw.id || generateId(),
      features: ensureEditorListIds(raw.features),
      experiences: ensureEditorListIds(experiencesSource),
    };
  }

  const editorSessionKey = item?.id ?? initialRef.current?.id ?? collection;

  useEffect(() => {
    setAiConceptBusy(false);
  }, [editorSessionKey]);

  useLayoutEffect(() => {
    if (!isRightDrawer) {
      setDrawerEntered(false);
      return;
    }
    if (rightDrawerPortalTo !== undefined) {
      setDrawerEntered(false);
      return;
    }
    setDrawerEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isRightDrawer, rightDrawerPortalTo, editorSessionKey]);

  const { formData, setFormData, undo, redo, canUndo, canRedo, isSaving, savedOnce, debouncePending, showUnsavedDirtyHint, savedFlash } = useAutoSaveUndo({
    initial: initialRef.current,
    onSave: useCallback(async (d) => {
      if (!onSave) return;
      await onSave(collection === 'maps' ? persistLibraryMap(d) : d);
    }, [onSave, collection]),
    debounceMs: 800,
    isNew,
    sessionKey: editorSessionKey,
    canPersistNew: collection === 'maps' ? isLibraryMapPersistable : undefined,
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

  // Register the open editable character/adversary item with the UnifiedImportProvider so that
  // image paste/drop shows "Add to [Name]" in the quick-pick menu.
  const {
    registerEditableItem,
    unregisterEditableItem,
    registerMapEditorReplace,
    unregisterMapEditorReplace,
  } = useUnifiedImport();

  // A ref always points to the latest formData so the callback below never goes stale.
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Stable callback — reads formDataRef at call time, mirrors ImageEditor.handleAddUrl semantics.
  const addImageUrlToItem = useCallback((url) => {
    const fd = formDataRef.current;
    const additional = Array.isArray(fd._additionalImages) ? fd._additionalImages : [];
    const willSetPrimary = !fd.imageUrl && !fd.mapImageUrl;
    setFormData(willSetPrimary
      ? { ...fd, imageUrl: url, ...(collection === 'maps' ? { mapImageUrl: url } : {}) }
      : { ...fd, _additionalImages: [...additional, url] });
    // Persist to DB immediately so the library record is updated and character-library-update is broadcast.
    if (item?.id && saveImage) {
      saveImage(
        collection,
        item.id,
        willSetPrimary ? url : fd.imageUrl,
        { _additionalImages: willSetPrimary ? additional : [...additional, url] },
      ).catch(console.error);
    }
  }, [setFormData, item?.id, saveImage, collection]);

  // Same semantics as addImageUrlToItem, but targets the character's `companion` sub-object
  // (e.g. Beastbound) via saveImage's generic nested `path` option — no server changes needed.
  const addImageUrlToCompanion = useCallback((url) => {
    const fd = formDataRef.current;
    const comp = fd?.companion;
    if (!comp || typeof comp !== 'object') return;
    const additional = Array.isArray(comp._additionalImages) ? comp._additionalImages : [];
    const willSetPrimary = !comp.imageUrl;
    const nextComp = willSetPrimary
      ? { ...comp, imageUrl: url }
      : { ...comp, _additionalImages: [...additional, url] };
    setFormData({ ...fd, companion: nextComp });
    if (item?.id && saveImage) {
      saveImage(
        collection,
        item.id,
        willSetPrimary ? url : comp.imageUrl,
        { _additionalImages: willSetPrimary ? additional : [...additional, url], path: 'companion' },
      ).catch(console.error);
    }
  }, [setFormData, item?.id, saveImage, collection]);

  const companionForImageTarget =
    collection === 'characters' && formData?.companion && typeof formData.companion === 'object'
      ? formData.companion
      : null;

  useEffect(() => {
    if (!editable || (collection !== 'characters' && collection !== 'adversaries')) return;
    registerEditableItem({
      name: formData?.name,
      collection,
      onAddImageUrl: addImageUrlToItem,
      extraTargets: companionForImageTarget
        ? [{
            key: 'companion',
            label: companionForImageTarget.name ? String(companionForImageTarget.name) : 'Companion',
            onAddImageUrl: addImageUrlToCompanion,
          }]
        : undefined,
    });
    return unregisterEditableItem;
  // formData?.name / companion presence+name are intentionally included so the menu labels stay
  // current. addImageUrlToItem/addImageUrlToCompanion are stable; re-registration just updates
  // the ref in the context.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editable,
    collection,
    formData?.name,
    !!companionForImageTarget,
    companionForImageTarget?.name,
    addImageUrlToItem,
    addImageUrlToCompanion,
    registerEditableItem,
    unregisterEditableItem,
  ]);

  // Stable callback that replaces the primary image for a library Map item (not append).
  // Called by the provider after it uploads the file and obtains a Storage URL.
  const replaceMapImageUrl = useCallback((url) => {
    const fd = formDataRef.current;
    setFormData({ ...fd, imageUrl: url, mapImageUrl: url });
    if (item?.id && saveImage) {
      saveImage(
        collection,
        item.id,
        url,
        { _additionalImages: Array.isArray(fd._additionalImages) ? fd._additionalImages : [] },
      ).catch(console.error);
    }
  }, [setFormData, item?.id, saveImage, collection]);

  // Register with the UnifiedImportProvider so that paste/drop while a library Map Editor is
  // open replaces the map's primary image (instead of opening the full import modal).
  useEffect(() => {
    if (!editable || collection !== 'maps') return;
    registerMapEditorReplace(replaceMapImageUrl);
    return unregisterMapEditorReplace;
  }, [editable, collection, replaceMapImageUrl, registerMapEditorReplace, unregisterMapEditorReplace]);

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
      else if (e.key === 'Escape') {
        if (lightboxUrl) setLightboxUrl(null);
        // Nested FullPageOverlay (scene note / countdown editors, item picker).
        else if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        else if (!aiConceptBusy) onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo, onClose, lightboxUrl, setLightboxUrl, aiConceptBusy]);

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
    if (e.target === overlayRef.current && !aiConceptBusy) onClose();
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

  /** Live preview pane: Hope / Stress / Armor / HP tracks on the new character sheet. */
  const onCharacterRuntimeUpdate = useMemo(
    () =>
      editable && collection === 'characters'
        ? (patch) => setFormData({ ...formData, ...patch })
        : undefined,
    [editable, collection, formData, setFormData],
  );

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
  const editingOfficialCatalog = officialCatalogEdit ?? (editable && isCatalogSource(item));
  const v2LibrarySourcePath = useMemo(() => {
    if (collection === 'features' && item?._resolveV2) {
      return resolveV2FeatureSourcePath({ ...item._resolveV2, name: item.name });
    }
    return item?._source === 'srd' ? resolveV2LibraryItemSourcePath(collection, item) : null;
  }, [collection, item]);
  const headerItem = editable ? formData : item;
  const showTierByName = showLibraryTierShield(collection, headerItem);
  const showLevelByName = showLibraryLevelBadge(collection, headerItem);

  // --- Display Pane content ---
  const renderDisplayContent = () => {
    if (collection === 'features') {
      return (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <p className="text-sm text-dh-muted">
              <span className="font-medium text-dh">{item?._scope}</span>
              {item?._parentName != null && item?._parentName !== '' ? (
                <>
                  {' · '}
                  <span>{item._parentName}</span>
                </>
              ) : null}
            </p>
            {item?.description ? (
              <MarkdownText text={item.description} className="dh-md text-sm text-dh" />
            ) : (
              <p className="text-sm text-dh-muted italic">No description in catalog.</p>
            )}
          </div>
        </div>
      );
    }

    const allImages = getLibraryItemImageUrls(displayItem);

    return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 relative">
        <LibraryItemImageThumb item={displayItem} variant="modal" onOpenLightbox={setLightboxUrl} />
        <div className={allImages.length > 0 ? 'pr-32' : ''}>
        {editable && (
          <div className="mb-3">
            <h3 className="text-xl font-bold text-white truncate">
              {displayItem.name || <span className="text-dh-muted italic">Untitled</span>}
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
          adversaryScaledMeta={hasScaledToggle ? { fromTier: baseDisplayItem._scaledFromTier, showScaled } : null}
          onAdversaryScaledToggle={() => setShowScaled(s => !s)}
          onSaveElement={onSaveElement}
          isOwn={isOwn}
          cardKey="preview"
          onCharacterRuntimeUpdate={onCharacterRuntimeUpdate}
          onOpenImageLightbox={setLightboxUrl}
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
      ...(['characters', 'adversaries', 'environments'].includes(collection)
        ? { onAiBusyChange: setAiConceptBusy }
        : {}),
      ...(collection === 'characters' && pendingCharacterAiConcept
        ? {
            autoRunAiConcept: pendingCharacterAiConcept,
            onAutoRunAiConceptConsumed: onPendingCharacterAiConceptConsumed,
            autoRunSessionKey: editorSessionKey,
          }
        : {}),
      ...(collection === 'adversaries' && pendingAdversaryAiConcept
        ? {
            autoRunAiConcept: pendingAdversaryAiConcept,
            onAutoRunAiConceptConsumed: onPendingAdversaryAiConceptConsumed,
            autoRunSessionKey: editorSessionKey,
          }
        : {}),
      ...(collection === 'environments' && pendingEnvironmentAiConcept
        ? {
            autoRunAiConcept: pendingEnvironmentAiConcept,
            onAutoRunAiConceptConsumed: onPendingEnvironmentAiConceptConsumed,
            autoRunSessionKey: editorSessionKey,
          }
        : {}),
      ...(collection === 'characters' && characterLevelPreview !== undefined
        ? { levelPreview: characterLevelPreview }
        : {}),
    };

    const formScrollClass = `flex-1 min-h-0 overflow-y-auto p-4 ${isRightDrawer ? '[scrollbar-gutter:stable]' : ''}`;

    const genericForm = (
      <>
        {collection === 'adversaries' && <AdversaryForm {...sharedProps} />}
        {collection === 'environments' && <EnvironmentForm {...sharedProps} />}
        {collection === 'maps' && <MapForm {...sharedProps} />}
        {collection === 'scenes' && (
          <SceneForm
            {...sharedProps}
            libraryCardDimensions={libraryCardDimensions}
            userUid={userUid}
          />
        )}
        {collection === 'adventures' && <AdventureForm {...sharedProps} />}
        {collection === 'characters' && (
          <CharacterForm {...sharedProps} levelingToolsSessionKey={editorSessionKey} />
        )}
        {!LIBRARY_CUSTOM_DETAIL_COLLECTIONS.has(collection) && (
          <GenericSrdLibraryForm
            value={formData}
            onChange={setFormData}
            collection={collection}
            formData={formData}
            onImageSaved={item?.id && saveImage ? (url, opts) => saveImage(collection, item.id, url, opts) : undefined}
          />
        )}
      </>
    );

    if (collection === 'scenes' || collection === 'maps') {
      return (
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden p-3">
          {genericForm}
        </div>
      );
    }

    if (collection === 'characters') {
      const charCheck = isCharacterComplete(
        formData,
        characterSrdData ? { srdData: characterSrdData } : undefined,
      );
      const charIncomplete = !charCheck.complete;
      return (
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Always-on strip so the form does not jump when completion flips; incomplete vs complete share the same slot. */}
          <div
            className={`shrink-0 px-4 pt-3 pb-2 border-b ${
              charIncomplete
                ? 'border-amber-800/45 bg-amber-950/30'
                : 'border-emerald-800/40 bg-emerald-950/25'
            }`}
            role="status"
            aria-live="polite"
          >
            <div
              className={`flex items-start gap-2 px-2.5 py-2 rounded-md border text-[11px] text-dh ${
                charIncomplete
                  ? 'border-amber-700/60 bg-amber-950/45'
                  : 'border-emerald-700/55 bg-emerald-950/40'
              }`}
            >
              {charIncomplete ? (
                <>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" aria-hidden />
                  <p className="min-w-0 leading-relaxed">
                    <span className="font-semibold text-amber-100/95">Incomplete — </span>
                    missing: {charCheck.missing.join(', ')}
                  </p>
                </>
              ) : (
                <>
                  <Check size={14} className="shrink-0 mt-0.5 text-emerald-400" aria-hidden />
                  <p className="min-w-0 leading-relaxed">
                    <span className="font-semibold text-emerald-100/95">Complete — </span>
                    all required fields are filled.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className={formScrollClass}>{genericForm}</div>
        </div>
      );
    }

    return (
      <div className={formScrollClass}>
        {genericForm}
      </div>
    );
  };

  const maxWidth =
    (collection === 'scenes' || collection === 'maps') && editable ? 'max-w-[110rem]' :
    showFeatureLibrary ? 'max-w-[110rem]' :
    editable ? 'max-w-[88rem]' :
    collection === 'characters' ? 'max-w-[88rem]' :
    'max-w-3xl';

  /** Match main card + overlay padding so the feature-library column cannot stretch the row past the viewport (avoids vertical center clipping). */
  const libraryModalMaxHClass = 'max-h-[calc(100dvh-5.5rem)]';

  const showCharAutosaveHint = editable && collection === 'characters' && !charAutosaveHintDismissed;

  const saveStatus = (() => {
    if (!editable) return null;
    if (isSaving) {
      return (
        <span className={`text-xs shrink-0 ${isRightDrawer ? 'dh-text-spellcast-header-sub' : 'text-dh-muted'}`}>
          Saving…
        </span>
      );
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

  const editorGestureProps = editable
    ? {
        onPointerDownCapture: onModalEditorUserGesture,
        onWheelCapture: onModalEditorUserGesture,
        onKeyDownCapture: onModalEditorUserGesture,
      }
    : {};

  const isCharacterRightDrawer = isRightDrawer && collection === 'characters';
  const hidePortaledCharacterHeader = isCharacterRightDrawer && rightDrawerPortalTo;

  useImperativeHandle(
    ref,
    () => ({
      undo,
      redo,
      canUndo,
      canRedo,
      // Lets a caller (Game Table) check on close whether a `isNew` stub was ever
      // actually persisted, so it can discard an abandoned-before-naming stub.
      savedOnce,
    }),
    [undo, redo, canUndo, canRedo, savedOnce],
  );

  useEffect(() => {
    if (!hidePortaledCharacterHeader || !onCharacterDrawerChromeSync) return;
    onCharacterDrawerChromeSync({
      formData,
      isSaving,
      showUnsavedDirtyHint,
      userHasInteractedWithEditor,
      savedFlash,
      canUndo,
      canRedo,
      aiConceptBusy,
    });
  }, [
    hidePortaledCharacterHeader,
    onCharacterDrawerChromeSync,
    formData,
    isSaving,
    showUnsavedDirtyHint,
    userHasInteractedWithEditor,
    savedFlash,
    canUndo,
    canRedo,
    aiConceptBusy,
  ]);

  const mainCardBody = (
    <>
          {/* Header — omitted when Game Table provides a shared title bar above sheet + editor (portaled character editor). */}
          {!hidePortaledCharacterHeader && (
          <div
            className={
              isRightDrawer
                ? 'flex items-center justify-between px-3 py-2.5 border-b dh-tint-spellcast-strip shrink-0 gap-2'
                : 'flex items-center justify-between px-5 py-3 border-b border-dh-border shrink-0 gap-3'
            }
          >
            {isCharacterRightDrawer ? (
              <>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <User size={14} className="dh-text-magic-icon shrink-0" aria-hidden />
                  {editable && (
                    <>
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={undo}
                        disabled={!canUndo}
                        title="Undo (Ctrl+Z)"
                        className="p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <Undo2 size={14} />
                      </button>
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={redo}
                        disabled={!canRedo}
                        title="Redo (Ctrl+Shift+Z)"
                        className="p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        <Redo2 size={14} />
                      </button>
                      <span className="w-px h-4 self-center bg-dh-strong/50 mx-0.5 shrink-0" />
                    </>
                  )}
                  <div className="min-w-0 flex-1">
                    <CharacterIdentityTitleRow el={formData} showIncomplete>
                      {badge && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
                    </CharacterIdentityTitleRow>
                  </div>
                </div>
                <div className="flex justify-end shrink-0 items-center gap-1.5">
                  <ItemActionButtons
                    variant="header"
                    isOwn={isOwn}
                    canEdit={editable}
                    itemName={displayItem?.name}
                    addToTableMenu={addToTableMenu}
                    onAddToTable={addToTableMenu ? undefined : onAddToTable}
                    onClone={onClone ? handleClone : undefined}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    cloningStatus={cloningStatus}
                  />
                  {saveStatus}
                  {v2LibrarySourcePath ? <V2SourceInspectButton relativePath={v2LibrarySourcePath} variant="header" /> : null}
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={onClose}
                    disabled={aiConceptBusy}
                    title={aiConceptBusy ? 'Cancel AI build or wait to close' : undefined}
                    className="text-xs font-medium dh-text-spellcast-header px-2 py-1 rounded-md border border-dh-strong/40 hover:bg-dh-raised/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
            <div className={`flex gap-2 min-w-0 flex-1 ${isRightDrawer ? 'items-center' : 'items-start'}`}>
              {isRightDrawer && (
                <User size={14} className="dh-text-magic-icon shrink-0" aria-hidden />
              )}
              {editable && (
                <>
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                    className={
                      isRightDrawer
                        ? 'p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0'
                        : 'p-1.5 rounded text-dh-muted hover:text-dh hover:bg-dh-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 mt-0.5'
                    }
                  >
                    <Undo2 size={isRightDrawer ? 14 : 16} />
                  </button>
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                    className={
                      isRightDrawer
                        ? 'p-1 rounded text-dh-muted hover:text-sky-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0'
                        : 'p-1.5 rounded text-dh-muted hover:text-dh hover:bg-dh-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0 mt-0.5'
                    }
                  >
                    <Redo2 size={isRightDrawer ? 14 : 16} />
                  </button>
                  <span
                    className={
                      isRightDrawer
                        ? 'w-px h-4 self-center bg-dh-strong/50 mx-0.5 shrink-0'
                        : 'w-px h-5 bg-dh-strong mx-1 shrink-0 mt-1'
                    }
                  />
                </>
              )}
              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1 shrink-0">
                  {showTierByName && (
                    <TierShieldBadge
                      tier={headerItem?.tier}
                      scaledFromTier={headerItem?._scaledFromTier}
                      className="shrink-0"
                    />
                  )}
                  {showLevelByName && <LevelBadge level={headerItem?.level} className="shrink-0" />}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  <h2
                    className={
                      isRightDrawer
                        ? 'text-sm font-bold dh-text-spellcast-header leading-tight truncate min-w-0'
                        : 'text-lg font-bold text-white truncate min-w-0'
                    }
                  >
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
            <div className={`flex justify-end shrink-0 ${isRightDrawer ? 'items-center gap-1.5' : 'items-center gap-2'}`}>
              <ItemActionButtons
                variant="header"
                isOwn={isOwn}
                canEdit={editable}
                itemName={displayItem?.name}
                addToTableMenu={addToTableMenu}
                onAddToTable={addToTableMenu ? undefined : onAddToTable}
                onClone={onClone ? handleClone : undefined}
                onEdit={onEdit}
                onDelete={onDelete}
                cloningStatus={cloningStatus}
              />
              {saveStatus}
              {v2LibrarySourcePath ? <V2SourceInspectButton relativePath={v2LibrarySourcePath} variant="header" /> : null}
              <button
                type="button"
                tabIndex={0}
                onClick={onClose}
                disabled={aiConceptBusy}
                title={aiConceptBusy ? 'Cancel AI build or wait to close' : undefined}
                className={
                  isRightDrawer
                    ? 'text-xs font-medium dh-text-spellcast-header px-2 py-1 rounded-md border border-dh-strong/40 hover:bg-dh-raised/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                    : 'text-sm font-medium text-dh hover:text-dh px-2.5 py-1.5 rounded-md border border-dh-strong hover:bg-dh-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                }
              >
                Done
              </button>
            </div>
              </>
            )}
          </div>
          )}

          {editingOfficialCatalog && (
            <div className="flex items-start gap-3 px-5 py-2 border-b border-teal-800/50 bg-teal-950/40 shrink-0">
              <p className="text-sm text-teal-100/95 leading-snug">
                Editing official {item._source === 'dt' ? 'DT' : 'SRD'} catalog — changes apply for every table.
              </p>
            </div>
          )}

          {showCharAutosaveHint && (
            <div className="flex items-start justify-between gap-3 px-5 py-2.5 border-b border-sky-900/40 bg-sky-950/35 shrink-0">
              <p className="text-sm text-sky-100/95 leading-snug">
                First time here? Your character is saved to your library as soon as you name them; after that, every change saves automatically. Close whenever you are finished.
              </p>
              <button
                type="button"
                tabIndex={0}
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
              isRightDrawer ? (
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                  {renderFormContent()}
                </div>
              ) : collection === 'scenes' ? (
                <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                  {renderFormContent()}
                </div>
              ) : (
                <>
                  {/* Preview pane — fixed 42% width */}
                  <div className="w-[42%] shrink-0 border-r border-dh-border overflow-hidden flex flex-col">
                    {renderDisplayContent()}
                  </div>
                  {/* Form pane */}
                  <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
                    {renderFormContent()}
                  </div>
                </>
              )
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {renderDisplayContent()}
              </div>
            )}
          </div>
    </>
  );

  const lightboxOverlay = lightboxUrl && (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={() => setLightboxUrl(null)}
    >
      <button
        type="button"
        tabIndex={0}
        className="absolute top-4 right-4 p-2 rounded-full bg-dh-raised/80 text-dh hover:text-dh hover:bg-dh-hover transition-colors"
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
  );

  if (isRightDrawer) {
    if (rightDrawerPortalTo) {
      return (
        <>
          {/* No fullscreen backdrop: the Game Table sheet is already the shell; a dim layer
              captured clicks and interfered with the pinned character overlay. Close via Done / Escape. */}
          {createPortal(
            <div
              className="h-full min-h-0 flex flex-col overflow-hidden bg-dh-surface"
              {...editorGestureProps}
            >
              {mainCardBody}
            </div>,
            rightDrawerPortalTo,
          )}
          {lightboxOverlay}
        </>
      );
    }
    if (rightDrawerPortalTo === null) {
      return <>{lightboxOverlay}</>;
    }
    const slideClass = drawerEntered ? 'translate-x-0' : 'translate-x-full';
    return (
      <>
        <div
          className="fixed inset-0 z-[80] bg-black/50"
          aria-hidden
          onClick={aiConceptBusy ? undefined : onClose}
        />
        <div
          className={`fixed z-[81] flex flex-col transition-transform duration-300 ease-out will-change-transform ${slideClass}`}
          style={{
            top: '4.5rem',
            right: 0,
            bottom: 0,
            width: 'min(42rem, calc(100vw - 12px))',
          }}
        >
          <div
            className="bg-dh-surface border border-dh-strong border-r-0 rounded-l-xl shadow-2xl h-full min-h-0 flex flex-col overflow-hidden"
            {...editorGestureProps}
          >
            {mainCardBody}
          </div>
        </div>
        {lightboxOverlay}
      </>
    );
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 pt-[4.5rem] overflow-hidden"
      onClick={handleOverlayClick}
    >
      <div className={`flex gap-3 items-stretch w-full min-h-0 ${libraryModalMaxHClass} ${maxWidth}`}>
        {/* Main modal card — height follows content up to viewport; body panes scroll when needed */}
        <div
          className={`bg-dh-surface border border-dh-strong rounded-xl shadow-2xl flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden ${libraryModalMaxHClass}`}
          {...editorGestureProps}
        >
          {mainCardBody}
        </div>

        {/* Feature Library portal — same max height as main card so long lists scroll inside, not grow the flex row */}
        {showFeatureLibrary && (
          <div
            ref={setLibraryPortal}
            className={`w-72 shrink-0 min-h-0 flex flex-col overflow-hidden rounded-xl ${libraryModalMaxHClass}`}
          />
        )}
      </div>

      {lightboxOverlay}
    </div>
  );
});

ItemDetailModal.displayName = 'ItemDetailModal';
