import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UnifiedImportModal } from '../components/modals/UnifiedImportModal.jsx';
import { MapImageQuickPickMenu } from '../components/modals/MapImageQuickPickMenu.jsx';
import { postImageUpload } from './api.js';
import { buildAddToItemTargets } from './add-to-item-targets.js';
import { resolveImagePasteActions } from './image-paste-actions.js';

const UnifiedImportContext = createContext(null);

function UnifiedImportGlobalListeners() {
  const { enabled, openImport, openMapImageQuickPick, canMapImagePaste } = useUnifiedImport();
  useEffect(() => {
    if (!enabled && !canMapImagePaste) return undefined;
    const onDragOver = (e) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();
    };
    const isTextLikeFile = (f) =>
      (f.type && f.type.startsWith('text/')) || /\.(txt|md|markdown)$/i.test(f.name || '');
    const onDrop = (e) => {
      if (e.target?.closest?.('[data-dh-unified-import]')) return;
      const all = Array.from(e.dataTransfer?.files || []);
      const imageFiles = all.filter((f) => f.type.startsWith('image/'));
      const textFiles = all.filter((f) => isTextLikeFile(f));
      if (!imageFiles.length && !textFiles.length) return;
      e.preventDefault();
      if (imageFiles.length && canMapImagePaste) {
        openMapImageQuickPick(imageFiles[0]);
        return;
      }
      if (enabled) openImport(all.filter((f) => f.type.startsWith('image/') || isTextLikeFile(f)));
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, [enabled, canMapImagePaste, openImport, openMapImageQuickPick]);

  useEffect(() => {
    if (!enabled && !canMapImagePaste) return undefined;
    const onPaste = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find((i) => i.type.startsWith('image/'));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) {
          e.preventDefault();
          if (canMapImagePaste) {
            openMapImageQuickPick(file);
          } else if (enabled) {
            openImport([file]);
          }
          return;
        }
      }
      if (!enabled) return;
      const pasted = e.clipboardData?.getData('text/plain')?.trim();
      if (pasted) {
        e.preventDefault();
        openImport(null, { text: pasted });
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled, canMapImagePaste, openImport, openMapImageQuickPick]);

  return null;
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} props.enabled — GM with session; when false, provider is inert for full import
 * @param {(col: string, item: object) => Promise<object|void>} props.saveItem
 * @param {(item: object, col: string, tableId?: string) => void|Promise} props.addToTable
 * @param {(img: { mapImageUrl: string, mapImageNaturalWidth: number, mapImageNaturalHeight: number, extraCameraVisibleNorms?: { x: number, y: number, w: number, h: number }[] }) => void|Promise<void>} [props.onAddMapWithImage]
 * @param {(file: File) => Promise<void>} [props.onReplaceMapWithImage] — replaces the current map's image
 * @param {(file: File, opts?: object) => Promise<void>} [props.onAddMapImageObject] — places a resizable image element on the map
 * @param {boolean} [props.effectiveIsPlayer] — true when the user is a player (not GM)
 * @param {(path: string, opts?: object) => void} props.navigate
 * @param {string|null} props.tableId — active table id for ops
 * @param {boolean} props.isGameTableGm — true when GM viewing /table/:id
 * @param {{ adversaries?: object[], environments?: object[] }} [props.importLibraryData]
 * @param {() => void} [props.onImportComplete]
 * @param {object} [props.libraryBrowseData]
 * @param {number} [props.partySize]
 * @param {number} [props.partyTier]
 * @param {number} [props.mapViewportAspect]
 */
