/**
 * On-map camera picker (current-camera chip centered at the top of the map + hover overlay).
 * Pure helpers — no DOM.
 */

import { deriveMapConfigForMapId, deriveMapConfigForViewId } from './map-table-state.js';

/** Overlay padding so the current camera tile can sit on the trigger chip. */
export const MAP_CAMERA_PICKER_OVERLAY_PADDING_PX = 8;
/** “Maps” title size (px). */
export const MAP_CAMERA_PICKER_MAPS_TITLE_PX = 18;
/** “Cameras” title size — 80% of Maps. */
export const MAP_CAMERA_PICKER_CAMERAS_TITLE_PX = MAP_CAMERA_PICKER_MAPS_TITLE_PX * 0.8;
/** Title row height: Maps word plus the + Add chip. */
export const MAP_CAMERA_PICKER_HEADER_PX = 24;
/** Half of the overlay’s top padding, used as space under the title row. */
export const MAP_CAMERA_PICKER_HEADER_MARGIN_BOTTOM_PX = MAP_CAMERA_PICKER_OVERLAY_PADDING_PX / 2;
/** Overlay `border` width — content starts inside this. */
export const MAP_CAMERA_PICKER_BORDER_PX = 1;
/** Rule above each map/camera row. */
export const MAP_CAMERA_PICKER_ROW_RULE_PX = 1;
/** Space between the rule and the row title. */
export const MAP_CAMERA_PICKER_ROW_RULE_PAD_PX = 8;
/** Per-row map/camera name title above the tiles. */
export const MAP_CAMERA_PICKER_ROW_TITLE_PX = 20;
/** Gap between a row’s title and its tiles. */
export const MAP_CAMERA_PICKER_ROW_TITLE_GAP_PX = 8;
/** Space above the first tile: rule + pad + title + gap. */
export const MAP_CAMERA_PICKER_ROW_CHROME_PX =
  MAP_CAMERA_PICKER_ROW_RULE_PX
  + MAP_CAMERA_PICKER_ROW_RULE_PAD_PX
  + MAP_CAMERA_PICKER_ROW_TITLE_PX
  + MAP_CAMERA_PICKER_ROW_TITLE_GAP_PX;
/** Strip tile width (`w-[4.75rem]`). */
export const MAP_CAMERA_PICKER_TILE_WIDTH_REM = 4.75;
/** Row gap between tiles (`gap-1.5`). */
export const MAP_CAMERA_PICKER_TILE_GAP_REM = 0.375;
/** Cameras wrap onto a taller row after this many tiles. */
export const MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT = 4;
/** Size/artist/URL column beside the map tile (`w-[8.5rem]`). */
export const MAP_CAMERA_PICKER_META_WIDTH_REM = 8.5;
/** Space between the Maps column and the Cameras ribbon, as a fraction of tile width. */
export const MAP_CAMERA_PICKER_SECTION_GAP_RATIO = 0.25;
/** Idle chip is inset from the map’s top-right by this fraction of the tile width. */
export const MAP_CAMERA_PICKER_TRIGGER_SHIFT_RATIO = 0.2;
/** Delay before a hovered map/camera tile replaces the table viewport (local preview). */
export const MAP_CAMERA_PICKER_HOVER_PREVIEW_MS = 220;
/** Delay before leaving a tile restores the committed camera. */
export const MAP_CAMERA_PICKER_HOVER_PREVIEW_CLEAR_MS = 120;
/** `right-2` / `top-2` on the map viewport. */
export const MAP_CAMERA_PICKER_TRIGGER_BASE_INSET_REM = 0.5;
/** Thumbnail box used to pin the overlay tile onto the floating chip. */
export const MAP_CAMERA_PICKER_THUMB_ATTR = 'data-map-camera-thumb';

/**
 * The visible thumb inside a trigger/overlay tile, or `root` if none is marked.
 * @param {Element | null | undefined} root
 * @returns {Element | null}
 */
export function mapCameraPickerThumbEl(root) {
  if (root == null || typeof root.querySelector !== 'function') return root ?? null;
  return root.querySelector(`[${MAP_CAMERA_PICKER_THUMB_ATTR}]`) || root;
}

/**
 * Left offset of the idle camera chip inside the map viewport so its left edge
 * lines up with the Map Zoom / Camera Zoom title in the draw toolbar.
 * @param {{ left?: number } | null | undefined} titleRect
 * @param {{ left?: number } | null | undefined} viewportRect
 * @returns {number | null}
 */
export function mapCameraPickerTriggerLeftPx(titleRect, viewportRect) {
  const titleLeft = titleRect?.left;
  const viewportLeft = viewportRect?.left;
  if (!Number.isFinite(titleLeft) || !Number.isFinite(viewportLeft)) return null;
  return titleLeft - viewportLeft;
}

