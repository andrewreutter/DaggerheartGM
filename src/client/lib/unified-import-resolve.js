import { getAuthToken, postEncounterParseText, postPageLayoutRegionOcr } from './api.js';
import { cropLayoutRegionToPngBlob, cropLayoutRegionToPngDataUrl } from './page-layout-load.js';
import { defaultAdversaryStub, defaultEnvironmentStub } from './unified-import-commit.js';
import { buildDefaultNewSrdLibraryItem } from './library-default-new-item.js';
import { generateId } from './helpers.js';

/**
 * Parse pasted text via server auto-detect (first block).
 * @param {string} text
 * @returns {Promise<{ collection: string, item: object } | null>}
 */
export async function parseImportTextAuto(text) {
  const t = (text || '').trim();
  if (!t) return null;
  const token = await getAuthToken();
  if (!token) throw new Error('Not signed in');
  const fd = new FormData();
  fd.append('text', t);
  const res = await fetch('/api/import/parse', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const { results } = await res.json();
  const first = results?.[0];
  if (!first?.item) return null;
  return {
    collection: first.collection,
    item: { ...first.item, id: first.item.id || generateId() },
  };
}

/**
 * Parse text as a specific encounter/library kind.
 * @param {string} text
 * @param {'adversaries'|'environments'|'notes'} collection
 */
export async function parseImportTextAsKind(text, collection) {
  const t = (text || '').trim();
  if (!t) return null;
  const kind = collection === 'adversaries' ? 'adversary' : collection === 'environments' ? 'environment' : 'note';
  const r = await postEncounterParseText(t, kind);
  const item = r?.item;
  if (!item) return null;
  return { collection, item: { ...item, id: item.id || generateId() } };
}

/**
 * OCR a rectangle from a layout image.
 * @param {string} layoutDataUrl
 * @param {{ x0: number, y0: number, x1: number, y1: number }} rect
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function ocrLayoutRegion(layoutDataUrl, rect, opts = {}) {
  const blob = await cropLayoutRegionToPngBlob(layoutDataUrl, rect.x0, rect.y0, rect.x1, rect.y1);
  const { text, hasText } = await postPageLayoutRegionOcr(blob, opts);
  const trimmed = String(text || '').trim();
  const legible = !!hasText && trimmed.length > 0;
  return { ocrText: legible ? trimmed : '', ocrHasText: legible };
}

/**
 * Build a minimal library draft for a non-adv/env/note collection with an image.
 * @param {string} collection
 * @param {string} id
 * @param {string} imageUrl
 */
export function buildBlankLibraryDraft(collection, id, imageUrl) {
  const base = buildDefaultNewSrdLibraryItem(collection);
  return {
    ...base,
    id,
    name: base.name || 'Imported',
    imageUrl: imageUrl || '',
    is_public: false,
  };
}

/**
 * Follow attach chains to the slice row that owns the import output (non-attach row).
 * @param {object} row
 * @param {object[]} allRows
 */
export function resolveAttachPrimary(row, allRows) {
  if (!row) return null;
  let cur = row;
  const seen = new Set();
  while (cur?.imageTarget === 'attach' && cur.attachToSliceId) {
    if (seen.has(cur.id)) return null;
    seen.add(cur.id);
    const next = allRows.find((r) => r.id === cur.attachToSliceId);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/**
 * Merge crops from all image slices that attach to this primary row into `imageUrl` / `_additionalImages`.
 * @param {object} primaryRow
 * @param {object | null} draft
 * @param {string | null} draftCollection
 * @param {object[]} allRows
 */
async function mergeAttachingImageCropsIntoDraft(primaryRow, draft, draftCollection, allRows) {
  if (!draft || draftCollection === 'map' || !draftCollection) return draft;
  const attachers = allRows.filter(
    (r) => r.source === 'image' && r.imageTarget === 'attach' && r.attachToSliceId === primaryRow.id,
  );
  if (!attachers.length) return draft;
  /** @type {string[]} */
  const urls = [];
  for (const ar of attachers) {
    if (!ar.layout || !ar.rect) continue;
    const u = await cropLayoutRegionToPngDataUrl(
      ar.layout.dataUrl,
      ar.rect.x0,
      ar.rect.y0,
      ar.rect.x1,
      ar.rect.y1,
    );
    urls.push(u);
  }
  if (!urls.length) return draft;
  const next = { ...draft };
  const prevAdd = Array.isArray(next._additionalImages) ? [...next._additionalImages] : [];
  for (const u of urls) {
    if (!next.imageUrl) next.imageUrl = u;
    else prevAdd.push(u);
  }
  next._additionalImages = prevAdd;
  return next;
}

/**
 * Build a draft library/table object from a unified import slice row (optimistic pipeline).
 * @param {object} row — merged descriptor + pipeline fields from {@link UnifiedImportModal}
 * @param {object[]} allRows
 * @returns {Promise<{ draft: object | null, draftCollection: string | null, parseError: string | null }>}
 */
export async function buildDraftForImportSlice(row, allRows) {
  const id = generateId();
  try {
    if (row.imageTarget === 'attach' && row.attachToSliceId) {
      const primary = resolveAttachPrimary(row, allRows);
      if (!primary) {
        return { draft: null, draftCollection: null, parseError: 'Attach target missing' };
      }
      return buildDraftForImportSlice(primary, allRows);
    }

    if (row.source === 'text') {
      const body = (row.textBody || '').trim();
      if (!body) {
        return { draft: null, draftCollection: null, parseError: null };
      }
      const coll = row.libraryCollection || 'adversaries';
      if (coll === 'adversaries' || coll === 'environments' || coll === 'notes') {
        const r = await parseImportTextAsKind(body, coll);
        if (!r?.item) {
          return { draft: null, draftCollection: null, parseError: 'Could not parse text' };
        }
        let item = { ...r.item, is_public: false };
        if (coll === 'adversaries' || coll === 'environments') {
          const { imageUrl: _i, _additionalImages: _a, ...rest } = item;
          item = { ...rest, is_public: false };
        }
        const draft = await mergeAttachingImageCropsIntoDraft(row, item, coll, allRows);
        return { draft, draftCollection: coll, parseError: null };
      }
      const auto = await parseImportTextAuto(body);
      if (!auto?.item) {
        return { draft: null, draftCollection: null, parseError: 'Could not parse text' };
      }
      let item = { ...auto.item, is_public: false };
      if (auto.collection === 'adversaries' || auto.collection === 'environments') {
        const { imageUrl: _i, _additionalImages: _a, ...rest } = item;
        item = { ...rest, is_public: false };
      }
      const draft = await mergeAttachingImageCropsIntoDraft(row, item, auto.collection, allRows);
      return { draft, draftCollection: auto.collection, parseError: null };
    }

    if (row.source !== 'image' || !row.layout || !row.rect) {
      return { draft: null, draftCollection: null, parseError: null };
    }

    const cropDataUrl = await cropLayoutRegionToPngDataUrl(
      row.layout.dataUrl,
      row.rect.x0,
      row.rect.y0,
      row.rect.x1,
      row.rect.y1,
    );
    const bw = Math.max(1, Math.round(row.rect.x1 - row.rect.x0));
    const bh = Math.max(1, Math.round(row.rect.y1 - row.rect.y0));

    if (row.imageTarget === 'map') {
      const prevCam =
        row.draft?.kind === 'map' && Array.isArray(row.draft.mapCameraExtraNorms) ? row.draft.mapCameraExtraNorms : [];
      return {
        draft: {
          kind: 'map',
          mapImageUrl: cropDataUrl,
          mapImageNaturalWidth: bw,
          mapImageNaturalHeight: bh,
          mapCameraExtraNorms: prevCam,
        },
        draftCollection: 'map',
        parseError: null,
      };
    }

    const coll = row.libraryCollection || 'adversaries';
    const useText = row.preferTextForParse !== false && row.ocrHasText && (row.ocrText || '').trim();
    const text = useText ? row.ocrText.trim() : '';

    if (coll === 'adversaries') {
      if (text) {
        const r = await postEncounterParseText(text, 'adversary');
        const item = r?.item;
        if (!item) {
          const stub = await mergeAttachingImageCropsIntoDraft(
            row,
            { ...defaultAdversaryStub(id, ''), is_public: false },
            'adversaries',
            allRows,
          );
          return { draft: stub, draftCollection: 'adversaries', parseError: null };
        }
        const { imageUrl: _ignore, _additionalImages: _a, ...rest } = item;
        const merged = await mergeAttachingImageCropsIntoDraft(
          row,
          { ...rest, id: item.id || id, is_public: false },
          'adversaries',
          allRows,
        );
        return { draft: merged, draftCollection: 'adversaries', parseError: null };
      }
      const merged = await mergeAttachingImageCropsIntoDraft(
        row,
        { ...defaultAdversaryStub(id, cropDataUrl), is_public: false },
        'adversaries',
        allRows,
      );
      return { draft: merged, draftCollection: 'adversaries', parseError: null };
    }

    if (coll === 'environments') {
      if (text) {
        const r = await postEncounterParseText(text, 'environment');
        const item = r?.item;
        if (!item) {
          const stub = await mergeAttachingImageCropsIntoDraft(
            row,
            { ...defaultEnvironmentStub(id, ''), is_public: false },
            'environments',
            allRows,
          );
          return { draft: stub, draftCollection: 'environments', parseError: null };
        }
        const { imageUrl: _ignore, _additionalImages: _a, ...rest } = item;
        const merged = await mergeAttachingImageCropsIntoDraft(
          row,
          { ...rest, id: item.id || id, is_public: false },
          'environments',
          allRows,
        );
        return { draft: merged, draftCollection: 'environments', parseError: null };
      }
      const merged = await mergeAttachingImageCropsIntoDraft(
        row,
        { ...defaultEnvironmentStub(id, cropDataUrl), is_public: false },
        'environments',
        allRows,
      );
      return { draft: merged, draftCollection: 'environments', parseError: null };
    }

    if (coll === 'notes') {
      if (text) {
        const r = await postEncounterParseText(text, 'note');
        const item = r?.item;
        const base = {
          id: item?.id || id,
          name: item?.name || 'Note',
          body: item?.body ?? '',
          is_public: false,
        };
        const merged = await mergeAttachingImageCropsIntoDraft(row, base, 'notes', allRows);
        return { draft: merged, draftCollection: 'notes', parseError: null };
      }
      const merged = await mergeAttachingImageCropsIntoDraft(
        row,
        { id, name: 'Note', body: '', imageUrl: cropDataUrl, is_public: false },
        'notes',
        allRows,
      );
      return { draft: merged, draftCollection: 'notes', parseError: null };
    }

    const blank = buildBlankLibraryDraft(coll, id, cropDataUrl);
    blank.is_public = false;
    const mergedBlank = await mergeAttachingImageCropsIntoDraft(row, blank, coll, allRows);
    return { draft: mergedBlank, draftCollection: coll, parseError: null };
  } catch (e) {
    return {
      draft: null,
      draftCollection: null,
      parseError: e?.message || 'Parse failed',
    };
  }
}
