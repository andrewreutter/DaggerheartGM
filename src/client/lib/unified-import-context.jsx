import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UnifiedImportModal } from '../components/modals/UnifiedImportModal.jsx';

const UnifiedImportContext = createContext(null);

function UnifiedImportGlobalListeners() {
  const { enabled, openImport } = useUnifiedImport();
  useEffect(() => {
    if (!enabled) return undefined;
    const onDragOver = (e) => {
      if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();
    };
    const isTextLikeFile = (f) =>
      (f.type && f.type.startsWith('text/')) || /\.(txt|md|markdown)$/i.test(f.name || '');
    const onDrop = (e) => {
      if (e.target?.closest?.('[data-dh-unified-import]')) return;
      const all = Array.from(e.dataTransfer?.files || []);
      const files = all.filter((f) => f.type.startsWith('image/') || isTextLikeFile(f));
      if (!files.length) return;
      e.preventDefault();
      openImport(files);
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
    };
  }, [enabled, openImport]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onPaste = (e) => {
      if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find((i) => i.type.startsWith('image/'));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) {
          e.preventDefault();
          openImport([file]);
          return;
        }
      }
      const pasted = e.clipboardData?.getData('text/plain')?.trim();
      if (pasted) {
        e.preventDefault();
        openImport(null, { text: pasted });
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enabled, openImport]);

  return null;
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} props.enabled — GM with session; when false, provider is inert
 * @param {(col: string, item: object) => Promise<object|void>} props.saveItem
 * @param {(item: object, col: string, tableId?: string) => void|Promise} props.addToTable
 * @param {(img: { mapImageUrl: string, mapImageNaturalWidth: number, mapImageNaturalHeight: number, extraCameraVisibleNorms?: { x: number, y: number, w: number, h: number }[] }) => void|Promise<void>} [props.onAddMapWithImage] — may upload an inline `data:` `mapImageUrl` to Storage before posting the op; callers should `await`.
 * @param {(path: string, opts?: object) => void} props.navigate
 * @param {string|null} props.tableId — active table id for ops (primary uid when not on table route)
 * @param {boolean} props.isGameTableGm — true when GM viewing /table/:id
 * @param {{ adversaries?: object[], environments?: object[] }} [props.importLibraryData] — for duplicate detection on text import
 * @param {() => void} [props.onImportComplete] — after a successful import (e.g. refresh library)
 * @param {object} [props.libraryBrowseData] — library `data` blob for scene/adventure ref pickers in import review
 * @param {number} [props.partySize]
 * @param {number} [props.partyTier]
 * @param {number} [props.mapViewportAspect] — width/height of battle map viewport; used for map import camera rectangles (default 16/9)
 */
export function UnifiedImportProvider({
  children,
  enabled,
  saveItem,
  addToTable,
  onAddMapWithImage,
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
    }),
    [enabled, openImport, closeImport, open, saveItem, addToTable, onAddMapWithImage, navigate, tableId, isGameTableGm, importLibraryData, onImportComplete],
  );

  return (
    <UnifiedImportContext.Provider value={value}>
      {enabled ? <UnifiedImportGlobalListeners /> : null}
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
    };
  }
  return ctx;
}