/**
 * CSS inset for the idle camera chip when the Zoom title is not on screen:
 * base inset plus ~20% of the tile width.
 * @param {number} [baseInsetRem]
 * @param {number} [tileWidthRem]
 * @param {number} [shiftRatio]
 * @returns {string}
 */
export function mapCameraPickerTriggerInsetRem(
  baseInsetRem = MAP_CAMERA_PICKER_TRIGGER_BASE_INSET_REM,
  tileWidthRem = MAP_CAMERA_PICKER_TILE_WIDTH_REM,
  shiftRatio = MAP_CAMERA_PICKER_TRIGGER_SHIFT_RATIO,
) {
  const inset = baseInsetRem + tileWidthRem * shiftRatio;
  return `${Number(inset.toFixed(4))}rem`;
}

/**
 * CSS width of a right-justified camera ribbon (`count` tiles + gaps).
 * Caps at {@link MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT} so extra cameras wrap.
 * This is the tile strip only — the Cameras heading (+ Add) may be wider
 * and should use this as a `minWidth`, not a fixed `width`.
 * @param {number} count
 * @returns {string}
 */
export function mapCameraPickerRibbonWidthRem(count) {
  const n = Math.max(1, Number(count) || 0);
  const capped = Math.min(n, MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT);
  const width = capped * MAP_CAMERA_PICKER_TILE_WIDTH_REM + (capped - 1) * MAP_CAMERA_PICKER_TILE_GAP_REM;
  return `${Number(width.toFixed(4))}rem`;
}

/**
 * Gap between the Maps column and the Cameras ribbon (25% of a tile).
 * @returns {string}
 */
export function mapCameraPickerSectionGapRem(
  tileWidthRem = MAP_CAMERA_PICKER_TILE_WIDTH_REM,
  ratio = MAP_CAMERA_PICKER_SECTION_GAP_RATIO,
) {
  return `${Number((tileWidthRem * ratio).toFixed(4))}rem`;
}

/**
 * Maps column: map tile + tile gap + size/artist/URL.
 * @returns {string}
 */
export function mapCameraPickerMapsColumnWidthRem(
  tileWidthRem = MAP_CAMERA_PICKER_TILE_WIDTH_REM,
  tileGapRem = MAP_CAMERA_PICKER_TILE_GAP_REM,
  metaWidthRem = MAP_CAMERA_PICKER_META_WIDTH_REM,
) {
  return `${Number((tileWidthRem + tileGapRem + metaWidthRem).toFixed(4))}rem`;
}

/**
 * Put the current map's group first; keep relative order of the rest.
 * @param {Array<{ map?: { id?: string } }>} groups
 * @param {string | null | undefined} currentMapId
 * @returns {Array<{ map?: { id?: string } }>}
 */
export function orderMapGroupsCurrentFirst(groups, currentMapId) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  if (!currentMapId) return [...groups];
  const current = [];
  const rest = [];
  for (const group of groups) {
    if (group?.map?.id === currentMapId) current.push(group);
    else rest.push(group);
  }
  return current.length ? [...current, ...rest] : [...groups];
}

/**
 * Put the current camera last on the first wrap row (under the trigger chip).
 * Extra cameras wrap below. Relative order of the rest is kept.
 * @param {Array<{ id?: string }>} cameras
 * @param {string | null | undefined} currentViewId
 * @param {number} [wrapCount]
 * @returns {Array<{ id?: string }>}
 */
export function orderCamerasCurrentLast(cameras, currentViewId, wrapCount = MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT) {
  if (!Array.isArray(cameras) || cameras.length === 0) return [];
  if (!currentViewId) return [...cameras];
  const current = [];
  const rest = [];
  for (const camera of cameras) {
    if (camera?.id === currentViewId) current.push(camera);
    else rest.push(camera);
  }
  if (current.length === 0) return [...cameras];
  const wrap = Math.max(1, Number(wrapCount) || MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT);
  const firstRowOthers = rest.slice(0, Math.max(0, wrap - current.length));
  const overflow = rest.slice(firstRowOthers.length);
  return [...firstRowOthers, ...current, ...overflow];
}

/**
 * Ribbon index of the current camera after {@link orderCamerasCurrentLast}
 * (last slot on the first wrap row).
 * @param {number} count
 * @param {number} [wrapCount]
 * @returns {number}
 */
export function mapCameraPickerRibbonAlignIndex(count, wrapCount = MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT) {
  const n = Math.max(0, Number(count) || 0);
  if (n === 0) return -1;
  const wrap = Math.max(1, Number(wrapCount) || MAP_CAMERA_PICKER_RIBBON_WRAP_COUNT);
  return Math.min(n, wrap) - 1;
}

