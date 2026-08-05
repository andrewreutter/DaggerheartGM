import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UnifiedImportModal } from '../components/modals/UnifiedImportModal.jsx';
import { MapImageQuickPickMenu } from '../components/modals/MapImageQuickPickMenu.jsx';

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
  const [quickPickOpts, setQuickPickOpts] = useState(/** @type {{ mapId?: string, centerXFt?: number, centerYFt?: number }} */ ({}));

  /**
   * Currently open editable character/adversary modal, if any.
   * Stored in a ref so name updates don't cause context re-renders; a boolean state
   * tracks presence for reactive `canMapImagePaste` computation.
   * Shape: { name: string, onAddImageUrl: (url: string) => void }
   */
  const editableItemRef = useRef(/** @type {{ name: string, onAddImageUrl: (url: string) => void } | null} */ (null));
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
   * True when image paste/drop should trigger the quick-pick menu instead of the full import modal.
   * GM on the game table: shows MapImageQuickPickMenu with all map options.
   * Player on the game table with onAddMapImageObject: shows menu with "New Image on Map".
   * Any user with an editable character/adversary modal open: shows "Add image to [Name]".
   */
  const canMapImagePaste = (isGameTableGm || (effectiveIsPlayer && !!onAddMapImageObject) || hasEditableItem);

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

  /** Open the quick-pick menu; `file` is the pre-supplied image (paste/drop) or null (toolbar).
   *  `opts` carries optional placement hints from the caller (e.g. current viewport center in feet). */
  const openMapImageQuickPick = useCallback((file, opts = {}) => {
    setQuickPickFile(file || null);
    setQuickPickOpts(opts);
    setQuickPickOpen(true);
  }, []);

  const closeQuickPick = useCallback(() => {
    setQuickPickOpen(false);
    setQuickPickFile(null);
    setQuickPickOpts({});
  }, []);

  /** Called when user picks "Import Tools" from the quick-pick menu. */
  const handleQuickPickImportTools = useCallback((file) => {
    if (enabled) openImport(file ? [file] : null);
  }, [enabled, openImport]);

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
    }),
    [enabled, openImport, closeImport, open, saveItem, addToTable, onAddMapWithImage, navigate, tableId, isGameTableGm, importLibraryData, onImportComplete, openMapImageQuickPick, canMapImagePaste, registerEditableItem, unregisterEditableItem],
  );

  const hasCurrentMap = isGameTableGm && !!onReplaceMapWithImage;

  /** Reads a File as a data URL. Used for multiple quick-pick paths. */
  const fileToDataUrl = useCallback((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }), []);

  /**
   * When an editable item modal is open, handler that converts the file to a data URL and
   * sets it on that item's form data via the registered callback.
   */
  const onAddToItem = hasEditableItem ? async (file) => {
    const url = await fileToDataUrl(file);
    editableItemRef.current?.onAddImageUrl(url);
  } : null;

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
          onNewMap={onAddMapWithImage ? async (file) => {
            const dataUrl = await fileToDataUrl(file);
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = dataUrl;
            });
            await onAddMapWithImage({ mapImageUrl: dataUrl, mapImageNaturalWidth: img.naturalWidth, mapImageNaturalHeight: img.naturalHeight });
          } : null}
          onReplaceMap={hasCurrentMap ? onReplaceMapWithImage : null}
          onNewImageObject={onAddMapImageObject ? (file) => onAddMapImageObject(file, quickPickOpts) : null}
          onImportTools={enabled ? handleQuickPickImportTools : null}
          onAddToItem={onAddToItem}
          itemLabel={editableItemRef.current?.name}
        />
      )}
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
    };
  }
  return ctx;
}
