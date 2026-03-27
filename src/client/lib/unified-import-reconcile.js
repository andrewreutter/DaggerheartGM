import { generateId } from './helpers.js';

/** @param {number} W @param {number} H */
export function defaultFullRect(W, H) {
  return { x0: 0, y0: 0, x1: W, y1: H };
}

/**
 * @typedef {{ id: string, rect: { x0: number, y0: number, x1: number, y1: number }, ocrText?: string, ocrHasText?: boolean, ocrComplete?: boolean }} ImageRegion
 * @typedef {{ id: string, file: File, layout: { width: number, height: number, dataUrl: string, mime: string }, regions: ImageRegion[] }} ImageAsset
 * @typedef {{ id: string, body: string }} TextAsset
 */

/**
 * @param {ImageAsset[]} imageAssets
 * @param {TextAsset[]} textAssets
 */
export function buildSliceDescriptors(imageAssets, textAssets) {
  /** @type {any[]} */
  const out = [];
  for (const img of imageAssets) {
    const { width: W, height: H } = img.layout;
    for (const reg of img.regions) {
      const id = `img:${img.id}:${reg.id}`;
      const structuralKey = `img|${img.layout.dataUrl.length}|${img.id}|${reg.id}|${reg.rect.x0},${reg.rect.y0},${reg.rect.x1},${reg.rect.y1}`;
      const ocrDone = !!reg.ocrComplete;
      out.push({
        id,
        structuralKey,
        source: 'image',
        assetId: img.id,
        regionId: reg.id,
        layout: img.layout,
        rect: reg.rect,
        textBody: '',
        ocrText: ocrDone ? (reg.ocrText ?? '') : '',
        ocrHasText: ocrDone ? !!reg.ocrHasText : false,
        ocrPending: !ocrDone,
      });
    }
  }
  for (const t of textAssets) {
    const id = `txt:${t.id}`;
    /** Stable per text asset — body edits merge without resetting pipeline. */
    const structuralKey = `txt|${t.id}`;
    out.push({
      id,
      structuralKey,
      source: 'text',
      assetId: t.id,
      regionId: null,
      layout: null,
      rect: null,
      textBody: t.body,
    });
  }
  return out;
}

/**
 * @param {any[]} prevRows
 * @param {any[]} descriptors
 * @param {(d: object) => object} defaultRow
 */
export function reconcileSliceRows(prevRows, descriptors, defaultRow) {
  const prevById = new Map(prevRows.map((r) => [r.id, r]));
  return descriptors.map((d) => {
    const old = prevById.get(d.id);
    if (!old) return { ...defaultRow(d), ...d };
    if (old.structuralKey !== d.structuralKey) {
      const next = { ...defaultRow(d), ...d };
      next.preferTextForParse = old.preferTextForParse;
      next.imageTarget = old.imageTarget;
      next.libraryCollection = old.libraryCollection;
      next.attachToSliceId = old.attachToSliceId;
      return next;
    }
    return { ...old, ...d };
  });
}

export function createImageAssetFromLayout(file, layout) {
  const W = layout.width;
  const H = layout.height;
  const rid = generateId();
  return {
    id: generateId(),
    file,
    layout,
    regions: [{ id: rid, rect: defaultFullRect(W, H) }],
  };
}

export function createTextAsset(body = '') {
  return { id: generateId(), body };
}
