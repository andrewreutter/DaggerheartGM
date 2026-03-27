/**
 * Page layout helpers for GM page-image preview (Tesseract line geometry).
 * Pure functions — testable without sharp/tesseract.
 */

// Mirrors artwork extraction in ocr-parse.js (margin heuristics).
export const ARTWORK_MIN_AREA_FRACTION = 0.10;
export const ARTWORK_MIN_SHORT_SIDE_PX = 100;
export const ARTWORK_MAX_ASPECT_RATIO = 5;
export const ARTWORK_CROP_INSET_FRACTION = 0.02;

/** Minimum confidence for lines included in text union / artwork margins (ocr-parse). */
export const LAYOUT_LINE_CONFIDENCE_ARTWORK = 85;

/** Slightly looser threshold for paragraph clustering / text block visualization. */
export const LAYOUT_LINE_CONFIDENCE_TEXT = 60;

export const LAYOUT_MIN_TEXT_LEN = 2;

/**
 * @param {number[]} arr
 * @returns {number}
 */
export function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * @param {{ x0: number, y0: number, x1: number, y1: number }} a
 * @param {{ x0: number, y0: number, x1: number, y1: number }} b
 * @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
export function unionBbox(a, b) {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

/**
 * Cluster sorted OCR lines into paragraph-ish blocks by vertical gap.
 *
 * @param {Array<{ bbox: { x0, y0, x1, y1 }, text: string, confidence: number }>} detections
 * @param {object} [opts]
 * @param {number} [opts.minConfidence]
 * @param {number} [opts.gapMultiplier] — gap threshold = medianLineHeight * this
 * @returns {Array<{ x0: number, y0: number, x1: number, y1: number, text: string }>}
 */
export function clusterLinesToTextBlocks(detections, opts = {}) {
  const minConf = opts.minConfidence ?? LAYOUT_LINE_CONFIDENCE_TEXT;
  const minLen = opts.minTextLen ?? LAYOUT_MIN_TEXT_LEN;
  const gapMult = opts.gapMultiplier ?? 0.5;

  const lines = detections.filter(
    d => d.confidence > minConf && d.text.trim().length > minLen
  );
  if (lines.length === 0) return [];

  const sorted = [...lines].sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0);
  const heights = sorted.map(l => l.bbox.y1 - l.bbox.y0);
  const medH = median(heights) || 12;
  const gapThresh = medH * gapMult;

  const clusters = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = cur[cur.length - 1];
    const next = sorted[i];
    const gap = next.bbox.y0 - prev.bbox.y1;
    if (gap <= gapThresh) {
      cur.push(next);
    } else {
      clusters.push(cur);
      cur = [next];
    }
  }
  clusters.push(cur);

  return clusters.map((cluster) => {
    let box = { ...cluster[0].bbox };
    let text = cluster[0].text.trim();
    for (let i = 1; i < cluster.length; i++) {
      box = unionBbox(box, cluster[i].bbox);
      text += ` ${cluster[i].text.trim()}`;
    }
    return {
      x0: box.x0,
      y0: box.y0,
      x1: box.x1,
      y1: box.y1,
      text,
    };
  });
}

/**
 * Whether OCR line detections contain readable paragraph text (same filters as layout text blocks).
 *
 * @param {Array<{ bbox: { x0, y0, x1, y1 }, text: string, confidence: number }>} detections
 * @returns {boolean}
 */
export function ocrDetectionsIndicateText(detections) {
  return clusterLinesToTextBlocks(detections).length > 0;
}

/**
 * Margin-based "image" regions around the text union — same geometry as stat-block artwork extraction.
 * v1 does not detect inline illustrations inside the text column (see ocr-parse / plan).
 *
 * @param {number} W
 * @param {number} H
 * @param {Array<{ bbox: { x0, y0, x1, y1 }, text: string, confidence: number }>} lines — pre-filtered high-confidence lines
 * @returns {Array<{ x0: number, y0: number, x1: number, y1: number }>}
 */
export function getArtworkMarginRects(W, H, lines) {
  if (lines.length === 0) return [];

  let textMinX = Infinity;
  let textMinY = Infinity;
  let textMaxX = -Infinity;
  let textMaxY = -Infinity;
  for (const { bbox: { x0, y0, x1, y1 } } of lines) {
    if (x0 < textMinX) textMinX = x0;
    if (y0 < textMinY) textMinY = y0;
    if (x1 > textMaxX) textMaxX = x1;
    if (y1 > textMaxY) textMaxY = y1;
  }

  const totalArea = W * H;

  const candidates = [
    { name: 'top', region: { left: 0, top: 0, width: W, height: textMinY } },
    { name: 'left', region: { left: 0, top: 0, width: textMinX, height: H } },
    { name: 'bottom', region: { left: 0, top: textMaxY, width: W, height: H - textMaxY } },
    { name: 'right', region: { left: textMaxX, top: 0, width: W - textMaxX, height: H } },
  ];

  const out = [];

  for (const { name, region } of candidates) {
    const { left, top, width, height } = region;
    if (width <= 0 || height <= 0) continue;

    const area = width * height;
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);

    if (area / totalArea < ARTWORK_MIN_AREA_FRACTION) continue;
    if (shortSide < ARTWORK_MIN_SHORT_SIDE_PX) continue;
    if (longSide / shortSide > ARTWORK_MAX_ASPECT_RATIO) continue;

    let cropLeft = left;
    let cropTop = top;
    let cropWidth = width;
    let cropHeight = height;
    const insetX = Math.floor(width * ARTWORK_CROP_INSET_FRACTION);
    const insetY = Math.floor(height * ARTWORK_CROP_INSET_FRACTION);

    if (name === 'top') {
      cropHeight = Math.max(1, height - insetY);
    } else if (name === 'bottom') {
      cropTop = top + insetY;
      cropHeight = Math.max(1, height - insetY);
    } else if (name === 'left') {
      cropWidth = Math.max(1, width - insetX);
    } else if (name === 'right') {
      cropLeft = left + insetX;
      cropWidth = Math.max(1, width - insetX);
    }

    cropLeft = Math.max(0, Math.min(cropLeft, W - 1));
    cropTop = Math.max(0, Math.min(cropTop, H - 1));
    cropWidth = Math.max(1, Math.min(cropWidth, W - cropLeft));
    cropHeight = Math.max(1, Math.min(cropHeight, H - cropTop));

    out.push({
      x0: cropLeft,
      y0: cropTop,
      x1: cropLeft + cropWidth,
      y1: cropTop + cropHeight,
    });
  }

  return out;
}

/**
 * @param {{ x0: number, y0: number, x1: number, y1: number }} r
 * @param {number} W
 * @param {number} H
 */
export function addNormalizedRect(r, W, H) {
  return {
    ...r,
    nx0: r.x0 / W,
    ny0: r.y0 / H,
    nx1: r.x1 / W,
    ny1: r.y1 / H,
  };
}
