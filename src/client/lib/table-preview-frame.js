import { isValidMapViewVisibleNorm } from './map-view-sync.js';
import { getMapDimensionsFt } from './map-dimensions-ft.js';
import { getTokenFootprintFt } from './token-size.js';
import { effectiveTokenMapId } from './map-table-state.js';
import { tokenPreviewFillHex } from './token-preview-colors.js';

export const TABLE_PREVIEW_WIDTH = 640;
export const TABLE_PREVIEW_HEIGHT = 360;

/**
 * Pixel crop of a map image for the GM's active camera (`mapViewVisibleNorm`).
 * @param {{ x: number, y: number, w: number, h: number }|null|undefined} vn
 * @param {number} imgW
 * @param {number} imgH
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function pixelCropFromVisibleNorm(vn, imgW, imgH) {
  const w = Math.max(1, Math.round(Number(imgW) || 1));
  const h = Math.max(1, Math.round(Number(imgH) || 1));
  if (!isValidMapViewVisibleNorm(vn)) {
    return { left: 0, top: 0, width: w, height: h };
  }
  const left = Math.max(0, Math.min(w - 1, Math.round(vn.x * w)));
  const top = Math.max(0, Math.min(h - 1, Math.round(vn.y * h)));
  const width = Math.max(1, Math.min(w - left, Math.round(vn.w * w)));
  const height = Math.max(1, Math.min(h - top, Math.round(vn.h * h)));
  return { left, top, width, height };
}

/**
 * Active map row + GM camera used for homepage table previews.
 * @param {object} state
 * @returns {{ map: object|null, view: object|null }}
 */
export function resolvePreviewMapAndView(state) {
  const maps = Array.isArray(state?.maps) ? state.maps : [];
  const views = Array.isArray(state?.mapViews) ? state.mapViews : [];
  let map = null;
  if (state?.activeMapId) map = maps.find((m) => m?.id === state.activeMapId) || null;
  if (!map && state?.gmActiveViewId) {
    const v = views.find((row) => row?.id === state.gmActiveViewId);
    if (v?.mapId) map = maps.find((m) => m?.id === v.mapId) || null;
  }
  if (!map) map = maps[0] || null;
  if (!map && state?.mapConfig?.mapImageUrl) {
    map = {
      id: state.activeMapId || 'm-default',
      mapImageUrl: state.mapConfig.mapImageUrl,
      mapSizeFt: state.mapConfig.mapSizeFt,
      mapDimension: state.mapConfig.mapDimension,
      mapImageNaturalWidth: state.mapConfig.mapImageNaturalWidth,
      mapImageNaturalHeight: state.mapConfig.mapImageNaturalHeight,
      overlayPng: state.mapConfig.overlayPng || state.mapConfig.fogPng || null,
    };
  }
  let view = null;
  if (state?.gmActiveViewId) {
    view = views.find((row) => row?.id === state.gmActiveViewId) || null;
  }
  if (!view && state?.gmMapView && typeof state.gmMapView === 'object') {
    view = state.gmMapView;
  }
  return { map, view };
}

/**
 * Cheap visual hash: skip regenerating the PNG when nothing visible changed.
 * @param {object} state
 * @returns {string}
 */
export function computeTablePreviewVisualHash(state) {
  const { map, view } = resolvePreviewMapAndView(state);
  const mapId = map?.id ?? '';
  const vn = view?.mapViewVisibleNorm ?? null;
  const framing = isValidMapViewVisibleNorm(vn)
    ? `${vn.x.toFixed(4)},${vn.y.toFixed(4)},${vn.w.toFixed(4)},${vn.h.toFixed(4)}`
    : `${view?.mapViewZoomRatio ?? ''}|${JSON.stringify(view?.mapViewPanNorm ?? null)}`;
  const mapKey = effectiveTokenMapId(map?.id);
  const tokens = [];
  const elements = Array.isArray(state?.elements)
    ? state.elements
    : (Array.isArray(state?.activeElements) ? state.activeElements : []);
  let allyI = 0;
  for (const el of elements) {
    if (!el) continue;
    const type = el.elementType;
    if (type !== 'character' && type !== 'adversary' && type !== 'boardToken') continue;
    if (el.tokenX == null || el.tokenY == null) continue;
    if (effectiveTokenMapId(el.mapId) !== mapKey) continue;
    const x = Math.round(Number(el.tokenX) || 0);
    const y = Math.round(Number(el.tokenY) || 0);
    const portrait = typeof el.imageUrl === 'string' ? el.imageUrl : '';
    const ally = (type === 'character' || type === 'boardToken') ? allyI++ : '';
    tokens.push(`${el.instanceId}:${type}:${x}:${y}:${portrait}:${el.role || ''}:${ally}`);
  }
  tokens.sort();
  const overlay = map?.overlayPng ? '1' : '0';
  const art = typeof map?.mapImageUrl === 'string' ? map.mapImageUrl : '';
  return `${mapId}|${framing}|${overlay}|${art}|${tokens.join(';')}`;
}

/**
 * Token ellipses in preview pixel space (16:9 card).
 * @param {object} state
 * @param {{ previewW?: number, previewH?: number }} [opts]
 * @returns {Array<{ cx: number, cy: number, rx: number, ry: number, fill: string }>}
 */
export function layoutPreviewTokens(state, opts = {}) {
  const previewW = opts.previewW ?? TABLE_PREVIEW_WIDTH;
  const previewH = opts.previewH ?? TABLE_PREVIEW_HEIGHT;
  const { map, view } = resolvePreviewMapAndView(state);
  if (!map) return [];
  const dims = getMapDimensionsFt(map);
  const vn = view?.mapViewVisibleNorm;
  const cropX = isValidMapViewVisibleNorm(vn) ? vn.x * dims.mapWidthFt : 0;
  const cropY = isValidMapViewVisibleNorm(vn) ? vn.y * dims.mapHeightFt : 0;
  const cropW = isValidMapViewVisibleNorm(vn) ? vn.w * dims.mapWidthFt : dims.mapWidthFt;
  const cropH = isValidMapViewVisibleNorm(vn) ? vn.h * dims.mapHeightFt : dims.mapHeightFt;
  if (!(cropW > 0) || !(cropH > 0)) return [];
  const mapKey = effectiveTokenMapId(map.id);
  const elements = Array.isArray(state?.elements)
    ? state.elements
    : (Array.isArray(state?.activeElements) ? state.activeElements : []);
  const out = [];
  let allyI = 0;
  for (const el of elements) {
    if (!el) continue;
    const type = el.elementType;
    if (type !== 'character' && type !== 'adversary' && type !== 'boardToken') continue;
    if (el.tokenX == null || el.tokenY == null) continue;
    if (effectiveTokenMapId(el.mapId) !== mapKey) continue;
    const fp = getTokenFootprintFt(el);
    const cxFt = Number(el.tokenX) + fp.halfWidth;
    const cyFt = Number(el.tokenY) + fp.halfLength;
    const cx = ((cxFt - cropX) / cropW) * previewW;
    const cy = ((cyFt - cropY) / cropH) * previewH;
    const rx = (fp.halfWidth / cropW) * previewW;
    const ry = (fp.halfLength / cropH) * previewH;
    const allyIndex = (type === 'character' || type === 'boardToken') ? allyI++ : 0;
    out.push({
      cx,
      cy,
      rx: Math.max(2, rx),
      ry: Math.max(2, ry),
      fill: tokenPreviewFillHex(el, allyIndex),
    });
  }
  return out;
}