/**
 * Which chip to show in the map's top-right corner.
 * Named view when one is active; otherwise the current map tile (free explore).
 *
 * @param {{
 *   isPlayer?: boolean,
 *   gmActiveViewId?: string | null,
 *   playerFreeMapExplore?: boolean,
 *   playerSelectedViewId?: string | null,
 *   activeMapId?: string | null,
 *   groups?: Array<{ map?: { id?: string }, views?: Array<{ id?: string, mapId?: string }> }>,
 * }} opts
 * @returns {{ kind: 'map' | 'view', map: object, view: object | null } | null}
 */
export function resolveMapCameraPickerTrigger({
  isPlayer = false,
  gmActiveViewId = null,
  playerFreeMapExplore = false,
  playerSelectedViewId = null,
  activeMapId = null,
  groups = [],
} = {}) {
  if (!Array.isArray(groups) || groups.length === 0) return null;

  const findGroupByMapId = (mapId) => groups.find((g) => g?.map?.id === mapId) ?? null;
  const findView = (viewId) => {
    if (!viewId) return null;
    for (const group of groups) {
      const view = (group.views || []).find((v) => v?.id === viewId);
      if (view) return { map: findGroupByMapId(view.mapId)?.map ?? group.map, view };
    }
    return null;
  };

  if (isPlayer) {
    if (!playerFreeMapExplore) {
      const named = findView(playerSelectedViewId);
      if (named) return { kind: 'view', map: named.map, view: named.view };
    }
    const mapGroup = findGroupByMapId(activeMapId) ?? groups[0];
    return mapGroup?.map ? { kind: 'map', map: mapGroup.map, view: null } : null;
  }

  if (gmActiveViewId) {
    const named = findView(gmActiveViewId);
    if (named) return { kind: 'view', map: named.map, view: named.view };
  }
  const mapGroup = findGroupByMapId(activeMapId) ?? groups[0];
  return mapGroup?.map ? { kind: 'map', map: mapGroup.map, view: null } : null;
}

/**
 * Fixed overlay style so the current (last) camera tile matches the trigger chip.
 * Anchors with CSS `right` so the overlay grows left from the upper-right chip.
 * @param {Pick<DOMRect, 'left' | 'top' | 'right'> | null | undefined} triggerRect
 * @param {{ paddingPx?: number, headerPx?: number, headerMarginBottomPx?: number, rowChromePx?: number, borderPx?: number, alignDelta?: { x?: number, y?: number }, viewportWidth?: number }} [opts]
 * @returns {{ position: 'fixed', right: number, top: number } | { position: 'fixed', left: number, top: number } | null}
 */
export function mapCameraPickerOverlayStyle(
  triggerRect,
  {
    paddingPx = MAP_CAMERA_PICKER_OVERLAY_PADDING_PX,
    headerPx = MAP_CAMERA_PICKER_HEADER_PX,
    headerMarginBottomPx = MAP_CAMERA_PICKER_HEADER_MARGIN_BOTTOM_PX,
    rowChromePx = MAP_CAMERA_PICKER_ROW_CHROME_PX,
    borderPx = MAP_CAMERA_PICKER_BORDER_PX,
    alignDelta = { x: 0, y: 0 },
    viewportWidth,
  } = {},
) {
  if (!triggerRect || !Number.isFinite(triggerRect.top)) {
    return null;
  }
  const dx = Number.isFinite(alignDelta?.x) ? alignDelta.x : 0;
  const dy = Number.isFinite(alignDelta?.y) ? alignDelta.y : 0;
  const top = triggerRect.top - paddingPx - borderPx - headerPx - headerMarginBottomPx - rowChromePx + dy;
  if (Number.isFinite(triggerRect.right) && Number.isFinite(viewportWidth)) {
    return {
      position: 'fixed',
      right: viewportWidth - triggerRect.right - paddingPx - borderPx - dx,
      top,
    };
  }
  if (!Number.isFinite(triggerRect.left)) return null;
  return {
    position: 'fixed',
    left: triggerRect.left - paddingPx - borderPx + dx,
    top,
  };
}

/**
 * Extra `left`/`top` so a measured first tile lands on the trigger chip.
 * @param {Pick<DOMRect, 'left' | 'top'> | null | undefined} triggerRect
 * @param {Pick<DOMRect, 'left' | 'top'> | null | undefined} firstTileRect
 * @returns {{ x: number, y: number }}
 */
