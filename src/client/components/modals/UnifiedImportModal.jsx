import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Upload, FileText, X } from 'lucide-react';
import { postImageUpload } from '../../lib/api.js';
import { dataUrlToFile } from '../../lib/map-image-data-url.js';
import { FullPageOverlay, FullPageOverlayHeader } from '../FullPageOverlay.jsx';
import { loadPageLayoutFromFile } from '../../lib/page-layout-load.js';
import {
  buildSliceDescriptors,
  createImageAssetFromLayout,
  createTextAsset,
  reconcileSliceRows,
} from '../../lib/unified-import-reconcile.js';
import { buildDraftForImportSlice, ocrLayoutRegion, resolveAttachPrimary } from '../../lib/unified-import-resolve.js';
import { ImageRegionsEditor } from './ImageRegionsEditor.jsx';
import { UnifiedImportReviewPane } from './UnifiedImportReviewPane.jsx';
import { UnifiedImportSliceThumb, UnifiedImportSliceThumbMaxFill } from '../../lib/unified-import-thumb.jsx';
import { useUnifiedImport } from '../../lib/unified-import-context.jsx';
import {
  ImportSliceDestinationControls,
  LIBRARY_PICK_COLLECTIONS,
  destinationLabelForKey,
} from './ImportSliceDestinationControls.jsx';
import {
  resolveUnifiedImportDestination,
  shouldAddImportedRowToTable,
  shouldSaveItemForUnifiedImport,
} from '../../lib/unified-import-destination.js';

const ASSET_TILE_PX = 88;

function summarizeImportRows(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (r.imageTarget === 'attach') continue;
    if (!r.draft || r.parseError) continue;
    const col = r.draftCollection;
    if (!col) continue;
    counts.set(col, (counts.get(col) || 0) + 1);
  }
  if (counts.size === 0) return 'Nothing to import yet.';
  const parts = [];
  for (const [col, n] of counts) {
    const label = destinationLabelForKey(col);
    const word = n === 1 ? label : `${label}s`;
    parts.push(`${n} ${word}`);
  }
  return `Will import: ${parts.join(', ')}.`;
}