export function UnifiedImportProvider({
  children,
  enabled,
  saveItem,
  addToTable,
  onAddMapWithImage,
  onReplaceMapWithImage,
  onAddMapImageObject,
  effectiveIsPlayer = false,
  navigate,
  tableId,
  isGameTableGm,
  importLibraryData,
  onImportComplete,
  libraryBrowseData,
  partySize,
  partyTier,
  mapViewportAspect,
}) {
  const [open, setOpen] = useState(false);
  const [seedFiles, setSeedFiles] = useState(null);
  /** Plain text pasted from outside the modal (becomes a text asset on open). */
  const [seedText, setSeedText] = useState(null);
  /** Incremented each open so the modal remounts with fresh state. */
  const [importSession, setImportSession] = useState(0);
  const [appendPayload, setAppendPayload] = useState(/** @type {{ files?: File[], text?: string } | null} */ (null));

  /** Quick-pick menu state (image paste/drop on game table). */
  const [quickPickOpen, setQuickPickOpen] = useState(false);
  const [quickPickFile, setQuickPickFile] = useState(/** @type {File | null} */ (null));
  /**
   * Resolved action list for the currently-open quick-pick menu (only set when 2+ actions,
   * i.e. the menu is actually opened rather than auto-applied).
   */
  const [quickPickActions, setQuickPickActions] = useState(/** @type {{ key: string, label?: string, run: (file?: File) => Promise<void> }[]} */ ([]));

  /**
   * Currently open editable character/adversary modal, if any.
   * Stored in a ref so name updates don't cause context re-renders; a boolean state
   * tracks presence for reactive `canMapImagePaste` computation.
   * Shape: { name: string, onAddImageUrl: (url: string) => void, extraTargets?: { key: string, label: string, onAddImageUrl: (url: string) => void }[] }
   * `extraTargets` lets the open item expose additional "Add to X" destinations beyond its own
   * primary image (e.g. a character's Beastbound companion) without this provider knowing
   * anything about what "companion" means — it just forwards whatever targets are registered.
   */
  const editableItemRef = useRef(
    /** @type {{ name: string, onAddImageUrl: (url: string) => void, extraTargets?: { key: string, label: string, onAddImageUrl: (url: string) => void }[] } | null} */ (null),
  );
  const [hasEditableItem, setHasEditableItem] = useState(false);

  const registerEditableItem = useCallback((info) => {
    editableItemRef.current = info;
    setHasEditableItem(true);
  }, []);

  const unregisterEditableItem = useCallback(() => {
    editableItemRef.current = null;
    setHasEditableItem(false);
  }, []);

  /**
   * Registered dismiss callback for an open "Add Map" picker dialog (ItemPickerModal with
   * collection="maps"). When set, paste/drop triggers "New Map" only and auto-dismisses
   * the picker when the map is created.
   */
  const addMapDialogDismissRef = useRef(/** @type {(() => void) | null} */ (null));

  const registerAddMapDialog = useCallback((dismiss) => {
    addMapDialogDismissRef.current = dismiss;
  }, []);

  const unregisterAddMapDialog = useCallback(() => {
    addMapDialogDismissRef.current = null;
  }, []);

  /**
   * Registered callback for an open library Map Editor (editable ItemDetailModal with
   * collection="maps"). When set, paste/drop triggers "Replace Map" scoped to that editor
   * rather than the live-table replace. Callback receives a Storage URL string.
   */
  const mapEditorReplaceRef = useRef(/** @type {((url: string) => void) | null} */ (null));
  const [hasMapEditorReplace, setHasMapEditorReplace] = useState(false);

  const registerMapEditorReplace = useCallback((onReplace) => {
    mapEditorReplaceRef.current = onReplace;
    setHasMapEditorReplace(true);
  }, []);

  const unregisterMapEditorReplace = useCallback(() => {
    mapEditorReplaceRef.current = null;
    setHasMapEditorReplace(false);
  }, []);

  /**
   * True when image paste/drop should trigger the quick-pick menu instead of the full import modal.
   * GM on the game table: shows MapImageQuickPickMenu with all map options.
   * Player on the game table with onAddMapImageObject: shows menu with "New Image on Map".
   * Any user with an editable character/adversary modal open: shows "Add image to [Name]".
   * Any user with a library Map Editor open: shows "Replace Map" in that editor.
   */
  const canMapImagePaste = (isGameTableGm || (effectiveIsPlayer && !!onAddMapImageObject) || hasEditableItem || hasMapEditorReplace);

  const openImport = useCallback(
    (files, opts) => {
      if (!enabled) return;
      const t = opts?.text;
      const text = typeof t === 'string' && t.trim() ? t.trim() : null;
      const fileList = files && files.length ? Array.from(files) : null;
      if (open) {
        if (!fileList?.length && !text) return;
        setAppendPayload({ files: fileList || undefined, text: text || undefined });
        return;
      }
      setSeedFiles(fileList);
      setSeedText(text);
      setImportSession((s) => s + 1);
      setOpen(true);
    },
    [enabled, open],
  );

  const closeImport = useCallback(() => {
    setOpen(false);
    setSeedFiles(null);
    setSeedText(null);
    setAppendPayload(null);
  }, []);

  const closeQuickPick = useCallback(() => {
    setQuickPickOpen(false);
    setQuickPickFile(null);
    setQuickPickActions([]);
  }, []);

  /** Called when user picks "Import Tools" from the quick-pick menu. */
  const handleQuickPickImportTools = useCallback((file) => {
    if (enabled) openImport(file ? [file] : null);
  }, [enabled, openImport]);

  /** Reads a File as a data URL. Used for multiple quick-pick paths. */
  const fileToDataUrl = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }), []);

  /**
   * Uploads a file to Storage (falling back to a data URL when upload fails, e.g. local dev
   * without Supabase) and hands the resulting URL to a registered target's callback.
   */
  const uploadAndApply = useCallback(async (onAddImageUrl, file) => {
    try {
      const { url } = await postImageUpload(file);
      onAddImageUrl(url);
    } catch {
      const url = await fileToDataUrl(file);
      onAddImageUrl(url);
    }
  }, [fileToDataUrl]);

  /** Hidden file input used when a single action is resolved but no file was supplied (toolbar). */
  const singleActionCallbackRef = useRef(/** @type {((file: File) => Promise<void>) | null} */ (null));
  const singleActionFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  /**
   * Open the quick-pick menu or auto-apply a single resolved action.
   * `file` is the pre-supplied image (paste/drop) or null (toolbar).
   * `opts` carries optional placement hints from the caller (e.g. current viewport center in feet).
   */
  const openMapImageQuickPick = useCallback((file, opts = {}) => {
    // ── Build resolved callback set for this invocation ───────────────────────
    const itemTargets = hasEditableItem
      ? buildAddToItemTargets(editableItemRef.current).map((t) => ({
          key: t.key,
          label: t.label,
          onAdd: (f) => uploadAndApply(t.onAddImageUrl, f),
        }))
      : [];

    const hasCurrentMap = isGameTableGm && !!onReplaceMapWithImage;

    const resolvedNewMap = onAddMapWithImage ? async (f) => {
      const dataUrl = await fileToDataUrl(f);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      await onAddMapWithImage({ mapImageUrl: dataUrl, mapImageNaturalWidth: img.naturalWidth, mapImageNaturalHeight: img.naturalHeight });
    } : null;

    const resolvedMapEditorReplace = mapEditorReplaceRef.current
      ? (f) => uploadAndApply(mapEditorReplaceRef.current, f)
      : null;

    const actions = resolveImagePasteActions({
      addToItemTargets: itemTargets,
      addMapDialogDismiss: addMapDialogDismissRef.current,
      onNewMap: resolvedNewMap,
      onMapEditorReplace: resolvedMapEditorReplace,
      onReplaceMap: hasCurrentMap ? onReplaceMapWithImage : null,
      onNewImageObject: onAddMapImageObject ? (f) => onAddMapImageObject(f, opts) : null,
      onImportTools: enabled ? (f) => handleQuickPickImportTools(f) : null,
    });

    if (actions.length === 0) return;

    if (actions.length === 1) {
      if (file) {
        // Paste/drop path — run immediately.
        actions[0].run(file).catch((err) => {
          console.error('[image paste]', err);
          alert(`Failed to add image: ${err?.message || err}. It may be too large (10 MB limit) — try a smaller image.`);
        });
      } else {
        // Toolbar path — show a file picker then run.
        singleActionCallbackRef.current = actions[0].run;
        singleActionFileInputRef.current?.click();
      }
      return;
    }

    // 2+ actions — open the picker menu with the filtered action set.
    setQuickPickFile(file || null);
    setQuickPickActions(actions);
    setQuickPickOpen(true);
  }, [
    hasEditableItem,
    isGameTableGm,
    onAddMapWithImage,
    onReplaceMapWithImage,
    onAddMapImageObject,
    enabled,
    uploadAndApply,
    fileToDataUrl,
    handleQuickPickImportTools,
  ]);

  const value = useMemo(
    () => ({
      enabled,
      openImport,
      closeImport,
      importOpen: open,
      saveItem,
      addToTable,
      onAddMapWithImage,
      navigate,
      tableId,
      isGameTableGm,
      importLibraryData: importLibraryData || { adversaries: [], environments: [] },
      onImportComplete: onImportComplete || (() => {}),
      openMapImageQuickPick,
      canMapImagePaste,
      registerEditableItem,
      unregisterEditableItem,
      registerAddMapDialog,
      unregisterAddMapDialog,
      registerMapEditorReplace,
      unregisterMapEditorReplace,
    }),
    [
      enabled, openImport, closeImport, open, saveItem, addToTable, onAddMapWithImage,
      navigate, tableId, isGameTableGm, importLibraryData, onImportComplete,
      openMapImageQuickPick, canMapImagePaste,
      registerEditableItem, unregisterEditableItem,
      registerAddMapDialog, unregisterAddMapDialog,
      registerMapEditorReplace, unregisterMapEditorReplace,
    ],
  );

  // Derive named menu props from the resolved action list so MapImageQuickPickMenu
  // keeps its existing prop contract unchanged.
  const menuNewMap = quickPickActions.find((a) => a.key === 'new-map');
  const menuReplaceMap = quickPickActions.find((a) => a.key === 'replace-map');
  const menuNewImageObject = quickPickActions.find((a) => a.key === 'new-image-object');
  const menuImportTools = quickPickActions.find((a) => a.key === 'import-tools');
  const menuItemTargets = quickPickActions
    .filter((a) => a.key.startsWith('add-to-item-'))
    .map((a) => ({
      key: a.key.replace('add-to-item-', ''),
      label: a.label,
      onAdd: a.run,
    }));

  return (
    <UnifiedImportContext.Provider value={value}>
      {(enabled || canMapImagePaste) ? <UnifiedImportGlobalListeners /> : null}
      {children}
      {enabled && open && (
        <UnifiedImportModal
          key={importSession}
          seedFiles={seedFiles}
          seedText={seedText}
          appendPayload={appendPayload}
          onAppendConsumed={() => setAppendPayload(null)}
          onClose={closeImport}
          libraryBrowseData={libraryBrowseData || {}}
          partySize={partySize ?? 4}
          partyTier={partyTier ?? 1}
          mapViewportAspect={mapViewportAspect ?? 16 / 9}
        />
      )}
      {quickPickOpen && (
        <MapImageQuickPickMenu
          open={quickPickOpen}
          onClose={closeQuickPick}
          seedFile={quickPickFile}
          onNewMap={menuNewMap ? (f) => menuNewMap.run(f) : null}
          onReplaceMap={menuReplaceMap ? (f) => menuReplaceMap.run(f) : null}
          onNewImageObject={menuNewImageObject ? (f) => menuNewImageObject.run(f) : null}
          onImportTools={menuImportTools ? (f) => menuImportTools.run(f) : null}
          addToItemTargets={menuItemTargets}
        />
      )}
      {/* Hidden file-input for single-action toolbar-mode (no pre-supplied file). */}
      <input
        ref={singleActionFileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f || !singleActionCallbackRef.current) return;
          const cb = singleActionCallbackRef.current;
          singleActionCallbackRef.current = null;
          try {
            await cb(f);
          } catch (err) {
            console.error('[image paste single-action]', err);
            alert(`Failed to add image: ${err?.message || err}. It may be too large (10 MB limit) — try a smaller image.`);
          }
        }}
      />
    </UnifiedImportContext.Provider>
  );
}

export function useUnifiedImport() {
  const ctx = useContext(UnifiedImportContext);
  if (!ctx) {
    return {
      enabled: false,
      openImport: () => {},
      closeImport: () => {},
      importOpen: false,
      onImportComplete: () => {},
      importLibraryData: { adversaries: [], environments: [] },
      openMapImageQuickPick: () => {},
      canMapImagePaste: false,
      registerEditableItem: () => {},
      unregisterEditableItem: () => {},
      registerAddMapDialog: () => {},
      unregisterAddMapDialog: () => {},
      registerMapEditorReplace: () => {},
      unregisterMapEditorReplace: () => {},
    };
  }
  return ctx;
}
