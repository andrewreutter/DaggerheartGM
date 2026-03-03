import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Image, FileText, Loader2, ArrowLeftRight } from 'lucide-react';
import { generateId } from '../../lib/helpers.js';
import { getAuthToken } from '../../lib/api.js';
import {
  ImportModalShell,
  ImportSuccessStep,
  ImportPreviewSection,
  ImportPreviewSummary,
  useImportSelection,
} from './ImportModalShell.jsx';
import { ImportPreviewCard } from './ImportPreviewCard.jsx';

/**
 * Modal for importing Daggerheart adversaries/environments from images or pasted text.
 *
 * Accepts images via drag-and-drop, file picker, or clipboard paste (Ctrl/Cmd+V).
 * Also accepts pasted stat block text. Sends files to POST /api/import/parse for
 * OCR + regex parsing with automatic adversary/environment detection.
 *
 * Three-step flow: upload → preview (with per-item collection override) → success.
 */
export function ImageImportModal({ onClose, saveItem, data, onImportSuccess }) {
  const [step, setStep] = useState('upload'); // upload | preview | success
  const [files, setFiles] = useState([]); // Array of { file: File, previewUrl: string }
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Parsed results: array of { id, collection, item, confidence, missing }
  const [parsedItems, setParsedItems] = useState([]);

  const [importedItems, setImportedItems] = useState([]);
  const [importing, setImporting] = useState(false);

  const { selectedIds, setSelectedIds, toggleId, replaceIds, toggleReplaceId } = useImportSelection();

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Image queuing helpers ---

  const addFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setFiles(prev => [
      ...prev,
      ...imageFiles.map(file => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
    setParseError('');
  }, []);

  const removeFile = (idx) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // --- Drag-and-drop ---

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget)) setIsDragging(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  // --- Clipboard paste ---
  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(it => it.kind === 'file' && it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      e.preventDefault();
      const pastedFiles = imageItems.map(it => it.getAsFile()).filter(Boolean);
      addFiles(pastedFiles);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addFiles]);

  // --- Parse ---

  const handleParse = async () => {
    if (files.length === 0 && !pastedText.trim()) {
      setParseError('Add at least one image or paste some stat block text.');
      return;
    }
    setParsing(true);
    setParseError('');
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      files.forEach(({ file }) => formData.append('images', file));
      if (pastedText.trim()) formData.append('text', pastedText.trim());

      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const { results } = await res.json();
      if (!results || results.length === 0) {
        setParseError('No stat blocks could be detected. Try higher-resolution images or paste the text directly.');
        return;
      }

      // Assign stable IDs for selection tracking
      const withIds = results.map(r => ({
        ...r,
        item: { ...r.item, id: r.item.id || generateId() },
      }));
      setParsedItems(withIds);
      // Select all by default
      setSelectedIds(new Set(withIds.map(r => r.item.id)));
      setStep('preview');
    } catch (err) {
      setParseError(err.message || 'Failed to parse. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  // --- Collection override ---

  const toggleItemCollection = (itemId) => {
    setParsedItems(prev => prev.map(r => {
      if (r.item.id !== itemId) return r;
      const next = r.collection === 'adversaries' ? 'environments' : 'adversaries';
      return { ...r, collection: next };
    }));
  };

  // --- Update item data from inline form edits ---

  const updateItem = (updatedItem) => {
    setParsedItems(prev => prev.map(r =>
      r.item.id === updatedItem.id ? { ...r, item: updatedItem } : r
    ));
  };

  // --- Import ---

  const handleImport = async () => {
    setImporting(true);
    const saved = [];

    for (const { collection, item } of parsedItems) {
      if (!selectedIds.has(item.id)) continue;

      const existingItems = data[collection] || [];
      const duplicate = existingItems.find(
        e => e.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
      const replace = replaceIds.has(item.id);
      const id = replace && duplicate ? duplicate.id : (item.id || generateId());

      const { count: _count, id: _id, ...itemData } = item;

      try {
        const savedItem = await saveItem(collection, { ...itemData, id });
        saved.push({ ...savedItem, collection, replaced: !!(replace && duplicate) });
      } catch (err) {
        console.error(`[import] Failed to save ${collection} "${item.name}":`, err);
      }
    }

    setImportedItems(saved);
    setImporting(false);

    // Auto-navigate to the first imported item's detail view
    if (saved.length > 0) {
      onImportSuccess(saved[0].collection, saved[0].id);
      return;
    }
    setStep('success');
  };

  // --- Computed values ---

  const adversaries = parsedItems.filter(r => r.collection === 'adversaries').map(r => r.item);
  const environments = parsedItems.filter(r => r.collection === 'environments').map(r => r.item);
  const selectedCount = parsedItems.filter(r => selectedIds.has(r.item.id)).length;

  const summaryText = selectedCount > 0
    ? parsedItems
        .filter(r => selectedIds.has(r.item.id))
        .reduce((acc, r) => { acc[r.collection] = (acc[r.collection] || 0) + 1; return acc; }, {})
    : null;

  const summaryStr = summaryText
    ? Object.entries(summaryText).map(([col, n]) => `${n} ${col}`).join(' · ')
    : null;

  // --- Render: upload step ---

  if (step === 'upload') {
    const footer = (
      <>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleParse}
          disabled={parsing || (files.length === 0 && !pastedText.trim())}
          className="px-5 py-2 text-sm font-medium rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {parsing ? <><Loader2 size={14} className="animate-spin" /> Parsing…</> : 'Parse Images'}
        </button>
      </>
    );

    return (
      <ImportModalShell title="Import Stat Blocks" onClose={onClose} footer={footer}>
        <div className="space-y-5">
          {/* Drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors select-none ${
              isDragging
                ? 'border-red-500 bg-red-950/20'
                : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
            }`}
          >
            <Upload size={32} className={isDragging ? 'text-red-400' : 'text-slate-500'} />
            <div className="text-center">
              <p className="text-slate-300 font-medium text-sm">
                Drop images here, click to browse, or paste with Ctrl/Cmd+V
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Supports PNG, JPG, WebP · Multiple images supported
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          {/* Thumbnails */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map(({ previewUrl }, idx) => (
                <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                  <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="w-16 h-16 rounded-lg border border-dashed border-slate-700 hover:border-slate-500 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors"
                title="Add more images"
              >
                <Image size={18} />
              </button>
            </div>
          )}

          {/* Text paste area */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              <FileText size={12} /> Paste stat block text (optional)
            </label>
            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              rows={6}
              placeholder="Paste one or more stat block texts here (separate multiple blocks with blank lines)…"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-slate-500 resize-none placeholder:text-slate-600"
            />
          </div>

          {parseError && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
              {parseError}
            </p>
          )}
        </div>
      </ImportModalShell>
    );
  }

  // --- Render: preview step ---

  if (step === 'preview') {
    const makeCardRenderer = (collection) => (item) => {
      const parsed = parsedItems.find(r => r.item.id === item.id);
      return (
        <CollectionToggleCard
          key={item.id}
          item={item}
          collection={collection}
          existingItems={data?.[collection] || []}
          selected={selectedIds.has(item.id)}
          onToggleSelect={() => toggleId(item.id)}
          onUpdate={updateItem}
          colorScheme="red"
          replaceMode={replaceIds.has(item.id)}
          onToggleReplace={() => toggleReplaceId(item.id)}
          confidence={parsed?.confidence}
          onToggleCollection={() => toggleItemCollection(item.id)}
        />
      );
    };

    const footer = (
      <>
        <button
          onClick={() => setStep('upload')}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleImport}
          disabled={importing || selectedCount === 0}
          className="px-5 py-2 text-sm font-medium rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {importing
            ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
            : `Import ${selectedCount > 0 ? selectedCount : ''} Selected`}
        </button>
      </>
    );

    return (
      <ImportModalShell title="Preview Import" onClose={onClose} footer={footer}>
        <div className="space-y-5">
          <p className="text-sm text-slate-400">
            Review detected items below. Expand a card to edit fields before importing.
            Use the <ArrowLeftRight size={12} className="inline" /> button to override the auto-detected type if needed.
          </p>

          <ImportPreviewSection
            label="Adversaries"
            items={adversaries}
            collection="adversaries"
            existingItems={data?.adversaries || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updateItem}
            colorScheme="red"
            replaceIds={replaceIds}
            onToggleReplaceId={toggleReplaceId}
            renderCard={makeCardRenderer('adversaries')}
          />

          <ImportPreviewSection
            label="Environments"
            items={environments}
            collection="environments"
            existingItems={data?.environments || []}
            selectedIds={selectedIds}
            onToggleId={toggleId}
            onUpdateItem={updateItem}
            colorScheme="red"
            replaceIds={replaceIds}
            onToggleReplaceId={toggleReplaceId}
            renderCard={makeCardRenderer('environments')}
          />

          <ImportPreviewSummary summaryParts={summaryStr} />
        </div>
      </ImportModalShell>
    );
  }

  // --- Render: success step ---

  return (
    <ImportModalShell
      title="Import Complete"
      onClose={onClose}
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Close
        </button>
      }
    >
      <ImportSuccessStep
        importedItems={importedItems}
        onImportSuccess={onImportSuccess}
        onClose={onClose}
        colorScheme="red"
      />
    </ImportModalShell>
  );
}