function truncateText(s, max = 96) {
  const t = (s || '').trim();
  if (!t) return 'Empty text';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** Editable text that feeds the import parser (text assets and image OCR / “use as text”). */
function SliceParseTextEditor({ row, updateTextAsset, onImageRegionOcrChange }) {
  if (!row) {
    return <p className="text-xs text-dh-muted px-1">Select a slice to edit parse text.</p>;
  }
  if (row.source === 'text') {
    return (
      <label className="flex min-h-0 flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-dh-muted">Parse text</span>
        <textarea
          value={row.textBody ?? ''}
          onChange={(e) => updateTextAsset(row.assetId, e.target.value)}
          spellCheck={false}
          className="min-h-[160px] flex-1 w-full resize-y rounded border border-dh-border bg-dh-inset px-2 py-1.5 font-mono text-[11px] leading-snug text-dh"
          placeholder="Text sent to the adversary / environment / note parser…"
        />
      </label>
    );
  }
  if (row.source === 'image' && row.layout && row.rect) {
    const pending = row.ocrPending;
    return (
      <label className="flex min-h-0 flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-dh-muted">
          Parse text {pending ? '(detecting…)' : '(OCR — edit before import)'}
        </span>
        <textarea
          value={row.ocrText ?? ''}
          onChange={(e) => onImageRegionOcrChange(row.assetId, row.regionId, e.target.value)}
          readOnly={pending}
          disabled={pending}
          spellCheck={false}
          className="min-h-[160px] flex-1 w-full resize-y rounded border border-dh-border bg-dh-inset px-2 py-1.5 font-mono text-[11px] leading-snug text-dh disabled:opacity-60"
          placeholder={pending ? '…' : 'OCR text — fix typos or paste missing lines for a better parse.'}
        />
      </label>
    );
  }
  return null;
}

/** Image-only reference crops for the slice preview column (title lives in the parent). */
function SliceGroupReferencePreview({ primaryRow, sliceRows }) {
  if (!primaryRow) return null;
  const attachImageRows = sliceRows.filter(
    (r) => r.source === 'image' && r.imageTarget === 'attach' && r.attachToSliceId === primaryRow.id,
  );
  const imageRows = [];
  if (primaryRow.source === 'image' && primaryRow.layout && primaryRow.rect) {
    imageRows.push(primaryRow);
  }
  for (const r of attachImageRows) {
    imageRows.push(r);
  }
  if (!imageRows.length) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {imageRows.map((r) => (
        <div key={r.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <UnifiedImportSliceThumbMaxFill layout={r.layout} rect={r.rect} className="rounded-lg border border-dh-border" />
        </div>
      ))}
    </div>
  );
}

function isTextLikeFile(f) {
  return (f.type && f.type.startsWith('text/')) || /\.(txt|md|markdown)$/i.test(f.name || '');
}

export function UnifiedImportModal({
  onClose,
  seedFiles,
  seedText,
  appendPayload = null,
  onAppendConsumed,
  libraryBrowseData = {},
  partySize = 4,
  partyTier = 1,
  mapViewportAspect = 16 / 9,
}) {
  const {
    saveItem,
    addToTable,
    onAddMapWithImage,
    isGameTableGm,
    importLibraryData,
    onImportComplete,
  } = useUnifiedImport();

  const addTextAreaRef = useRef(null);
  const editTextAreaRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [imageAssets, setImageAssets] = useState(/** @type {any[]} */ ([]));
  const [textAssets, setTextAssets] = useState(/** @type {any[]} */ ([]));
  const [sliceRows, setSliceRows] = useState(/** @type {any[]} */ ([]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** When on Game Table (GM): where imported rows go. Hidden elsewhere — commit treats as `library`. */
  const [importDestination, setImportDestination] = useState(() => (isGameTableGm ? 'both' : 'library'));
  /** Applies to all items saved to the library from this import. */
  const [footerMakePublic, setFooterMakePublic] = useState(true);
  const [addTextModalOpen, setAddTextModalOpen] = useState(false);
  const [addTextDraft, setAddTextDraft] = useState('');
  const [regionsEditorAssetId, setRegionsEditorAssetId] = useState(/** @type {string | null} */ (null));
  const [textEditorAssetId, setTextEditorAssetId] = useState(/** @type {string | null} */ (null));
  const [selectedSliceId, setSelectedSliceId] = useState(/** @type {string | null} */ (null));
  const fileInputRef = useRef(null);
  const parseGen = useRef(0);

  useEffect(() => {
    if (isGameTableGm) setImportDestination('both');
  }, [isGameTableGm]);

  const shellClose = useCallback(() => {
    if (addTextModalOpen) {
      setAddTextModalOpen(false);
      setAddTextDraft('');
      return;
    }
    if (textEditorAssetId) {
      setTextEditorAssetId(null);
      return;
    }
    if (regionsEditorAssetId) {
      setRegionsEditorAssetId(null);
      return;
    }
    onClose();
  }, [addTextModalOpen, textEditorAssetId, regionsEditorAssetId, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (addTextModalOpen) {
        e.stopImmediatePropagation();
        setAddTextModalOpen(false);
        setAddTextDraft('');
        return;
      }
      if (textEditorAssetId) {
        e.stopImmediatePropagation();
        setTextEditorAssetId(null);
        return;
      }
      if (regionsEditorAssetId) {
        e.stopImmediatePropagation();
        setRegionsEditorAssetId(null);
        return;
      }
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [addTextModalOpen, textEditorAssetId, regionsEditorAssetId, onClose]);

  const defaultRow = useCallback(
    (d) => {
      return {
        structuralKey: d.structuralKey,
        source: d.source,
        assetId: d.assetId,
        regionId: d.regionId,
        layout: d.layout,
        rect: d.rect,
        textBody: d.textBody,
        preferTextForParse: true,
        imageTarget: 'library',
        libraryCollection: d.source === 'text' && isGameTableGm ? 'notes' : 'adversaries',
        attachToSliceId: null,
        ocrText: '',
        ocrHasText: false,
        /** Overwritten by descriptor for image rows (`ocrPending` from region OCR state). */
        ocrPending: d.source === 'image',
        parsePending: false,
        parseError: null,
        draft: null,
        draftCollection: null,
        /** User changed the slice target dropdown — do not auto-sync text `libraryCollection` from parse guess. */
        userPickedSliceTarget: false,
      };
    },
    [isGameTableGm],
  );

  const descriptors = useMemo(() => buildSliceDescriptors(imageAssets, textAssets), [imageAssets, textAssets]);

  useEffect(() => {
    setSliceRows((prev) => reconcileSliceRows(prev, descriptors, defaultRow));
  }, [descriptors, defaultRow]);

  useEffect(() => {
    setSelectedSliceId((prev) => {
      if (prev && sliceRows.some((r) => r.id === prev)) return prev;
      return sliceRows[0]?.id ?? null;
    });
  }, [sliceRows]);

  const regionsEditorAsset = useMemo(
    () => imageAssets.find((a) => a.id === regionsEditorAssetId) ?? null,
    [imageAssets, regionsEditorAssetId],
  );
  const textEditorAsset = useMemo(
    () => textAssets.find((t) => t.id === textEditorAssetId) ?? null,
    [textAssets, textEditorAssetId],
  );
  const selectedRow = useMemo(
    () => sliceRows.find((r) => r.id === selectedSliceId) ?? null,
    [sliceRows, selectedSliceId],
  );

  const reviewRow = useMemo(() => {
    if (!selectedRow) return null;
    return resolveAttachPrimary(selectedRow, sliceRows) ?? selectedRow;
  }, [selectedRow, sliceRows]);

  const editGroupPrimaryId = useMemo(() => {
    if (!selectedRow) return null;
    const p = resolveAttachPrimary(selectedRow, sliceRows);
    return p?.id ?? selectedRow.id;
  }, [selectedRow, sliceRows]);

  const isSliceInActiveGroup = useCallback(
    (row) => {
      if (!editGroupPrimaryId) return false;
      if (row.id === editGroupPrimaryId) return true;
      return row.imageTarget === 'attach' && row.attachToSliceId === editGroupPrimaryId;
    },
    [editGroupPrimaryId],
  );

  const ocrSig = useMemo(
    () =>
      sliceRows
        .filter((r) => r.source === 'image')
        .map((r) => `${r.id}|${r.structuralKey}`)
        .join(';'),
    [sliceRows],
  );

  /** OCR for regions not covered by the open ImageRegionsEditor (single source of truth: imageAssets.regions). */
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const run = async () => {
      const imageRows = sliceRows.filter(
        (r) =>
          r.source === 'image' &&
          r.layout &&
          r.rect &&
          r.ocrPending &&
          r.assetId !== regionsEditorAssetId,
      );
      await Promise.all(
        imageRows.map(async (row) => {
          try {
            const { ocrText, ocrHasText } = await ocrLayoutRegion(row.layout.dataUrl, row.rect, { signal: ac.signal });
            if (cancelled) return;
            setImageAssets((prev) =>
              prev.map((a) => {
                if (a.id !== row.assetId) return a;
                return {
                  ...a,
                  regions: a.regions.map((reg) =>
                    reg.id === row.regionId ? { ...reg, ocrText, ocrHasText, ocrComplete: true } : reg,
                  ),
                };
              }),
            );
          } catch {
            if (!cancelled) {
              setImageAssets((prev) =>
                prev.map((a) => {
                  if (a.id !== row.assetId) return a;
                  return {
                    ...a,
                    regions: a.regions.map((reg) =>
                      reg.id === row.regionId ? { ...reg, ocrText: '', ocrHasText: false, ocrComplete: true } : reg,
                    ),
                  };
                }),
              );
            }
          }
        }),
      );
    };
    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [ocrSig, regionsEditorAssetId]);

  const parseSig = useMemo(() => {
    return sliceRows
      .map((r) =>
        [
          r.id,
          r.structuralKey,
          r.preferTextForParse,
          r.imageTarget,
          r.libraryCollection,
          r.attachToSliceId,
          r.ocrText,
          r.ocrHasText,
          r.ocrPending,
          r.textBody,
          r.userPickedSliceTarget,
        ].join('|'),
      )
      .join('~');
  }, [sliceRows]);

  const sliceRowsRef = useRef(sliceRows);
  sliceRowsRef.current = sliceRows;

  useEffect(() => {
    const gen = ++parseGen.current;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const rows = sliceRowsRef.current;
          const pending = rows.filter((r) => r.source === 'image' && r.ocrPending);
          if (pending.length) return;
          const results = await Promise.all(rows.map((row) => buildDraftForImportSlice(row, rows)));
          if (gen !== parseGen.current) return;
          setSliceRows((prev) =>
            prev.map((r) => {
              const idx = rows.findIndex((x) => x.id === r.id);
              const res = idx >= 0 ? results[idx] : null;
              if (!res) return r;
              const draftSame = JSON.stringify(r.draft) === JSON.stringify(res.draft);
              const metaSame =
                r.draftCollection === res.draftCollection && r.parseError === res.parseError;
              if (draftSame && metaSame) return r;
              const guessColl =
                r.source === 'text' && !r.userPickedSliceTarget && res.draftCollection ? res.draftCollection : null;
              return {
                ...r,
                draft: res.draft,
                draftCollection: res.draftCollection,
                parseError: res.parseError,
                parsePending: false,
                ...(guessColl ? { libraryCollection: guessColl } : {}),
              };
            }),
          );
        } catch (e) {
          if (gen === parseGen.current) {
            setSliceRows((prev) => prev.map((r) => ({ ...r, parseError: e?.message || 'Parse error', parsePending: false })));
          }
        }
      })();
    }, 380);
    return () => clearTimeout(t);
  }, [parseSig]);

  useEffect(() => {
    if (!seedFiles?.length) return;
    let cancelled = false;
    void (async () => {
      const nextImages = [];
      const nextTexts = [];
      for (const f of seedFiles) {
        if (f.type.startsWith('image/')) {
          try {
            const layout = await loadPageLayoutFromFile(f);
            nextImages.push(createImageAssetFromLayout(f, layout));
          } catch (e) {
            console.warn('[unified-import] skip file', f.name, e);
          }
        } else if (isTextLikeFile(f)) {
          try {
            const body = await f.text();
            if (body.trim()) nextTexts.push(createTextAsset(body));
          } catch (e) {
            console.warn('[unified-import] skip text file', f.name, e);
          }
        }
      }
      if (!cancelled) {
        if (nextImages.length) setImageAssets((prev) => [...prev, ...nextImages]);
        if (nextTexts.length) setTextAssets((prev) => [...prev, ...nextTexts]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seedFiles]);

  useEffect(() => {
    if (!seedText?.trim()) return;
    setTextAssets((prev) => [...prev, createTextAsset(seedText.trim())]);
  }, [seedText]);

  const addFiles = useCallback(async (files) => {
    const list = Array.from(files || []);
    const imageFiles = list.filter((f) => f.type.startsWith('image/'));
    const textFiles = list.filter((f) => isTextLikeFile(f) && !f.type.startsWith('image/'));
    if (imageFiles.length === 0 && textFiles.length === 0) {
      if (list.length) setError('Use image files or text files (.txt, .md, plain text).');
      return;
    }
    setError('');
    const nextImages = [];
    for (const f of imageFiles) {
      try {
        const layout = await loadPageLayoutFromFile(f);
        nextImages.push(createImageAssetFromLayout(f, layout));
      } catch (e) {
        setError(e.message || 'Invalid image');
      }
    }
    const nextTexts = [];
    for (const f of textFiles) {
      try {
        const body = await f.text();
        if (body.trim()) nextTexts.push(createTextAsset(body));
      } catch (e) {
        setError(e.message || 'Could not read text file');
      }
    }
    if (nextImages.length) setImageAssets((prev) => [...prev, ...nextImages]);
    if (nextTexts.length) setTextAssets((prev) => [...prev, ...nextTexts]);
  }, []);

  useEffect(() => {
    if (!appendPayload) return;
    let cancelled = false;
    void (async () => {
      const { files, text } = appendPayload;
      if (files?.length) await addFiles(files);
      if (cancelled) return;
      if (text?.trim()) setTextAssets((prev) => [...prev, createTextAsset(text.trim())]);
      onAppendConsumed?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [appendPayload, onAppendConsumed, addFiles]);

  const removeImageAsset = (id) => {
    setImageAssets((prev) => prev.filter((a) => a.id !== id));
    if (regionsEditorAssetId === id) setRegionsEditorAssetId(null);
  };
  const saveAddTextModal = () => {
    const body = addTextDraft.trim();
    if (!body) return;
    setTextAssets((prev) => [...prev, createTextAsset(body)]);
    setAddTextDraft('');
    setAddTextModalOpen(false);
  };
  const updateTextAsset = (id, body) => setTextAssets((prev) => prev.map((t) => (t.id === id ? { ...t, body } : t)));
  const updateImageRegionOcrText = useCallback((assetId, regionId, ocrText) => {
    const has = ocrText.trim().length > 0;
    setImageAssets((prev) =>
      prev.map((a) => {
        if (a.id !== assetId) return a;
        return {
          ...a,
          regions: a.regions.map((reg) =>
            reg.id === regionId ? { ...reg, ocrText, ocrHasText: has, ocrComplete: true } : reg,
          ),
        };
      }),
    );
  }, []);
  const removeTextAsset = (id) => {
    setTextAssets((prev) => prev.filter((t) => t.id !== id));
    if (textEditorAssetId === id) setTextEditorAssetId(null);
  };

  const updateSlice = useCallback((id, patch) => {
    setSliceRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const handleDraftChange = useCallback((rowId, nextDraft) => {
    setSliceRows((prev) => {
      const hit = prev.find((r) => r.id === rowId);
      const primary = resolveAttachPrimary(hit, prev);
      const pid = primary?.id ?? rowId;
      const primaryColl = prev.find((r) => r.id === pid)?.draftCollection;
      return prev.map((r) => {
        if (r.id === pid) return { ...r, draft: nextDraft };
        if (r.imageTarget === 'attach' && r.attachToSliceId === pid) {
          return { ...r, draft: nextDraft, draftCollection: primaryColl ?? r.draftCollection };
        }
        return r;
      });
    });
  }, []);

  const importSummaryLine = useMemo(() => summarizeImportRows(sliceRows), [sliceRows]);

  const sliceAutoMapSig = useMemo(
    () =>
      sliceRows
        .filter((r) => r.source === 'image')
        .map(
          (r) =>
            `${r.id}|${r.ocrPending}|${r.ocrHasText}|${r.preferTextForParse}|${r.userPickedSliceTarget}|${r.imageTarget}`,
        )
        .join(';'),
    [sliceRows],
  );

  useEffect(() => {
    if (!isGameTableGm || !onAddMapWithImage) return;
    setSliceRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.source !== 'image' || r.ocrPending) return r;
        if (r.userPickedSliceTarget) return r;
        const shouldMap = !r.ocrHasText || r.preferTextForParse === false;
        if (!shouldMap) return r;
        if (r.imageTarget === 'map') return r;
        changed = true;
        return { ...r, imageTarget: 'map', attachToSliceId: null };
      });
      return changed ? next : prev;
    });
  }, [sliceAutoMapSig, isGameTableGm, onAddMapWithImage]);

  const removeSliceRow = useCallback((row) => {
    if (row.source === 'text') {
      removeTextAsset(row.assetId);
      return;
    }
    setImageAssets((prev) =>
      prev
        .map((a) => {
          if (a.id !== row.assetId) return a;
          return { ...a, regions: a.regions.filter((reg) => reg.id !== row.regionId) };
        })
        .filter((a) => a.regions.length > 0),
    );
  }, [removeTextAsset]);

  useEffect(() => {
    if (!addTextModalOpen) return;
    queueMicrotask(() => addTextAreaRef.current?.focus());
  }, [addTextModalOpen]);

  useEffect(() => {
    if (!textEditorAsset) return;
    queueMicrotask(() => editTextAreaRef.current?.focus());
  }, [textEditorAsset?.id]);

  const selectedReady = sliceRows.filter((r) => r.draft && !r.parseError && r.imageTarget !== 'attach');
  const canImport = selectedReady.length > 0 && !busy;

  const handleCommit = async () => {
    setBusy(true);
    setError('');
    const { dest, wantTable, wantLibrary } = resolveUnifiedImportDestination(isGameTableGm, importDestination);

    try {
      const withPublic = (item) => {
        if (!item || typeof item !== 'object') return item;
        return { ...item, is_public: footerMakePublic };
      };

      for (const row of selectedReady) {
        const d = row.draft;
        const col = row.draftCollection;
        if (!d || !col) continue;

        if (col === 'map') {
          if (!onAddMapWithImage) throw new Error('Map import requires the Game Table.');
          const extra = Array.isArray(d.mapCameraExtraNorms) ? d.mapCameraExtraNorms : [];
          await onAddMapWithImage({
            mapImageUrl: d.mapImageUrl,
            mapImageNaturalWidth: d.mapImageNaturalWidth,
            mapImageNaturalHeight: d.mapImageNaturalHeight,
            ...(extra.length ? { extraCameraVisibleNorms: extra } : {}),
          });
          continue;
        }

        if (col === 'notes') {
          if (!isGameTableGm) throw new Error('Notes require the Game Table.');
          const { kind: _k, ...note } = d;
          if (wantTable) await addToTable(withPublic(note), 'notes');
          continue;
        }

        let toSave = withPublic({ ...d });
        delete toSave.kind;
        // Upload any inline data: imageUrl before saving/adding to the table.
        if (typeof toSave.imageUrl === 'string' && toSave.imageUrl.startsWith('data:')) {
          try {
            const file = await dataUrlToFile(toSave.imageUrl, 'import-image');
            const { url } = await postImageUpload(file);
            toSave = { ...toSave, imageUrl: url };
          } catch {
            // Fall back to the data URL (local dev without Supabase)
          }
        }
        if (shouldSaveItemForUnifiedImport(col, dest, wantLibrary)) await saveItem(col, toSave);
        if (shouldAddImportedRowToTable(isGameTableGm, col, wantTable)) {
          await addToTable(toSave, col);
        }
      }

      onImportComplete();
      onClose();
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  /** Shown when imports can land in the library (Library or Both), not Table-only. */
  const showFooterMakePublic =
    !isGameTableGm || importDestination === 'library' || importDestination === 'both';

  const destSegmentBtn = (value, label) => (
    <button
      key={value}
      type="button"
      tabIndex={0}
      onClick={() => setImportDestination(value)}
      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
        importDestination === value
          ? 'bg-amber-600 text-white shadow-sm'
          : 'text-dh-muted hover:text-dh hover:bg-dh-hover'
      }`}
    >
      {label}
    </button>
  );

  const footerBar = (
    <div className="flex flex-col gap-3 w-full min-w-0">
      <p className="text-xs text-dh-muted leading-snug">{importSummaryLine}</p>
      <div className="flex flex-wrap items-center gap-3 justify-between w-full min-w-0">
        <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1 justify-start">
          {isGameTableGm ? (
            <div
              className="inline-flex rounded-lg border border-dh-border bg-dh-inset p-0.5 gap-0.5"
              role="group"
              aria-label="Import destination"
            >
              {destSegmentBtn('library', 'Library')}
              {destSegmentBtn('table', 'Table')}
              {destSegmentBtn('both', 'Both')}
            </div>
          ) : null}
          {showFooterMakePublic ? (
            <label className="inline-flex items-center gap-2 text-sm text-dh shrink-0">
              <input
                type="checkbox"
                checked={footerMakePublic}
                onChange={(e) => setFooterMakePublic(e.target.checked)}
                className="rounded border-dh-border"
              />
              Make public
            </label>
          ) : null}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            tabIndex={0}
            onClick={shellClose}
            className="px-4 py-2 rounded-lg border border-dh-border text-dh-muted hover:bg-dh-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            tabIndex={0}
            disabled={!canImport}
            onClick={() => void handleCommit()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-40"
          >
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );

  const textSliceCollectionOptions = useMemo(
    () => LIBRARY_PICK_COLLECTIONS.filter((c) => c !== 'notes' || isGameTableGm),
    [isGameTableGm],
  );

  const importMain = (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/70 pt-[4.5rem] overflow-hidden"
      role="presentation"
      onClick={shellClose}
    >
      <div
        className="flex flex-1 min-h-0 flex-col mx-3 mb-3 w-[min(110rem,calc(100%-1.5rem))] self-center rounded-xl border border-dh-strong bg-dh-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-dh-border shrink-0 gap-3">
          <h2 className="text-xl font-bold text-dh">Import</h2>
          <button
            type="button"
            tabIndex={0}
            onClick={shellClose}
            className="rounded-lg p-2 text-dh-muted hover:text-dh hover:bg-dh-hover"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden" data-dh-unified-import="">
          <p className="text-sm text-dh-muted shrink-0 px-5 pt-4 pb-2">
            Upload assets, adjust regions on images if needed, then pick each slice’s target. Edits upstream re-run the import
            pipeline automatically.
          </p>

          <div className="flex flex-1 min-h-0 flex-col lg:flex-row border-b border-dh-border min-h-0">
            <div className="lg:w-1/2 flex flex-col min-h-0 overflow-y-auto px-5 pb-3 space-y-6 border-b lg:border-b-0 lg:border-r border-dh-border">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-dh-muted mb-2">1 · Upload and Slice Assets</h3>
            <div
              className="border border-dashed border-dh-border rounded-lg p-3 hover:border-dh-strong transition-colors"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void addFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="flex flex-col gap-2 lg:w-52 shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,text/plain,.txt,.md,.markdown"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-dh-raised border border-dh-border text-sm w-full"
                  >
                    <Upload size={14} /> Browse…
                  </button>
                  <p className="text-[11px] text-dh-muted leading-snug">
                    Paste or drop images or text files (.txt, .md) here or anywhere in the app.
                  </p>
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => {
                      setAddTextDraft('');
                      setAddTextModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-dh-raised border border-dh-border text-sm w-full"
                  >
                    <Plus size={14} /> Add text…
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  {imageAssets.length === 0 && textAssets.length === 0 ? (
                    <p className="text-sm text-dh-muted py-2">No assets yet — use Browse, paste/drop, or Add text.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {imageAssets.map((a) => (
                        <div key={a.id} className="relative flex flex-col items-center gap-1 w-[92px] shrink-0">
                          <button
                            type="button"
                            tabIndex={0}
                            onClick={() => setRegionsEditorAssetId(a.id)}
                            className={`relative rounded-lg border overflow-hidden bg-dh-canvas focus:outline-none focus:ring-2 focus:ring-sky-500/60 ${
                              regionsEditorAssetId === a.id ? 'ring-2 ring-sky-400' : 'border-dh-border hover:border-dh-strong'
                            }`}
                            style={{ width: ASSET_TILE_PX, height: ASSET_TILE_PX }}
                            title="Edit regions"
                          >
                            <img src={a.layout.dataUrl} alt="" className="h-full w-full object-cover" />
                          </button>
                          <button
                            type="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImageAsset(a.id);
                            }}
                            className="absolute -top-1 -right-1 rounded-full border border-dh-border bg-dh-raised p-1 text-red-400 hover:bg-dh-hover z-[1]"
                            aria-label="Remove image"
                          >
                            <Trash2 size={12} />
                          </button>
                          <span className="text-[10px] text-dh-muted text-center line-clamp-2 w-full leading-tight" title={a.file.name}>
                            {a.file.name}
                          </span>
                        </div>
                      ))}
                      {textAssets.map((t) => (
                        <div key={t.id} className="relative flex flex-col items-center gap-1 w-[92px] shrink-0">
                          <button
                            type="button"
                            tabIndex={0}
                            onClick={() => setTextEditorAssetId(t.id)}
                            className={`flex flex-col items-stretch justify-between rounded-lg border p-1.5 text-left bg-dh-raised/50 focus:outline-none focus:ring-2 focus:ring-sky-500/60 ${
                              textEditorAssetId === t.id ? 'ring-2 ring-sky-400' : 'border-dh-border hover:border-dh-strong'
                            }`}
                            style={{ width: ASSET_TILE_PX, height: ASSET_TILE_PX }}
                            title="Edit text"
                          >
                            <FileText size={16} className="shrink-0 text-dh-muted self-center" />
                            <span className="text-[9px] leading-snug text-dh line-clamp-5 break-words">{truncateText(t.body, 72)}</span>
                          </button>
                          <button
                            type="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTextAsset(t.id);
                            }}
                            className="absolute -top-1 -right-1 rounded-full border border-dh-border bg-dh-raised p-1 text-red-400 hover:bg-dh-hover z-[1]"
                            aria-label="Remove text asset"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-dh-muted mb-2">2 · Select Destination Types</h3>
            {sliceRows.length === 0 ? (
              <p className="text-sm text-dh-muted">Add a text asset or image to begin.</p>
            ) : (
              <div className="flex flex-wrap gap-3 items-end">
                {sliceRows.map((row) => {
                  const isGroup = isSliceInActiveGroup(row);
                  return (
                    <div key={row.id} className="flex flex-col items-stretch gap-1 w-[108px] shrink-0">
                      <div className="relative">
                        <button
                          type="button"
                          tabIndex={0}
                          onClick={() => setSelectedSliceId(row.id)}
                          className={`relative flex flex-col items-center gap-0 w-full rounded-lg p-0 border bg-dh-raised/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                            isGroup ? 'ring-2 ring-amber-500 border-amber-600/50' : 'border-dh-border hover:border-dh-strong'
                          }`}
                        >
                          {row.source === 'image' && row.layout && row.rect ? (
                            <div className="rounded-t-md overflow-hidden bg-dh-canvas border-b border-dh-border/50 mx-auto">
                              <UnifiedImportSliceThumb layout={row.layout} rect={row.rect} sizePx={ASSET_TILE_PX} />
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-center rounded-t-md border-b border-dh-border/50 bg-dh-inset/50 text-[9px] text-dh p-1"
                              style={{ width: ASSET_TILE_PX, height: ASSET_TILE_PX }}
                            >
                              <span className="line-clamp-6 text-left leading-snug">{truncateText(row.textBody, 96)}</span>
                            </div>
                          )}
                          <span className="text-[9px] font-mono text-dh-muted px-1 py-1 truncate max-w-full">{row.id}</span>
                        </button>
                        <button
                          type="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSliceRow(row);
                          }}
                          className="absolute -top-1 -right-1 rounded-full border border-dh-border bg-dh-raised p-1 text-red-400 hover:bg-dh-hover z-[1]"
                          aria-label="Remove slice"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <ImportSliceDestinationControls
                        row={row}
                        allSliceRows={sliceRows}
                        isGameTableGm={isGameTableGm}
                        onAddMapWithImage={onAddMapWithImage}
                        updateSlice={updateSlice}
                        textSliceCollectionOptions={textSliceCollectionOptions}
                        onTargetPicked={(id) => setSelectedSliceId(id)}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </div>

            <div className="lg:w-1/2 flex flex-col min-h-0 overflow-hidden min-h-[200px] lg:min-h-0 bg-dh-canvas/15 border-t lg:border-t-0 lg:border-l border-dh-border">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-dh-muted px-3 pt-3 pb-1 shrink-0">
                Slice preview
              </h3>
              <div className="flex flex-1 min-h-0 flex-col gap-2 px-2 pb-2 pt-0">
                <SliceParseTextEditor
                  row={reviewRow}
                  updateTextAsset={updateTextAsset}
                  onImageRegionOcrChange={updateImageRegionOcrText}
                />
                {reviewRow ? <SliceGroupReferencePreview primaryRow={reviewRow} sliceRows={sliceRows} /> : null}
              </div>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 flex-col overflow-hidden min-h-[220px]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-dh-muted px-5 pt-3 pb-2 shrink-0 border-b border-dh-border/60">
              3 · Review and Edit
            </h3>
            <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3 pt-2 flex flex-col">
              <UnifiedImportReviewPane
                selectedRow={reviewRow}
                footerMakePublic={footerMakePublic}
                importLibraryData={importLibraryData}
                libraryBrowseData={libraryBrowseData}
                partySize={partySize}
                partyTier={partyTier}
                mapViewportAspect={mapViewportAspect}
                onDraftChange={handleDraftChange}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-dh-border px-5 py-3 bg-dh-surface/95">{footerBar}</div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(importMain, document.body)}

      <FullPageOverlay
        open={addTextModalOpen}
        onClose={() => {
          setAddTextModalOpen(false);
          setAddTextDraft('');
        }}
        zIndexClass="z-[10052]"
        maxWidthClass="max-w-2xl"
        heightClass="h-[min(70vh,520px)]"
        ariaLabelledBy="unified-import-add-text-title"
      >
        <FullPageOverlayHeader
          titleId="unified-import-add-text-title"
          title="Add text"
          icon={FileText}
          onClose={() => {
            setAddTextModalOpen(false);
            setAddTextDraft('');
          }}
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <textarea
              ref={addTextAreaRef}
              value={addTextDraft}
              onChange={(e) => setAddTextDraft(e.target.value)}
              rows={16}
              placeholder="Paste or type text for a new text asset…"
              className="min-h-[220px] w-full rounded border border-dh-border bg-dh-inset px-2 py-1.5 text-sm text-dh"
            />
          </div>
          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-dh-strong px-4 py-3">
            <button
              type="button"
              tabIndex={0}
              onClick={() => {
                setAddTextModalOpen(false);
                setAddTextDraft('');
              }}
              className="px-4 py-2 rounded-lg border border-dh-border text-dh-muted hover:bg-dh-hover text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              tabIndex={0}
              disabled={!addTextDraft.trim()}
              onClick={saveAddTextModal}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </FullPageOverlay>

      <ImageRegionsEditor
        open={!!regionsEditorAsset}
        onClose={() => setRegionsEditorAssetId(null)}
        layout={regionsEditorAsset?.layout}
        regions={regionsEditorAsset?.regions ?? []}
        onRegionsChange={(next) => {
          if (!regionsEditorAssetId) return;
          setImageAssets((prev) => prev.map((a) => (a.id === regionsEditorAssetId ? { ...a, regions: next } : a)));
        }}
        fileName={regionsEditorAsset?.file?.name ?? ''}
        zIndexClass="z-[10051]"
        importAssetId={regionsEditorAssetId}
        allImportSliceRows={sliceRows}
        updateSlice={updateSlice}
        isGameTableGm={isGameTableGm}
        onAddMapWithImage={onAddMapWithImage}
        textSliceCollectionOptions={textSliceCollectionOptions}
      />

      <FullPageOverlay
        open={!!textEditorAsset}
        onClose={() => setTextEditorAssetId(null)}
        zIndexClass="z-[10050]"
        maxWidthClass="max-w-2xl"
        heightClass="h-[min(70vh,560px)]"
        ariaLabelledBy="unified-import-text-edit-title"
      >
        <FullPageOverlayHeader
          titleId="unified-import-text-edit-title"
          title="Edit text"
          icon={FileText}
          onClose={() => setTextEditorAssetId(null)}
        />
        {textEditorAsset && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <textarea
                ref={editTextAreaRef}
                value={textEditorAsset.body}
                onChange={(e) => updateTextAsset(textEditorAsset.id, e.target.value)}
                rows={18}
                placeholder="Paste stat block or notes…"
                className="min-h-[260px] w-full rounded border border-dh-border bg-dh-inset px-2 py-1.5 text-sm text-dh"
              />
            </div>
            <div className="shrink-0 flex items-center justify-between gap-2 border-t border-dh-strong px-4 py-3">
              <button
                type="button"
                tabIndex={0}
                onClick={() => {
                  removeTextAsset(textEditorAsset.id);
                  setTextEditorAssetId(null);
                }}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Delete asset
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setTextEditorAssetId(null)}
                  className="px-4 py-2 rounded-lg border border-dh-border text-dh-muted hover:bg-dh-hover text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setTextEditorAssetId(null)}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </FullPageOverlay>

    </>
  );
}