export function mapCameraPickerAlignDelta(triggerRect, firstTileRect) {
  if (
    !triggerRect ||
    !firstTileRect ||
    !Number.isFinite(triggerRect.left) ||
    !Number.isFinite(triggerRect.top) ||
    !Number.isFinite(firstTileRect.left) ||
    !Number.isFinite(firstTileRect.top)
  ) {
    return { x: 0, y: 0 };
  }
  return {
    x: triggerRect.left - firstTileRect.left,
    y: triggerRect.top - firstTileRect.top,
  };
}

/**
 * @param {{ kind?: string, viewId?: string, mapId?: string } | null | undefined} a
 * @param {{ kind?: string, viewId?: string, mapId?: string } | null | undefined} b
 * @returns {boolean}
 */
export function isSameMapCameraHoverTarget(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'view') return a.viewId === b.viewId;
  if (a.kind === 'map') return a.mapId === b.mapId;
  return false;
}

/**
 * True when the hovered tile is already the committed camera / free-explore map.
 * @param {{ kind?: string, viewId?: string, mapId?: string } | null | undefined} target
 * @param {{ currentMapId?: string | null, currentViewId?: string | null }} [current]
 * @returns {boolean}
 */
export function isCurrentMapCameraHoverTarget(target, { currentMapId = null, currentViewId = null } = {}) {
  if (!target) return true;
  if (target.kind === 'view') return !!target.viewId && target.viewId === currentViewId;
  if (target.kind === 'map') {
    return currentViewId == null && !!target.mapId && target.mapId === currentMapId;
  }
  return false;
}

/**
 * Amber-highlight a strip tile while a hover preview is active.
 * @param {{ kind?: string, viewId?: string, mapId?: string } | null | undefined} target
 * @param {{ kind: 'map' | 'view', id?: string | null, fallback: boolean }} opts
 * @returns {boolean}
 */
export function mapCameraTileActiveDuringHover(target, { kind, id, fallback }) {
  if (target?.kind === 'view') return kind === 'view' && id === target.viewId;
  if (target?.kind === 'map') return kind === 'map' && id === target.mapId;
  return fallback;
}

function copyViewFraming(src) {
  if (!src || typeof src !== 'object') return null;
  return {
    mapViewZoomRatio: src.mapViewZoomRatio ?? null,
    mapViewPanNorm: src.mapViewPanNorm ?? null,
    mapViewVisibleNorm: src.mapViewVisibleNorm ?? null,
  };
}

function viewFramingIsSet(framing) {
  if (!framing) return false;
  if (framing.mapViewVisibleNorm && typeof framing.mapViewVisibleNorm === 'object') return true;
  if (framing.mapViewZoomRatio != null && Number.isFinite(framing.mapViewZoomRatio)) return true;
  const pan = framing.mapViewPanNorm;
  return !!(pan && typeof pan === 'object' && (Number.isFinite(pan.x) || Number.isFinite(pan.y)));
}

/**
 * Local-only table preview for a hovered map or camera tile.
 * Returns null when there is nothing to preview (missing target, or already current).
 *
 * @param {{
 *   target?: { kind?: string, viewId?: string, mapId?: string } | null,
 *   maps?: object[],
 *   mapViews?: object[],
 *   gmMapView?: object | null,
 *   currentMapId?: string | null,
 *   currentViewId?: string | null,
 * }} [opts]
 * @returns {{
 *   kind: 'map' | 'view',
 *   mapId: string,
 *   viewId: string | null,
 *   mapConfig: object,
 *   fitToView: boolean,
 * } | null}
 */
export function resolveMapCameraHoverPreview({
  target = null,
  maps = [],
  mapViews = [],
  gmMapView = null,
  currentMapId = null,
  currentViewId = null,
} = {}) {
  if (!target) return null;
  if (isCurrentMapCameraHoverTarget(target, { currentMapId, currentViewId })) return null;

  if (target.kind === 'view') {
    const view = (mapViews || []).find((v) => v?.id === target.viewId);
    if (!view) return null;
    return {
      kind: 'view',
      viewId: view.id,
      mapId: view.mapId,
      mapConfig: deriveMapConfigForViewId({ maps, mapViews }, view.id),
      fitToView: false,
    };
  }

  if (target.kind !== 'map' || !target.mapId) return null;
  const map = (maps || []).find((m) => m?.id === target.mapId);
  if (!map) return null;
  const base = deriveMapConfigForMapId({ maps, mapViews }, map.id);
  const framing = gmMapView?.mapId === map.id ? copyViewFraming(gmMapView) : null;
  const hasFraming = viewFramingIsSet(framing);
  return {
    kind: 'map',
    viewId: null,
    mapId: map.id,
    mapConfig: hasFraming ? { ...base, ...framing } : base,
    fitToView: !hasFraming,
  };
}