// ---------------------------------------------------------------------------
// CollectionToggleCard — ImportPreviewCard wrapper with confidence badge
// and a button to switch between adversary ↔ environment
// ---------------------------------------------------------------------------

function CollectionToggleCard({
  item,
  collection,
  existingItems,
  selected,
  onToggleSelect,
  onUpdate,
  colorScheme,
  replaceMode,
  onToggleReplace,
  confidence,
  onToggleCollection,
}) {
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
  const confColor =
    confidencePct == null ? '' :
    confidencePct >= 70 ? 'text-green-400' :
    confidencePct >= 40 ? 'text-yellow-400' :
    'text-red-400';
  const otherLabel = collection === 'adversaries' ? 'environment' : 'adversary';

  return (
    <div className="relative">
      {/* Badges overlaid in top-right corner (inside the card, above the chevron) */}
      <div className="absolute top-2.5 right-8 z-10 flex items-center gap-1.5">
        {confidencePct != null && (
          <span className={`text-[10px] font-mono leading-none ${confColor} bg-slate-900 border border-slate-700 rounded px-1 py-0.5`}>
            {confidencePct}%
          </span>
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggleCollection(); }}
          title={`Switch to ${otherLabel}`}
          className="text-[10px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-1.5 py-0.5 flex items-center gap-0.5 transition-colors leading-none"
        >
          <ArrowLeftRight size={9} className="flex-shrink-0" />
          {otherLabel}
        </button>
      </div>
      <ImportPreviewCard
        item={item}
        collection={collection}
        existingItems={existingItems}
        selected={selected}
        onToggleSelect={onToggleSelect}
        onUpdate={onUpdate}
        colorScheme={colorScheme}
        replaceMode={replaceMode}
        onToggleReplace={onToggleReplace}
      />
    </div>
  );
}
