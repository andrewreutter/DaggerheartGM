/**
 * Server-side Game Table card preview (PNG) — sharp composite of the active map + tokens.
 * Scheduled with a trailing debounce after table ops; skipped when the visual hash is unchanged.
 */
import sharp from 'sharp';
import {
  TABLE_PREVIEW_WIDTH,
  TABLE_PREVIEW_HEIGHT,
  computeTablePreviewVisualHash,
  layoutPreviewTokens,
  pixelCropFromVisibleNorm,
  resolvePreviewMapAndView,
} from '../client/lib/table-preview-frame.js';
import { isValidMapViewVisibleNorm } from '../client/lib/map-view-sync.js';

export { computeTablePreviewVisualHash, layoutPreviewTokens, pixelCropFromVisibleNorm };

const DEFAULT_DEBOUNCE_MS = 4000;
const PREVIEW_BG = { r: 18, g: 18, b: 24, alpha: 1 };

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingByTableId = new Map();
/** @type {Map<string, string>} */
const lastHashByTableId = new Map();

export function clearTablePreviewSchedulerForTests() {
  for (const t of pendingByTableId.values()) clearTimeout(t);
  pendingByTableId.clear();
  lastHashByTableId.clear();
}

/**
 * Build an SVG overlay of token ellipses for sharp.composite.
 * @param {Array<{ cx: number, cy: number, rx: number, ry: number, fill: string }>} tokens
 * @param {number} w
 * @param {number} h
 * @returns {Buffer}
 */
export function previewTokensSvgBuffer(tokens, w = TABLE_PREVIEW_WIDTH, h = TABLE_PREVIEW_HEIGHT) {
  const ellipses = (tokens || []).map((t) => {
    const fill = String(t.fill || '#92400e').replace(/[<>&"]/g, '');
    return `<ellipse cx="${Number(t.cx)}" cy="${Number(t.cy)}" rx="${Number(t.rx)}" ry="${Number(t.ry)}" fill="${fill}" />`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${ellipses}</svg>`;
  return Buffer.from(svg);
}

async function fetchImageBuffer(url, fetchFn = fetch) {
  if (typeof url !== 'string' || !url || url.startsWith('data:')) return null;
  try {
    const res = await fetchFn(url);
    if (!res?.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch {
    return null;
  }
}

/**
 * Composite a 16:9 PNG of the table's active camera + tokens.
 * @param {object} state — table_state data
 * @param {{ fetchFn?: typeof fetch }} [opts]
 * @returns {Promise<Buffer>}
 */
export async function compositeTablePreviewPng(state, opts = {}) {
  const fetchFn = opts.fetchFn || fetch;
  const w = TABLE_PREVIEW_WIDTH;
  const h = TABLE_PREVIEW_HEIGHT;
  const { map, view } = resolvePreviewMapAndView(state);
  const tokens = layoutPreviewTokens(state, { previewW: w, previewH: h });
  const tokenSvg = previewTokensSvgBuffer(tokens, w, h);

  const mapBuf = map?.mapImageUrl ? await fetchImageBuffer(map.mapImageUrl, fetchFn) : null;
  let base = sharp({
    create: { width: w, height: h, channels: 4, background: PREVIEW_BG },
  }).png();

  if (mapBuf) {
    let img = sharp(mapBuf);
    const meta = await img.metadata();
    const imgW = meta.width || w;
    const imgH = meta.height || h;
    const vn = view?.mapViewVisibleNorm;
    const crop = pixelCropFromVisibleNorm(isValidMapViewVisibleNorm(vn) ? vn : null, imgW, imgH);
    img = sharp(mapBuf).extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    }).resize(w, h, { fit: 'fill' });
    const resized = await img.png().toBuffer();
    base = sharp(resized);
    const overlayUrl = map.overlayPng || map.fogPng || view?.overlayPng || view?.fogPng;
    if (overlayUrl) {
      const overlayBuf = await fetchImageBuffer(overlayUrl, fetchFn);
      if (overlayBuf) {
        const ov = await sharp(overlayBuf)
          .extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height })
          .resize(w, h, { fit: 'fill' })
          .png()
          .toBuffer()
          .catch(() => null);
        if (ov) {
          const withOv = await base.composite([{ input: ov, blend: 'over' }]).png().toBuffer();
          base = sharp(withOv);
        }
      }
    }
  }

  return base.composite([{ input: tokenSvg, blend: 'over' }]).png().toBuffer();
}

/**
 * Trailing debounce per tableId. `run` is called with the tableId when the window elapses
 * and the visual hash changed (or there is no previous hash).
 *
 * @param {string} tableId
 * @param {() => Promise<object|null>} loadState — returns table_state data
 * @param {(png: Buffer, state: object) => Promise<void>} persistPng
 * @param {{ delayMs?: number, setTimeoutFn?: typeof setTimeout, clearTimeoutFn?: typeof clearTimeout }} [opts]
 */
export function scheduleTablePreviewRefresh(tableId, loadState, persistPng, opts = {}) {
  if (!tableId) return;
  const delayMs = opts.delayMs ?? DEFAULT_DEBOUNCE_MS;
  const setT = opts.setTimeoutFn || setTimeout;
  const clearT = opts.clearTimeoutFn || clearTimeout;
  const prev = pendingByTableId.get(tableId);
  if (prev) clearT(prev);
  const handle = setT(() => {
    pendingByTableId.delete(tableId);
    void (async () => {
      try {
        const state = await loadState();
        if (!state) return;
        const hash = computeTablePreviewVisualHash(state);
        if (lastHashByTableId.get(tableId) === hash) return;
        const png = await compositeTablePreviewPng(state, opts);
        await persistPng(png, state);
        lastHashByTableId.set(tableId, hash);
      } catch (err) {
        console.error(`[table-preview] refresh failed for ${tableId}:`, err?.message || err);
      }
    })();
  }, delayMs);
  pendingByTableId.set(tableId, handle);
}
