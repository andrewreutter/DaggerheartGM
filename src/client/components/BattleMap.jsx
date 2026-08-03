import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, Fragment, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  applyViewportWheelPanZoom,
  clampMapZoom,
  clampPanScroll,
  computeMapZoomBounds,
  computePanToCenterInnerPointPx,
  computeZoomAndPanToFitInnerBounds,
  scrollAfterZoomTowardPoint,
} from '../lib/battle-map-zoom.js';
import {
  callLatestOnMapViewSync,
  decodeMapViewState,
  encodeMapViewState,
  isValidMapViewVisibleNorm,
} from '../lib/map-view-sync.js';
import {
  shouldApplyRemotePlayerMapView,
  freeMapExploreTargetsUnsharedMap,
  shouldPreferCachedPlayerRemoteView,
  shouldShowPlayerMapViewStrip,
} from '../lib/map-view-player-sync.js';
import {
  gmMapStripFullMapTileActive,
  playerMapStripFullMapTileActive,
} from '../lib/map-view-strip-active.js';
import {
  Upload,
  X,
  Map as MapIcon,
  ArrowLeftToLine,
  Pencil,
  Eraser,
  Eye,
  EyeOff,
  Trash2,
  CircleX,
  Focus,
  Camera,
  Radio,
  Paintbrush,
  PencilLine,
  Square,
  Circle,
  Pipette,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { ConditionsTextInput } from './ConditionsTextInput.jsx';
import { AnchoredFloatingPanel } from './AnchoredFloatingPanel.jsx';
import { getAuthToken, postMapPing, postMapScribble, postBannerAck, CLIENT_ID, imageGenEnabled } from '../lib/api.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowImageGenAiUi } from '../lib/ai-ui-visibility.js';
import { MapAiImageDialog } from './MapAiImageDialog.jsx';
import Fireworks from 'fireworks-js';
import { effectiveTokenMapId, DEFAULT_LEGACY_MAP_ID, mapConfigHasImage } from '../lib/map-table-state.js';
import { buildCharacterTrayTokenEntries } from '../lib/character-tray-tokens.js';
import { getMapDimensionsFt as getMapDimensions, MAP_SIZE_FT_MIN, MAP_SIZE_FT_MAX } from '../lib/map-dimensions-ft.js';
import { getGmTotMEmptyMapHint, getPlayerTotMEmptyMapHint } from '../lib/battle-map-totm-hint.js';
import { isAdversaryDefeated } from '../lib/helpers.js';
import { EncounterAdversaryMarkedSummary } from './EncounterAdversaryMarkedSummary.jsx';
import { playerEncounterInstanceRowVisible } from '../lib/encounter-adversary-player-summary.js';
import { getRangeBandIndexForDistanceFt } from '../lib/map-range.js';
import {
  computeMapDrawCanvasSize,
  DEFAULT_MAP_DRAW_BRUSH_RADIUS_FT,
  MAP_DRAW_BRUSH_RADIUS_FT_MIN,
  ftToDrawPixel,
  drawPixelToFt,
  scribbleCanvasLayoutKey,
  hexToRgba,
  loadDrawDataUrlOntoCanvas,
  clearDrawCanvas,
  strokeDrawSegment,
  fillDrawRect,
  fillDrawEllipse,
  strokeOutlineRect,
  strokeOutlineEllipse,
  floodEraseConnectedComponent,
  ERASER_DESTINATION_OUT,
  rgbStringFromRgba,
  alphaFromRgbaString,
  multiplyRgbaAlpha,
  fillBrushDot,
  SCRIBBLE_FADE_MS,
  isNonDegenerateScribbleSegmentPx,
} from '../lib/map-draw-layer.js';
import {
  dataTransferHasFileDrag,
  pickFirstImageFileFromDataTransfer,
} from '../lib/map-image-drop.js';
import { useUnifiedImport } from '../lib/unified-import-context.jsx';
import { buildMapStripTileTokenSignature } from '../lib/map-strip-tile-signature.js';

const MIN_PX_PER_FT = 33 / 5; // 6.6 px/ft — 5' token ≥ 33px touch target
const DRAG_THRESHOLD_PX = 8;
/** Approx. time for fireworks-js rocket to reach target (no API hook); tuned for default trace speed. */
const MAP_PING_FIREWORK_LAND_MS = 800;
const MAP_PING_LABEL_FADE_MS = 5000;

function rgbBytesToHex(r, g, b) {
  return `#${[r, g, b]
    .map((x) => Math.max(0, Math.min(255, x | 0)).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** PNG overlay on the map (legacy persisted key `fogPng`). */
function getRowOverlayPng(row) {
  if (!row || typeof row !== 'object') return null;
  return row.overlayPng ?? row.fogPng ?? null;
}
/** Padding around map token wrappers for easier drag grabs; visual token size unchanged. */
const MAP_TOKEN_HIT_PADDING_PX = 12;

/** Width in px of the character tokens shelf (left tray). Used by DiceRoller to offset the banner strip. */
export const CHARACTER_TRAY_WIDTH_PX = 36 + 16;

// Daggerheart range bands — Melee (≤5') through Very Far (≤300')
const RANGE_BANDS = [
  { name: 'Melee',      maxFt: 5,   fillColor: 'rgba(34,197,94,0.14)',  ringColor: 'rgba(34,197,94,0.6)',   tokenGlow: 'rgba(34,197,94,0.85)',  tokenRing: 'rgba(34,197,94,0.95)'   },
  { name: 'Very Close', maxFt: 10,  fillColor: 'rgba(56,189,248,0.11)', ringColor: 'rgba(56,189,248,0.5)',  tokenGlow: 'rgba(56,189,248,0.8)',  tokenRing: 'rgba(56,189,248,0.95)'  },
  { name: 'Close',      maxFt: 30,  fillColor: 'rgba(251,146,60,0.06)', ringColor: 'rgba(251,146,60,0.4)',  tokenGlow: 'rgba(251,146,60,0.7)',  tokenRing: 'rgba(251,146,60,0.95)'  },
  { name: 'Far',        maxFt: 100, fillColor: 'rgba(250,204,21,0.08)', ringColor: 'rgba(250,204,21,0.45)', tokenGlow: 'rgba(250,204,21,0.75)', tokenRing: 'rgba(250,204,21,0.95)'  },
  { name: 'Very Far',   maxFt: 300, fillColor: 'rgba(239,68,68,0.04)',  ringColor: 'rgba(239,68,68,0.30)',  tokenGlow: 'rgba(239,68,68,0.65)',  tokenRing: 'rgba(239,68,68,0.9)'    },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function tokenAbbrev(name) {
  if (!name) return '?';
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function isInsideRect(clientX, clientY, rect) {
  if (!rect) return false;
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

/** Red dot centered on click (3× the old 8px dot); label above the dot. Fades over `fadeMs`. */
function MapPingNameLabel({
  xFt,
  yFt,
  pxPerFt,
  displayName,
  pingId,
  onDismissMapPing,
  landDelayMs = MAP_PING_FIREWORK_LAND_MS,
  fadeMs = MAP_PING_LABEL_FADE_MS,
}) {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const landT = setTimeout(() => setLanded(true), landDelayMs);
    const dismissT = setTimeout(() => onDismissMapPing(pingId), landDelayMs + fadeMs);
    return () => {
      clearTimeout(landT);
      clearTimeout(dismissT);
    };
  }, [pingId, onDismissMapPing, landDelayMs, fadeMs]);

  const cx = xFt * pxPerFt;
  const cy = yFt * pxPerFt;

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)', zIndex: 42 }}
    >
      {landed && (
        <div
          className="relative h-6 w-6 dh-map-ping-marker-fade"
          style={{ animationDuration: `${fadeMs}ms` }}
        >
          <span
            className="absolute inset-0 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.95)] ring-2 ring-red-400/60"
            aria-hidden
          />
          <div className="absolute bottom-full left-1/2 z-10 mb-1 max-w-[15rem] -translate-x-1/2 truncate whitespace-nowrap px-1.5 py-0.5 rounded border border-dh-border bg-dh-raised/95 text-[11px] font-medium text-dh shadow-md">
            {displayName || '?'}
          </div>
        </div>
      )}
    </div>
  );
}

function pointInRect(clientX, clientY, el) {
  if (!el) return false;
  return isInsideRect(clientX, clientY, el.getBoundingClientRect());
}

/** Fixed thumb size for strip previews (matches w-[4.75rem] × aspect 4:3). */
const THUMB_STRIP_W_PX = 76;
const THUMB_STRIP_H_PX = (THUMB_STRIP_W_PX * 3) / 4;

function hasDecodableView(viewState) {
  if (!viewState || typeof viewState !== 'object') return false;
  if (isValidMapViewVisibleNorm(viewState.mapViewVisibleNorm)) return true;
  const r = viewState.mapViewZoomRatio;
  const pan = viewState.mapViewPanNorm;
  const hasRatio = r != null && Number.isFinite(r);
  const hasPan =
    pan != null &&
    typeof pan === 'object' &&
    Number.isFinite(pan.x) &&
    Number.isFinite(pan.y);
  return hasRatio || hasPan;
}

function copyMapViewState(viewState) {
  if (!viewState || typeof viewState !== 'object') return null;
  return {
    mapViewZoomRatio: viewState.mapViewZoomRatio ?? null,
    mapViewPanNorm: viewState.mapViewPanNorm ?? null,
    mapViewVisibleNorm: viewState.mapViewVisibleNorm ?? null,
  };
}

/**
 * Same scroll/zoom model as the main map viewport, scaled to a small tile (decodeMapViewState + bounds).
 */
function computeThumbViewRender(mapRow, viewState, viewportW, viewportH) {
  const mc = {
    mapSizeFt: mapRow?.mapSizeFt ?? 100,
    mapDimension: mapRow?.mapDimension ?? 'width',
    mapImageNaturalWidth: mapRow?.mapImageNaturalWidth,
    mapImageNaturalHeight: mapRow?.mapImageNaturalHeight,
  };
  const { mapWidthFt, mapHeightFt } = getMapDimensions(mc);
  const pxPerFt = Math.max(viewportW / mapWidthFt, MIN_PX_PER_FT);
  const renderedWidthPx = Math.round(mapWidthFt * pxPerFt);
  const renderedHeightPx = Math.round(mapHeightFt * pxPerFt);
  const tokenSizePx = Math.max(33, Math.round(5 * pxPerFt));
  const { minZoom, maxZoom } = computeMapZoomBounds({
    containerW: viewportW,
    containerH: viewportH,
    renderedWidthPx,
    renderedHeightPx,
    tokenSizePx,
  });
  const decodeCtx = {
    minZoom,
    maxZoom,
    renderedWidthPx,
    renderedHeightPx,
    viewportW,
    viewportH,
  };
  const stored = hasDecodableView(viewState) ? viewState : null;
  const dec = stored ? decodeMapViewState(stored, decodeCtx) : null;
  const mapZoom = dec?.mapZoom ?? minZoom;
  const scrollLeft = dec?.scrollLeft ?? 0;
  const scrollTop = dec?.scrollTop ?? 0;
  return {
    renderedWidthPx,
    renderedHeightPx,
    mapZoom,
    scrollLeft,
    scrollTop,
    letterboxClipPx: dec?.letterboxClipPx ?? null,
  };
}

const MAX_THUMB_TOKEN_PROXIES = 8;

/**
 * Characters + adversaries whose token footprint intersects the strip thumbnail viewport (same math as the thumb preview).
 */
function getThumbViewportTokenProxies(mapRow, viewState, activeElements, stripMapId) {
  if (!mapConfigHasImage({ mapImageUrl: mapRow?.mapImageUrl }) || stripMapId == null) return [];
  const vw = THUMB_STRIP_W_PX;
  const vh = THUMB_STRIP_H_PX;
  const mc = {
    mapSizeFt: mapRow?.mapSizeFt ?? 100,
    mapDimension: mapRow?.mapDimension ?? 'width',
    mapImageNaturalWidth: mapRow?.mapImageNaturalWidth,
    mapImageNaturalHeight: mapRow?.mapImageNaturalHeight,
  };
  const { mapWidthFt, mapHeightFt } = getMapDimensions(mc);
  const pxPerFt = Math.max(vw / mapWidthFt, MIN_PX_PER_FT);
  const tokenSizePx = Math.max(33, Math.round(5 * pxPerFt));
  const { mapZoom, scrollLeft, scrollTop } = computeThumbViewRender(mapRow, viewState, vw, vh);

  const visL = scrollLeft;
  const visT = scrollTop;
  const visR = scrollLeft + vw;
  const visB = scrollTop + vh;

  const out = [];
  for (const el of activeElements || []) {
    if (el.elementType !== 'character' && el.elementType !== 'adversary' && el.elementType !== 'boardToken') {
      continue;
    }
    if (el.tokenX == null || el.tokenY == null) continue;
    if (effectiveTokenMapId(el.mapId) !== stripMapId) continue;

    const innerL = el.tokenX * pxPerFt;
    const innerT = el.tokenY * pxPerFt;
    const innerR = innerL + tokenSizePx;
    const innerB = innerT + tokenSizePx;
    const sL = innerL * mapZoom;
    const sT = innerT * mapZoom;
    const sR = innerR * mapZoom;
    const sB = innerB * mapZoom;
    if (sR < visL || sL > visR || sB < visT || sT > visB) continue;

    const isAdv = el.elementType === 'adversary';
    const isBoard = el.elementType === 'boardToken';
    const defeated = isAdv && isAdversaryDefeated(el);
    out.push({
      key: el.instanceId,
      abbrev: tokenAbbrev(isBoard ? (el.label || el.name) : el.name),
      name: isBoard ? (el.label || el.name || '') : el.name || '',
      kind: isBoard ? 'board' : isAdv ? 'adversary' : 'character',
      defeated,
    });
  }

  out.sort((a, b) => {
    const rank = (k) => (k === 'character' ? 0 : k === 'board' ? 1 : 2);
    if (a.kind !== b.kind) return rank(a.kind) - rank(b.kind);
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
  return out;
}

/** Legible stacked token chips over the map thumb (not positioned like on-map tokens). */
function ThumbViewportTokenProxies({ tokens }) {
  if (!tokens?.length) return null;
  const shown = tokens.slice(0, MAX_THUMB_TOKEN_PROXIES);
  const rest = tokens.length - shown.length;
  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[4] flex max-h-[52%] flex-wrap content-end justify-center gap-0.5 overflow-hidden px-0.5 pb-0.5 pt-4 pointer-events-none bg-gradient-to-t from-black/55 to-transparent"
      aria-hidden
    >
      {shown.map((t) => (
        <div
          key={t.key}
          title={t.name || undefined}
          className={`flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full border border-black/70 px-0.5 text-[7px] font-bold leading-none text-white shadow-sm ${
            t.kind === 'character'
              ? 'bg-sky-700'
              : t.kind === 'board'
                ? 'bg-emerald-800'
                : t.defeated
                  ? 'bg-black'
                  : 'bg-amber-800'
          }`}
        >
          {t.abbrev}
        </div>
      ))}
      {rest > 0 ? (
        <div className="flex h-3.5 shrink-0 items-center rounded-full border border-dh-border/90 bg-dh-raised/95 px-1 text-[7px] font-semibold leading-none text-dh-muted">
          +{rest}
        </div>
      ) : null}
    </div>
  );
}

function MapViewThumbInterior({ mapRow, viewState, mapOverlayPng, cameraOverlayPng }) {
  const hasArt = mapConfigHasImage({ mapImageUrl: mapRow?.mapImageUrl });
  const { renderedWidthPx, renderedHeightPx, mapZoom, scrollLeft, scrollTop, letterboxClipPx } = useMemo(
    () => computeThumbViewRender(mapRow, viewState, THUMB_STRIP_W_PX, THUMB_STRIP_H_PX),
    [mapRow, viewState],
  );

  if (!hasArt) {
    return (
      <div
        className="relative flex w-full items-center justify-center overflow-hidden bg-dh-canvas/40 text-dh-muted"
        style={{
          width: THUMB_STRIP_W_PX,
          height: THUMB_STRIP_H_PX,
          ...(cameraOverlayPng
            ? {
                backgroundImage: `url(${cameraOverlayPng})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}),
        }}
      >
        {cameraOverlayPng ? (
          <div className="absolute inset-0 bg-dh-canvas/55" aria-hidden />
        ) : null}
        <MapIcon size={18} strokeWidth={1.5} className="relative z-[1]" aria-hidden />
      </div>
    );
  }

  const clipStyle =
    letterboxClipPx &&
    (letterboxClipPx.top > 0 ||
      letterboxClipPx.right > 0 ||
      letterboxClipPx.bottom > 0 ||
      letterboxClipPx.left > 0)
      ? {
          clipPath: `inset(${letterboxClipPx.top}px ${letterboxClipPx.right}px ${letterboxClipPx.bottom}px ${letterboxClipPx.left}px)`,
        }
      : undefined;

  return (
    <div className="relative overflow-hidden bg-dh-canvas/40" style={{ width: THUMB_STRIP_W_PX, height: THUMB_STRIP_H_PX }}>
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{ width: THUMB_STRIP_W_PX, height: THUMB_STRIP_H_PX, ...clipStyle }}
      >
        <div
          className="relative shrink-0 will-change-transform"
          style={{
            transform: `translate(${-scrollLeft}px, ${-scrollTop}px)`,
            width: renderedWidthPx * mapZoom,
            height: renderedHeightPx * mapZoom,
          }}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: renderedWidthPx,
              height: renderedHeightPx,
              transform: `scale(${mapZoom})`,
            }}
          >
            <img
              src={mapRow.mapImageUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 z-0 h-full w-full select-none object-fill pointer-events-none"
            />
            {mapOverlayPng ? (
              <img
                src={mapOverlayPng}
                alt=""
                draggable={false}
                className="absolute inset-0 z-[1] h-full w-full object-fill pointer-events-none opacity-95"
              />
            ) : null}
            {cameraOverlayPng ? (
              <img
                src={cameraOverlayPng}
                alt=""
                draggable={false}
                className="absolute inset-0 z-[2] h-full w-full object-fill pointer-events-none opacity-95"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Thumbnail tile for the maps + saved views strip (map switch or apply saved zoom/pan). */
const mapViewStripTilePropsAreEqual = (prev, next) => {
  if (
    prev.mapRow !== next.mapRow ||
    prev.viewState !== next.viewState ||
    prev.mapOverlayPng !== next.mapOverlayPng ||
    prev.cameraOverlayPng !== next.cameraOverlayPng ||
    prev.label !== next.label ||
    prev.isActive !== next.isActive ||
    prev.broadcastHighlight !== next.broadcastHighlight ||
    prev.onClick !== next.onClick ||
    prev.onDoubleClick !== next.onDoubleClick ||
    prev.variant !== next.variant ||
    prev.actions !== next.actions ||
    prev.interactive !== next.interactive ||
    prev.showMapBadge !== next.showMapBadge ||
    prev.showCameraBadge !== next.showCameraBadge ||
    prev.hideCaption !== next.hideCaption ||
    prev.captionAbove !== next.captionAbove ||
    prev.tooltipTitle !== next.tooltipTitle ||
    prev.stripMapId !== next.stripMapId
  ) {
    return false;
  }
  // `activeElements` gets a new identity on every SSE tick; compare a per-map token signature
  // instead so unrelated ops (other map, adversary-only change on a different tile, etc.) don't
  // force this tile to re-render and re-scan `activeElements` in `getThumbViewportTokenProxies`.
  if (prev.activeElements === next.activeElements) return true;
  return (
    buildMapStripTileTokenSignature(prev.activeElements, prev.stripMapId) ===
    buildMapStripTileTokenSignature(next.activeElements, next.stripMapId)
  );
};

/**
 * Memoized so the (up to ~6, 2 maps x 2 views) map/view strip tiles don't all re-render and
 * re-scan `activeElements` on every SSE tick when nothing relevant to a given tile changed.
 */
const MapViewStripTile = memo(function MapViewStripTileRaw({
  mapRow,
  viewState,
  /** Draw-layer PNG (data URL) aligned to the map image; shown under camera overlay in the thumb. */
  mapOverlayPng,
  /** Named-view draw PNG; overlaid on map layer in the thumb. */
  cameraOverlayPng,
  label,
  isActive,
  /** GM only: sky tint when this tile is “on air” (shared map / broadcast view); overridden when `isActive` (amber). */
  broadcastHighlight = false,
  onClick,
  onDoubleClick,
  variant = 'map',
  actions,
  interactive = true,
  /** Full-map strip tiles: small map icon (bottom-right, same corner as camera on view tiles). */
  showMapBadge = false,
  /** Named views: small camera icon (bottom-right). */
  showCameraBadge = false,
  /** Hide the caption (rare; most tiles show `label`). */
  hideCaption = false,
  /** When true, label is above the thumbnail (view/camera tiles); map tiles keep label below. */
  captionAbove = false,
  /** Optional `title` on the thumb control (defaults to `label`). */
  tooltipTitle,
  /** When set with `stripMapId`, shows small token chips for actors visible in this thumb's viewport. */
  activeElements,
  stripMapId,
}) {
  const titleAttr = tooltipTitle !== undefined ? tooltipTitle : label;
  const thumbTokenProxies = useMemo(
    () => getThumbViewportTokenProxies(mapRow, viewState, activeElements, stripMapId),
    [mapRow, viewState, activeElements, stripMapId],
  );
  const thumbClass = `group relative overflow-hidden rounded-md border text-left transition-colors ${
    variant === 'map' && isActive
      ? 'border-amber-500/55 bg-amber-950/35 ring-1 ring-amber-500/40'
      : variant === 'map' && broadcastHighlight
        ? interactive
          ? 'border-sky-400/50 bg-sky-950/30 ring-1 ring-sky-400/40 hover:bg-sky-950/45'
          : 'border-sky-400/50 bg-sky-950/30 ring-1 ring-sky-400/40 cursor-default'
        : interactive
          ? 'border-dh-strong bg-dh-canvas/25 hover:bg-dh-hover/70'
          : 'border-dh-border/50 bg-dh-canvas/25 cursor-default'
  }`;

  const thumbInner = (
    <div className="relative">
      <MapViewThumbInterior
        mapRow={mapRow}
        viewState={viewState}
        mapOverlayPng={mapOverlayPng}
        cameraOverlayPng={cameraOverlayPng}
      />
      <ThumbViewportTokenProxies tokens={thumbTokenProxies} />
      {showMapBadge ? (
        <div className="absolute bottom-0.5 right-0.5 z-[5] rounded border border-dh-border/80 bg-dh-raised/95 p-0.5 shadow-sm">
          <MapIcon size={10} className="text-white/90" aria-hidden />
        </div>
      ) : null}
      {showCameraBadge ? (
        <div className="absolute bottom-0.5 right-0.5 z-[5] rounded border border-dh-border/80 bg-dh-raised/95 p-0.5 shadow-sm">
          <Camera size={10} className="text-white/90" aria-hidden />
        </div>
      ) : null}
    </div>
  );

  const captionSpan = !hideCaption ? (
    <span
      className={`block truncate text-center text-[10px] leading-tight ${
        isActive ? 'font-medium text-dh' : broadcastHighlight ? 'font-medium text-sky-400' : 'text-dh-muted'
      }`}
      title={label}
    >
      {label}
    </span>
  ) : null;

  return (
    <div className="flex w-[4.75rem] shrink-0 flex-col gap-0.5">
      {captionAbove && captionSpan ? (
        <div className="min-h-[1rem] flex items-end justify-center px-0.5">{captionSpan}</div>
      ) : null}
      {interactive ? (
        <button
          type="button"
          role={variant === 'map' ? 'tab' : undefined}
          aria-selected={variant === 'map' ? isActive : undefined}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          className={thumbClass}
          title={titleAttr}
        >
          {thumbInner}
        </button>
      ) : (
        <div className={thumbClass} title={titleAttr}>
          {thumbInner}
        </div>
      )}
      {!captionAbove && (!hideCaption || actions) ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          {!hideCaption ? captionSpan : null}
          {actions}
        </div>
      ) : captionAbove && actions ? (
        <div className="flex min-w-0 flex-col gap-0.5">{actions}</div>
      ) : null}
    </div>
  );
}, mapViewStripTilePropsAreEqual);

// ─── TokenDotRing ─────────────────────────────────────────────────────────────

/**
 * Renders colored dot indicators around a token's border.
 * groups: [{ color, total, filled }] — empty groups already filtered out.
 * Each group's center is equally spaced around the ring (clockwise from 12 o'clock).
 * Within a group, filled dots come first, then empty (outline) dots.
 */
function TokenDotRing({ size, groups }) {
  const numGroups = groups.length;
  if (numGroups === 0) return null;
  const totalDots = groups.reduce((s, g) => s + g.total, 0);
  if (totalDots === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const rr = Math.max(1, size / 2 - 1);

  const preferredDr = Math.max(2, Math.round(size * 0.09));
  // Max dr where the gap between groups fits one empty dot slot (2×dotSpacing center-to-center):
  // totalArc = (totalDots−numGroups)·ds + numGroups·2·ds = (totalDots+numGroups)·ds = 2π
  // ds = (2dr+1)/rr → dr = (2π·rr/(totalDots+numGroups) − 1) / 2
  const maxDr = (2 * Math.PI * rr / (totalDots + numGroups) - 1) / 2;
  const dr = Math.max(1, Math.min(preferredDr, maxDr));

  const dotSpacing = (2 * dr + 1) / rr;
  const groupWidths = groups.map(g => Math.max(0, g.total - 1) * dotSpacing);
  const totalGroupArc = groupWidths.reduce((s, w) => s + w, 0);
  const gap = (2 * Math.PI - totalGroupArc) / numGroups;

  const dots = [];
  let cursor = -Math.PI / 2 - groupWidths[0] / 2;
  groups.forEach((group, gi) => {
    for (let i = 0; i < group.total; i++) {
      const angle = cursor + i * dotSpacing;
      const x = cx + rr * Math.cos(angle);
      const y = cy + rr * Math.sin(angle);
      const isFilled = i < group.filled;
      dots.push({ x, y, color: group.color, filled: isFilled, key: `${gi}-${i}` });
    }
    cursor += groupWidths[gi] + gap;
  });

  const filledSw = Math.min(0.5, dr * 0.3);
  const emptySw = Math.min(1, dr * 0.5);

  return (
    <svg
      className="absolute pointer-events-none"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: 'visible', top: -2, left: -2 }}
    >
      {dots.map(d => (
        <circle
          key={d.key}
          cx={d.x}
          cy={d.y}
          r={dr}
          fill={d.filled ? d.color : 'rgba(15,15,20,0.85)'}
          stroke={d.color}
          strokeWidth={d.filled ? filledSw : emptySw}
          opacity={d.filled ? 1 : 0.55}
        />
      ))}
    </svg>
  );
}

// ─── MapConfigToolbar ────────────────────────────────────────────────────────

function MapConfigToolbar({
  mapConfig,
  onMapConfigChange,
  isUploading,
  onFileSelect,
  tableName = '',
  tableStateReady = false,
  onTableNameChange,
  onDeleteTable,
  onMapAiGenerationPreviewChange,
  showImageGenAiUi = false,
  aiMapOpen,
  setAiMapOpen,
}) {
  const {
    mapDimension = 'width',
    mapSizeFt = 100,
    mapImageUrl,
    mapImageNaturalWidth,
    mapImageNaturalHeight,
    mapAiImagePrompt,
  } = mapConfig ?? {};
  const [sizeInput, setSizeInput] = useState(String(mapSizeFt));
  const fileInputRef = useRef(null);
  const isNewTable = tableName === '' || tableName === 'New Table';
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(tableName || 'New Table');
  const nameInputRef = useRef(null);

  // Sync external changes (e.g. from SSE)
  useEffect(() => { setSizeInput(String(mapSizeFt)); }, [mapSizeFt]);
  useEffect(() => { setNameInput(tableName || 'New Table'); }, [tableName]);

  // Only open name editor when table state has loaded and name is empty or default
  useEffect(() => {
    if (tableStateReady) setIsEditingName(isNewTable);
  }, [tableStateReady, isNewTable]);

  // On new table, focus name input when editor is open
  useEffect(() => {
    if (!isNewTable || !isEditingName) return;
    const el = nameInputRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isNewTable, isEditingName]);

  const commitName = () => {
    const trimmed = (nameInput || '').trim() || 'New Table';
    setNameInput(trimmed);
    if (onTableNameChange && trimmed !== tableName) onTableNameChange(trimmed);
    setIsEditingName(false);
  };

  const commitSize = () => {
    const v = Math.max(MAP_SIZE_FT_MIN, Math.min(MAP_SIZE_FT_MAX, parseInt(sizeInput, 10) || 100));
    setSizeInput(String(v));
    if (v !== mapSizeFt) {
      const { mapWidthFt: oldW } = getMapDimensions(mapConfig);
      const newConfig = { ...mapConfig, mapSizeFt: v };
      const { mapWidthFt: newW } = getMapDimensions(newConfig);
      const scale = oldW > 0 ? newW / oldW : 1;
      onMapConfigChange({ mapSizeFt: v }, false, scale);
    }
  };

  const wxh = (() => {
    const { mapWidthFt, mapHeightFt } = getMapDimensions(mapConfig);
    return `${Math.round(mapWidthFt)}' × ${Math.round(mapHeightFt)}'`;
  })();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-dh-surface border-b border-dh-border text-xs shrink-0 flex-wrap">
      {/* Table name + Delete table button — left */}
      <div className="flex items-center gap-2">
        {onTableNameChange ? (
          isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitName(); } }}
              className="min-w-[120px] max-w-[240px] px-2 py-1 rounded bg-dh-raised border border-dh-strong text-dh font-semibold text-sm focus:outline-none focus:border-sky-500"
              placeholder="Table name"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-dh-hover/80 text-dh font-semibold text-sm transition-colors"
              title="Edit table name"
            >
              <span className="truncate max-w-[200px]">{tableName || 'Untitled'}</span>
              <Pencil size={12} className="shrink-0 text-dh-muted" />
            </button>
          )
        ) : (
          <span className="px-2 py-1 text-dh font-semibold text-sm truncate max-w-[200px]">{tableName || 'Untitled'}</span>
        )}
        {onDeleteTable && (
          <button
            type="button"
            onClick={onDeleteTable}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-dh-muted hover:text-red-400 hover:bg-dh-raised/80 transition-colors"
            title="Delete table"
          >
            <Trash2 size={12} />
            <span>Delete table</span>
          </button>
        )}
      </div>

      {/* Everything else — right */}
      <div className="flex items-center gap-2 ml-auto">
        <div className="w-px h-4 bg-dh-hover" />

        {!isUploading ? (
          <span className="text-[10px] text-dh-muted/45 select-none whitespace-nowrap">Paste, drop, or</span>
        ) : null}

        <label
          className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors ${
            isUploading
              ? 'bg-dh-hover text-dh-muted cursor-not-allowed'
              : 'bg-dh-hover hover:bg-dh-hover text-dh hover:opacity-90'
          }`}
          title="Upload or replace map image"
        >
          <Upload size={12} />
          {isUploading ? 'Uploading…' : mapImageUrl ? 'Replace Map' : 'Upload Map Image'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) { onFileSelect(f); e.target.value = ''; } }}
          />
        </label>

        {showImageGenAiUi ? (
          <>
            <button
              type="button"
              onClick={() => setAiMapOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-purple-800/50 hover:border-purple-600 text-purple-300 hover:text-purple-100 bg-purple-950/30 hover:bg-purple-900/40 transition-colors"
              title="Generate map image with AI (x.ai)"
            >
              <Sparkles size={12} />
              Generate with AI
            </button>
            <MapAiImageDialog
              open={aiMapOpen}
              onClose={() => setAiMapOpen(false)}
              mapSizeFt={mapSizeFt}
              mapDimension={mapDimension}
              mapImageNaturalWidth={mapImageNaturalWidth}
              mapImageNaturalHeight={mapImageNaturalHeight}
              mapImageUrl={mapImageUrl}
              savedMapAiImagePrompt={mapAiImagePrompt}
              onMapConfigChange={onMapConfigChange}
              onGenerationPreviewChange={onMapAiGenerationPreviewChange}
            />
          </>
        ) : null}

        {mapImageUrl && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded bg-dh-hover hover:bg-red-900 text-dh-muted hover:text-red-300 transition-colors"
            title="Remove map image"
            onClick={() =>
              onMapConfigChange(
                { mapImageUrl: null, mapImageNaturalWidth: null, mapImageNaturalHeight: null, mapAiImagePrompt: null },
                true,
              )
            }
          >
            <X size={11} /> Remove
          </button>
        )}

        <div className="w-px h-4 bg-dh-hover" />

        <span className="text-dh-muted">Size:</span>
        <div className="flex items-center gap-1">
          <button
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${mapDimension === 'width' ? 'bg-sky-700 text-white' : 'bg-dh-hover text-dh-muted hover:text-white'}`}
            onClick={() => onMapConfigChange({ mapDimension: 'width' })}
          >W</button>
          <button
            className={`px-1.5 py-0.5 rounded text-xs transition-colors ${mapDimension === 'height' ? 'bg-sky-700 text-white' : 'bg-dh-hover text-dh-muted hover:text-white'}`}
            onClick={() => onMapConfigChange({ mapDimension: 'height' })}
          >H</button>
        </div>
        <input
          type="number"
          min={MAP_SIZE_FT_MIN}
          max={MAP_SIZE_FT_MAX}
          value={sizeInput}
          onChange={e => setSizeInput(e.target.value)}
          onBlur={commitSize}
          onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } }}
          className="w-14 px-1.5 py-0.5 rounded bg-dh-hover border border-dh-strong text-dh text-xs text-right focus:outline-none focus:border-sky-500"
        />
        <span className="text-dh-muted">ft</span>

        <span className="text-dh-muted italic">{wxh}</span>
      </div>
    </div>
  );
}

// ─── TokenCircle ─────────────────────────────────────────────────────────────

function TokenCircle({
  element,
  size,
  instanceNum,
  isMyCharacter,
  isPlayer,
  isDragging,
  isGhost,
  isPinned,
  isProxy,
  isOtherMapShelf,
  rangeBand,
  rangeBandGlowScale,
}) {
  const isChar = element.elementType === 'character';
  const isAdv = element.elementType === 'adversary';
  const isBoard = element.elementType === 'boardToken';

  const label = tokenAbbrev(
    isBoard ? (element.label != null ? String(element.label) : element.name) : element.name,
  );
  const instLabel = isAdv && instanceNum != null ? `#${instanceNum}` : null;

  // Build dot groups for border ring indicator. Skipped for dim tray proxies (`isProxy`) — the GM
  // already sees live HP/Stress/Armor pips on the actual placed token, so building + rendering a
  // second full `TokenDotRing` per proxy (up to ~15 adversaries when most are on-map) is wasted work.
  const dotGroups = [];
  if (!isProxy) {
    if (isBoard) {
      // Stress lives on the parent character sheet — ring optional later
    } else if (isChar) {
      const hpMax = element.maxHp || 0;
      const hpDamage = Math.max(0, hpMax - (element.currentHp ?? hpMax));
      if (hpMax > 0) dotGroups.push({ color: '#ef4444', total: hpMax, filled: hpDamage });

      const stressMax = element.maxStress || 0;
      const stressMarked = Math.max(0, element.currentStress || 0);
      if (stressMax > 0) dotGroups.push({ color: '#f97316', total: stressMax, filled: Math.min(stressMarked, stressMax) });

      const armorMax = element.maxArmor || 0;
      const armorMarked = Math.max(0, element.currentArmor || 0);
      if (armorMax > 0) dotGroups.push({ color: '#06b6d4', total: armorMax, filled: Math.min(armorMarked, armorMax) });
    } else if (isAdv) {
      const hpMax = element.hp_max || 0;
      const hpDamage = Math.max(0, hpMax - (element.currentHp ?? hpMax));
      const stressMax = element.stress_max || 0;
      const stressMarked = Math.max(0, element.currentStress || 0);
      if (isPlayer) {
        // Players see only filled (damage taken) dots — hides total pool
        if (hpDamage > 0) dotGroups.push({ color: '#ef4444', total: hpDamage, filled: hpDamage });
        if (stressMarked > 0) dotGroups.push({ color: '#f97316', total: stressMarked, filled: stressMarked });
      } else {
        if (hpMax > 0) dotGroups.push({ color: '#ef4444', total: hpMax, filled: hpDamage });
        if (stressMax > 0) dotGroups.push({ color: '#f97316', total: stressMax, filled: Math.min(stressMarked, stressMax) });
      }
    }
  }

  // Range-band decoration: solid ring + intense outer glow (scale widens ring and blur, e.g. 3 for drag ghost)
  const glowScale = rangeBandGlowScale ?? 1;
  const glowStyle = rangeBand
    ? { boxShadow: `0 0 0 ${3 * glowScale}px ${rangeBand.tokenRing}, 0 0 ${18 * glowScale}px ${6 * glowScale}px ${rangeBand.tokenGlow}` }
    : {};

  const advDefeated = isAdv && isAdversaryDefeated(element);
  const bgClass = isBoard
    ? 'bg-emerald-900 ring-2 ring-emerald-400/90'
    : isChar
      ? (isMyCharacter ? 'bg-green-700' : 'bg-sky-700')
      : (advDefeated ? 'bg-black' : 'bg-amber-800');

  return (
    <div
      className={`
        relative rounded-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing
        border-2 border-black transition-opacity
        ${bgClass}
        ${isDragging ? 'opacity-30' : ''}
        ${isGhost ? 'opacity-90 pointer-events-none' : ''}
        ${isProxy ? (isOtherMapShelf ? 'opacity-[0.38]' : 'opacity-20') : ''}
        ${isPinned ? 'ring-2 ring-white ring-offset-1 ring-offset-dh-surface' : ''}
      `}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        userSelect: 'none',
        ...glowStyle,
      }}
      title={isBoard ? (element.label || element.name || 'Token') : element.name}
    >
      {!isProxy && <TokenDotRing size={size} groups={dotGroups} />}
      <div className="relative z-10 flex flex-col items-center justify-center leading-none pointer-events-none">
        <span
          className="text-white font-bold leading-none"
          style={{ fontSize: Math.max(10, Math.round(size * (instLabel ? 0.3 : 0.35))) }}
        >
          {label}
        </span>
        {instLabel && (
          <span
            className="text-white/90 font-bold tabular-nums mt-0.5"
            style={{ fontSize: Math.max(7, Math.round(size * 0.2)) }}
          >
            {instLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Shared "did anything the token actually renders change" check for `PlacedToken` / `TrayToken`.
 * `activeElements` gets new object identities on every SSE `table_state` snapshot even when a given
 * element's own fields are unchanged, so we compare specific mutable fields instead of relying on
 * reference equality — this is what lets unrelated tokens skip re-rendering on unrelated updates.
 */
function tokenElementFieldsEqual(pE, nE) {
  if (pE === nE) return true;
  if (!pE || !nE) return false;
  return (
    pE.instanceId === nE.instanceId &&
    pE.tokenX === nE.tokenX &&
    pE.tokenY === nE.tokenY &&
    pE.elementType === nE.elementType &&
    pE.name === nE.name &&
    pE.label === nE.label &&
    pE.currentHp === nE.currentHp &&
    pE.maxHp === nE.maxHp &&
    pE.hp_max === nE.hp_max &&
    pE.currentStress === nE.currentStress &&
    pE.maxStress === nE.maxStress &&
    pE.stress_max === nE.stress_max &&
    pE.currentArmor === nE.currentArmor &&
    pE.maxArmor === nE.maxArmor
  );
}

const placedTokenPropsAreEqual = (prev, next) => {
  if (
    prev.zIndex !== next.zIndex ||
    prev.pxPerFt !== next.pxPerFt ||
    prev.tokenSizePx !== next.tokenSizePx ||
    prev.isMyCharacter !== next.isMyCharacter ||
    prev.isPlayer !== next.isPlayer ||
    prev.isDragging !== next.isDragging ||
    prev.isPinned !== next.isPinned ||
    prev.instanceNum !== next.instanceNum ||
    prev.rangeBand !== next.rangeBand ||
    prev.onPointerDown !== next.onPointerDown ||
    prev.onPointerMove !== next.onPointerMove ||
    prev.onPointerUp !== next.onPointerUp
  ) {
    return false;
  }
  return tokenElementFieldsEqual(prev.element, next.element);
};

/**
 * Memoized wrapper for a token placed on the map. During map pan/zoom the parent `BattleMap` only
 * re-renders to translate/scale the shared canvas layer — none of these props change, so React
 * bails out of diffing/rendering every placed token's subtree entirely.
 */
const PlacedToken = memo(function PlacedTokenRaw({
  element,
  isMyCharacter,
  isPlayer,
  isDragging,
  isPinned,
  instanceNum = null,
  rangeBand,
  zIndex,
  pxPerFt,
  tokenSizePx,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  const p = MAP_TOKEN_HIT_PADDING_PX;
  return (
    <div
      className="absolute"
      style={{
        left: element.tokenX * pxPerFt - p,
        top: element.tokenY * pxPerFt - p,
        padding: p,
        width: tokenSizePx + 2 * p,
        height: tokenSizePx + 2 * p,
        boxSizing: 'border-box',
        touchAction: 'none',
        zIndex,
      }}
      onPointerDown={(e) => onPointerDown(e, element, false)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <TokenCircle
        element={element}
        size={tokenSizePx}
        instanceNum={instanceNum}
        isMyCharacter={isMyCharacter}
        isPlayer={isPlayer}
        isDragging={isDragging}
        isPinned={isPinned}
        rangeBand={rangeBand}
      />
    </div>
  );
}, placedTokenPropsAreEqual);

const trayTokenPropsAreEqual = (prev, next) => {
  if (
    prev.tokenSizePx !== next.tokenSizePx ||
    prev.instanceNum !== next.instanceNum ||
    prev.isMyCharacter !== next.isMyCharacter ||
    prev.isDragging !== next.isDragging ||
    prev.isPinned !== next.isPinned ||
    prev.isProxy !== next.isProxy ||
    prev.isOtherMapShelf !== next.isOtherMapShelf ||
    prev.onPointerDown !== next.onPointerDown ||
    prev.onPointerMove !== next.onPointerMove ||
    prev.onPointerUp !== next.onPointerUp
  ) {
    return false;
  }
  return tokenElementFieldsEqual(prev.element, next.element);
};

/** Memoized wrapper for a token sitting in the left/right trays (see `PlacedToken`). */
const TrayToken = memo(function TrayTokenRaw({
  element,
  instanceNum,
  isMyCharacter,
  isProxy,
  isOtherMapShelf,
  isDragging,
  isPinned,
  tokenSizePx,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  return (
    <div
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => onPointerDown(e, element, true)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <TokenCircle
        element={element}
        size={tokenSizePx}
        instanceNum={instanceNum}
        isMyCharacter={isMyCharacter}
        isDragging={isDragging}
        isPinned={isPinned}
        isProxy={isProxy}
        isOtherMapShelf={isOtherMapShelf}
      />
    </div>
  );
}, trayTokenPropsAreEqual);

// ─── TokenDetailPanel ────────────────────────────────────────────────────────

function TokenDetailPanel({
  element,
  isPlayer,
  isMyCharacter,
  updateActiveElement,
  queueManualTrackEdit,
  pendingBanners,
  pendingResourceCosts = {},
  lifeSupportSelections = {},
  onRemoveFromMap,
  onClose,
  anchorX,
  anchorY,
  tableId,
  /** Adversary pin: Encounter-panel-style marked stats + party target aid (replaces HP/Stress checkbox tracks). */
  adversaryTargetAid = null,
  adversaryPinInstanceNum = null,
}) {
  const isAdv = element.elementType === 'adversary';
  const isBoard = element.elementType === 'boardToken';
  const canEdit = !isPlayer || isMyCharacter;
  const canEditAdv = !isPlayer; // only GM edits adversaries
  const applyResource = (upd) => {
    if (isBoard) return;
    void (async () => {
      if (queueManualTrackEdit && tableId) {
        for (const r of pendingBanners || []) {
          if (r._manualTrackEdit && r._targetInstanceId === element.instanceId && r._rollDbId != null) {
            await postBannerAck(r._rollDbId, 'cancel', { tableId }).catch(() => {});
          }
        }
      }
      updateActiveElement(element.instanceId, upd);
    })();
  };

  if (isBoard) {
    return (
      <AnchoredFloatingPanel anchorX={anchorX} anchorY={anchorY} onEscape={onClose}>
      <div
        className="bg-dh-raised border border-dh-strong rounded-lg shadow-2xl p-3 min-w-[160px] max-w-[220px]"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm truncate">
              {element.label || element.name || 'Companion'}
            </div>
            <div className="text-xs text-dh-muted">Companion token</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onRemoveFromMap && (
              <button
                type="button"
                onClick={onRemoveFromMap}
                className="p-1 rounded text-dh-muted hover:text-amber-400 transition-colors"
                title="Remove from map (return to tray)"
              >
                <ArrowLeftToLine size={13} />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded text-dh-muted hover:text-white transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      </div>
      </AnchoredFloatingPanel>
    );
  }

  const hpMax = element.hp_max;
  const stressMax = element.stress_max;
  const encounterStyleAdvPin = isAdv && adversaryTargetAid != null;

  return (
    <AnchoredFloatingPanel anchorX={anchorX} anchorY={anchorY} onEscape={onClose}>
    <div
      className={`bg-dh-raised border border-dh-strong rounded-lg shadow-2xl p-3 min-w-[180px] ${
        encounterStyleAdvPin ? 'max-w-[min(22rem,94vw)] max-h-[min(72vh,560px)] overflow-y-auto overflow-x-hidden' : 'max-w-[240px]'
      }`}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{element.name}</div>
          {isAdv && (
            <div className="text-xs text-dh-muted capitalize">{element.role || ''} {element.tier ? `T${element.tier}` : ''}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onRemoveFromMap && (
            <button
              onClick={onRemoveFromMap}
              className="p-1 rounded text-dh-muted hover:text-amber-400 transition-colors"
              title="Remove from map (return to tray)"
            >
              <ArrowLeftToLine size={13} />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded text-dh-muted hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {encounterStyleAdvPin ? (
        <>
          {(!isPlayer || playerEncounterInstanceRowVisible(element, element)) && (
            <div className="mb-2 space-y-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-dh-muted">Encounter</p>
              <EncounterAdversaryMarkedSummary
                audience={isPlayer ? 'player' : 'gm'}
                displayEl={element}
                inst={element}
                showInstanceNum={adversaryPinInstanceNum != null}
                instanceNum={adversaryPinInstanceNum}
              />
            </div>
          )}
          {adversaryTargetAid}
        </>
      ) : (
        <>
          {/* HP — filled = damage taken (matches sidebar & token dots) */}
          {hpMax > 0 && (
            <div className="mb-1.5">
              <div className="text-xs text-dh-muted mb-0.5">HP {element.currentHp ?? hpMax}/{hpMax}</div>
              <CheckboxTrack
                total={hpMax}
                filled={Math.max(0, hpMax - (element.currentHp ?? hpMax))}
                pendingFilled={0}
                pendingClearFilled={0}
                trackKind="hp"
                onSetFilled={canEditAdv ? (dmg) => applyResource({ currentHp: hpMax - dmg }) : undefined}
              />
            </div>
          )}

          {/* Stress */}
          {stressMax > 0 && (
            <div className="mb-1.5">
              <div className="text-xs text-dh-muted mb-0.5">Stress {element.currentStress ?? 0}/{stressMax}</div>
              <CheckboxTrack
                total={stressMax}
                filled={element.currentStress ?? 0}
                pendingFilled={pendingResourceCosts[element.instanceId]?.stress ?? 0}
                pendingClearFilled={0}
                trackKind="stress"
                onSetFilled={canEditAdv ? (v) => applyResource({ currentStress: v }) : undefined}
              />
            </div>
          )}

          {/* Conditions */}
          {(canEdit || canEditAdv) && (
            <div>
              <div className="text-xs text-dh-muted mb-0.5">Conditions</div>
              <ConditionsTextInput
                instanceId={element.instanceId}
                value={element.conditions ?? ''}
                onCommit={(v) => updateActiveElement(element.instanceId, { conditions: v })}
                placeholder="none"
                className="w-full px-1.5 py-0.5 rounded bg-dh-hover border border-dh-strong text-dh text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
          {/* Read-only conditions for player on enemy */}
          {isPlayer && isAdv && element.conditions && (
            <div>
              <div className="text-xs text-dh-muted mb-0.5">Conditions</div>
              <div className="text-xs text-dh">{element.conditions}</div>
            </div>
          )}
        </>
      )}
    </div>
    </AnchoredFloatingPanel>
  );
}

// ─── TrayColumn ──────────────────────────────────────────────────────────────

function TrayColumn({ tokens, side, isHighlighted, trayRef, tokenSizePx, dragRef, onPointerDown, onPointerMove, onPointerUp, pinnedInstanceId }) {
  if (tokens.length === 0) return null;

  const borderClass = side === 'left' ? 'border-r border-dh-border' : 'border-l border-dh-border';

  return (
    <div
      ref={trayRef}
      className={`flex flex-col items-center gap-2 py-3 px-1.5 shrink-0 overflow-y-auto
        transition-colors duration-150 ${borderClass}
        ${isHighlighted ? 'bg-amber-900/30' : 'bg-dh-surface/60'}`}
      style={{ width: tokenSizePx + 16, minHeight: 0 }}
    >
      {tokens.map(({ element, instanceNum, isMyCharacter, isProxy, isOtherMapShelf }) => (
        <TrayToken
          key={element.instanceId}
          element={element}
          instanceNum={instanceNum}
          isMyCharacter={isMyCharacter}
          isProxy={isProxy}
          isOtherMapShelf={isOtherMapShelf}
          isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
          isPinned={pinnedInstanceId === element.instanceId}
          tokenSizePx={tokenSizePx}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      ))}
    </div>
  );
}

// ─── BattleMap ───────────────────────────────────────────────────────────────

export function BattleMap({
  gmUid,
  user,
  isPlayer = false,
  activeElements = [],
  updateActiveElement,
  mapConfig,
  onMapConfigChange,
  /** GM only: debounced persist of normalized zoom/pan (`set-map-view`) */
  onMapViewSync,
  tableName = '',
  tableStateReady = false,
  onTableNameChange,
  onDeleteTable,
  onClearDice,
  diceCanvasHidden = false,
  onToggleDiceVisibility,
  /** GM: pending dice/action banners count; used for Cancel all + to keep tray controls visible when only banners remain */
  pendingBannerCount = 0,
  onCancelAllBanners,
  className = '',
  /** V2 Phase 4: called after a token drag commits (map or tray), with pre/post positions for `dispatchTokenMoveHooks` */
  onTokenDragEnd,
  /** Game Table: manual HP/stress/hope/armor — applies immediately, banner for log */
  queueManualTrackEdit,
  pendingBanners,
  pendingResourceCosts = {},
  lifeSupportSelections = {},
  maps = [],
  activeMapId = null,
  /** GM broadcast framing from `table_state` — used for map thumbnails when not the active map (and players). */
  gmMapView = null,
  mapViews = [],
  gmActiveViewId = null,
  /** GM: enter map-only framing (no named view); persists as `set-map-free-explore` + `set-map-view` with `viewId: null`. */
  onMapFreeExplore,
  /** GM: double-click map/view strip tile to align invited players on that view (server op + SSE). */
  onForcePlayersToMapView,
  playerFreeMapExplore = false,
  playerFreeExploreMapId = null,
  onPlayerEnterMapFreeExplore,
  onPlayerExitMapFreeExplore,
  onSetActiveView,
  /** GM: persist new view (`add-map-view` op) with optional zoom/pan + name */
  onAddMapViewOp,
  onRemoveMapView,
  onRenameMapView,
  onSetViewBroadcast,
  /** GM: per-map allow player pan/zoom */
  onSetMapShare,
  playerSelectedViewId = null,
  onPlayerSelectView,
  onSetActiveMap,
  onAddMap,
  /** GM: `add-map` with image fields — used when pasting/uploading while the active map already has art */
  onAddMapWithImage,
  onRemoveMap,
  onRenameMap,
  tableId,
  /** Ephemeral map pings from SSE (`map_ping`) */
  mapPings = [],
  onDismissMapPing = () => {},
  /** Optimistic add when `postMapPing` returns authoritative `ping` (deduped in app). */
  appendMapPing = () => {},
  /** Ephemeral scribble segments from SSE (`map_scribble`); deduped in BattleMap */
  mapScribbles = [],
  /** GM: persist map-level draw overlay PNG (data URL) or null to clear. */
  onSetMapOverlay,
  /** GM: persist named view draw overlay PNG (data URL) or null to clear. */
  onSetMapViewOverlay,
  /** Live map viewport width/height ratio (scroll wrapper) — for import map camera rectangles matching the table. */
  onViewportAspectChange,
  /**
   * When set, clicking a placed character token opens this panel instead of the compact `TokenDetailPanel`.
   * Uses `GameTableCharacterListCard` (same as the Characters sidebar); sheet open is wired via `sheetTriggerProps` on that card.
   */
  renderPinnedCharacterPanel,
  /** Adversary pin — party target aid + offense (built in GMTableView). */
  renderAdversaryTargetAid,
}) {
  const { hideAiUi } = useAiUiPreference();
  const showImageGenAiUi = shouldShowImageGenAiUi(imageGenEnabled, hideAiUi);
  const scrollWrapperRef = useRef(null);
  const scrollContainerRef = useRef(null);
  /** GM right-drag map pan: { pointerId, startX, startY, startPanLeft, startPanTop } */
  const panRightDragRef = useRef(null);
  const leftTrayRef = useRef(null);
  const rightTrayRef = useRef(null);
  const dragRef = useRef(null);
  /**
   * Latest drag pointer handlers (`handlePointerDown`/`handlePointerMove`/`handlePointerUp`), kept fresh
   * every render. `stableOnPointerDown`/`stableOnPointerMove`/`stableOnPointerUp` below proxy through this
   * ref so `PlacedToken`/`TrayToken` always receive referentially-stable callback props — otherwise the
   * handlers' own dependency churn (e.g. `instanceNumbers` recomputing on any `activeElements` change)
   * would break token memoization on every SSE update.
   */
  const handlersRef = useRef({ handlePointerDown: null, handlePointerMove: null, handlePointerUp: null });
  const stableOnPointerDown = useCallback((e, element, fromTray) => {
    handlersRef.current.handlePointerDown?.(e, element, fromTray);
  }, []);
  const stableOnPointerMove = useCallback((e) => {
    handlersRef.current.handlePointerMove?.(e);
  }, []);
  const stableOnPointerUp = useCallback((e) => {
    handlersRef.current.handlePointerUp?.(e);
  }, []);
  /** After shelf click switches map, center the viewport on that character once `activeMapIdResolved` matches. */
  const pendingShelfNavigateCenterInstanceIdRef = useRef(null);
  const mapPingTapRef = useRef(null);
  const mapPingPointerUpRef = useRef(null);
  /** In-map anchor for measuring where to place the portaled fireworks layer (above DiceRoller z-15). */
  const fireworksAnchorRef = useRef(null);
  const fireworksPortalMountRef = useRef(null);
  const fireworksInstanceRef = useRef(null);
  const mapPingSeenIdsRef = useRef(new Set());

  /** Start at 0 so zoom bounds + renderedWidth match the flex layout before hydrating from localStorage (avoids stale 600×400 vs real wrapper size). */
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  /** Viewport rect for map fireworks (fixed layer in document.body, above 3D dice). */
  const [fireworksViewport, setFireworksViewport] = useState(null);
  const [dragGhost, setDragGhost] = useState(null); // { element, clientX, clientY, instanceNum, isMyCharacter }
  const [highlightLeftTray, setHighlightLeftTray] = useState(false);
  const [highlightRightTray, setHighlightRightTray] = useState(false);
  const [rightPanDragging, setRightPanDragging] = useState(false);
  const [pinnedToken, setPinnedToken] = useState(null); // { element, anchorX, anchorY }
  const [bullseyeFt, setBullseyeFt] = useState(null); // { x, y } in feet, null when off-map
  /**
   * `pointermove` fires far more often than the display can paint (especially with high-poll-rate
   * mice/trackpads), and every `setBullseyeFt` call forces a full `BattleMap` re-render (bullseye
   * SVG + `tokenRangeBands` recompute over every placed token). Batch to at most one commit per
   * animation frame via a ref instead of committing state directly from the raw event handler.
   */
  const pendingBullseyeFtRef = useRef(undefined); // undefined = nothing pending this frame
  const bullseyeRafRef = useRef(null);
  const scheduleBullseyeFt = useCallback((value) => {
    pendingBullseyeFtRef.current = value;
    if (bullseyeRafRef.current != null) return;
    bullseyeRafRef.current = requestAnimationFrame(() => {
      bullseyeRafRef.current = null;
      setBullseyeFt(pendingBullseyeFtRef.current);
    });
  }, []);
  useEffect(() => () => {
    if (bullseyeRafRef.current != null) cancelAnimationFrame(bullseyeRafRef.current);
  }, []);
  const { openImport, enabled: unifiedImportEnabled } = useUnifiedImport();
  // Frozen bullseye position during drag (feet coords of dragged token's origin)
  const frozenBullseyeRef = useRef(null);
  // Second bullseye that follows the dragged token during drag (only when frozen bullseye is set)
  const [followBullseyeFt, setFollowBullseyeFt] = useState(null);
  /** AI map editor: show selected generation on the table map before Save (data URL or hosted URL). */
  const [mapAiGenPreviewUrl, setMapAiGenPreviewUrl] = useState(null);
  /** Shared with MapConfigToolbar "Generate with AI" and Theatre of the Mind overlay. */
  const [aiMapOpen, setAiMapOpen] = useState(false);
  const mapAiGenPreviewUrlRef = useRef(null);
  mapAiGenPreviewUrlRef.current = mapAiGenPreviewUrl;

  // Track scroll area size for pxPerFt and display zoom bounds
  useLayoutEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    const apply = () => {
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
    };
    apply();
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      if (cr.width > 0) setContainerWidth(cr.width);
      if (cr.height > 0) setContainerHeight(cr.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!onViewportAspectChange) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    onViewportAspectChange(containerWidth / containerHeight);
  }, [containerWidth, containerHeight, onViewportAspectChange]);

  const handleMapPanelDragOver = useCallback(
    (e) => {
      if (isPlayer) return;
      if (!dataTransferHasFileDrag(e.dataTransfer)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [isPlayer],
  );

  const handleMapPanelDrop = useCallback(
    (e) => {
      if (isPlayer) return;
      e.preventDefault();
      const file = pickFirstImageFileFromDataTransfer(e.dataTransfer);
      if (file && unifiedImportEnabled) openImport([file]);
    },
    [isPlayer, unifiedImportEnabled, openImport],
  );

  // Derived map dimensions
  const { mapWidthFt, mapHeightFt } = useMemo(() => getMapDimensions(mapConfig), [mapConfig]);
  const scribbleLayoutKey = useMemo(
    () => scribbleCanvasLayoutKey(mapWidthFt, mapHeightFt, mapConfig?.mapImageUrl ?? ''),
    [mapWidthFt, mapHeightFt, mapConfig?.mapImageUrl],
  );
  const pxPerFt = useMemo(
    () => Math.max(containerWidth / mapWidthFt, MIN_PX_PER_FT),
    [containerWidth, mapWidthFt],
  );
  const renderedWidthPx = Math.round(mapWidthFt * pxPerFt);
  const renderedHeightPx = Math.round(mapHeightFt * pxPerFt);
  const tokenSizePx = Math.max(33, Math.round(5 * pxPerFt));
  const trayTokenSizePx = CHARACTER_TRAY_WIDTH_PX - 16; // 36; fixed size for tray tokens

  const defaultPlayerBroadcastViewId = useMemo(() => {
    if (!isPlayer) return null;
    return (
      mapViews.find((v) => v.broadcastToPlayers && maps.some((m) => m.id === v.mapId))?.id ?? null
    );
  }, [isPlayer, mapViews, maps]);

  const activeViewIdResolved = useMemo(() => {
    if (isPlayer && playerFreeMapExplore) return null;
    if (!isPlayer && gmActiveViewId === null) return null;
    if (!isPlayer) return gmActiveViewId ?? mapViews[0]?.id ?? null;
    return playerSelectedViewId ?? defaultPlayerBroadcastViewId ?? null;
  }, [isPlayer, playerFreeMapExplore, gmActiveViewId, playerSelectedViewId, defaultPlayerBroadcastViewId, mapViews]);

  const activeMapIdResolved = useMemo(() => {
    if (isPlayer && playerFreeMapExplore && playerFreeExploreMapId) {
      return playerFreeExploreMapId;
    }
    if (!isPlayer && gmActiveViewId === null && gmMapView?.mapId) {
      return gmMapView.mapId;
    }
    const v = activeViewIdResolved && mapViews.find(x => x.id === activeViewIdResolved);
    return v?.mapId ?? activeMapId ?? maps[0]?.id ?? DEFAULT_LEGACY_MAP_ID;
  }, [
    isPlayer,
    playerFreeMapExplore,
    playerFreeExploreMapId,
    activeViewIdResolved,
    mapViews,
    activeMapId,
    maps,
    gmActiveViewId,
    gmMapView,
  ]);

  const sortedMapViews = useMemo(() => {
    const order = new Map(maps.map((m, i) => [m.id, i]));
    return [...mapViews].sort((a, b) => {
      const ia = order.get(a.mapId) ?? 999;
      const ib = order.get(b.mapId) ?? 999;
      if (ia !== ib) return ia - ib;
      return mapViews.findIndex(x => x.id === a.id) - mapViews.findIndex(x => x.id === b.id);
    });
  }, [mapViews, maps]);

  /** GM strip: one group per map that has views — full-map tile + view tiles. */
  const gmMapViewGroups = useMemo(() => {
    const byMap = new Map();
    for (const v of sortedMapViews) {
      const arr = byMap.get(v.mapId) || [];
      arr.push(v);
      byMap.set(v.mapId, arr);
    }
    return maps
      .map((m) => ({ map: m, views: byMap.get(m.id) || [] }))
      .filter((g) => g.views.length > 0);
  }, [maps, sortedMapViews]);

  const playerStripViews = useMemo(() => {
    return sortedMapViews.filter(v => {
      if (!v.broadcastToPlayers) return false;
      return maps.some(x => x.id === v.mapId);
    });
  }, [sortedMapViews, maps]);

  const visibleMapPings = useMemo(
    () => (mapPings || []).filter(p => effectiveTokenMapId(p.mapId) === activeMapIdResolved),
    [mapPings, activeMapIdResolved],
  );

  useEffect(() => {
    mapPingSeenIdsRef.current = new Set();
  }, [tableId]);

  useEffect(() => {
    mapScribbleSeenIdsRef.current = new Set();
  }, [tableId]);

  const { minZoom, maxZoom } = useMemo(
    () =>
      computeMapZoomBounds({
        containerW: containerWidth,
        containerH: containerHeight,
        renderedWidthPx,
        renderedHeightPx,
        tokenSizePx,
      }),
    [containerWidth, containerHeight, renderedWidthPx, renderedHeightPx, tokenSizePx],
  );

  const minZoomRef = useRef(minZoom);
  const maxZoomRef = useRef(maxZoom);
  const renderedWRef = useRef(renderedWidthPx);
  const renderedHRef = useRef(renderedHeightPx);
  minZoomRef.current = minZoom;
  maxZoomRef.current = maxZoom;
  renderedWRef.current = renderedWidthPx;
  renderedHRef.current = renderedHeightPx;

  const [mapZoom, setMapZoom] = useState(1);
  const mapZoomRef = useRef(1);
  mapZoomRef.current = mapZoom;
  const [mapPanLeft, setMapPanLeft] = useState(0);
  const [mapPanTop, setMapPanTop] = useState(0);
  const mapPanLeftRef = useRef(0);
  const mapPanTopRef = useRef(0);
  mapPanLeftRef.current = mapPanLeft;
  mapPanTopRef.current = mapPanTop;

  /** AI preview: show full map at min zoom visually; real `mapZoom` / pan state unchanged. */
  const mapAiPreviewActive = !!mapAiGenPreviewUrl;
  const viewZoom = mapAiPreviewActive ? minZoom : mapZoom;
  const viewPanLeft = mapAiPreviewActive ? 0 : mapPanLeft;
  const viewPanTop = mapAiPreviewActive ? 0 : mapPanTop;

  /**
   * Snapshot of the current pan/zoom, read by `clientToFt`/`handlePointerDown`/`handlePointerUp` instead of
   * closing over `viewZoom`/`viewPanLeft`/`viewPanTop` directly — keeps those callbacks referentially stable
   * while panning/zooming (see `PlacedToken`/`TrayToken` memoization above).
   */
  const viewStateRef = useRef({ viewZoom, viewPanLeft, viewPanTop });
  viewStateRef.current = { viewZoom, viewPanLeft, viewPanTop };

  /** Clips map to shared `mapViewVisibleNorm` rect (players / saved cameras); null for GM live view. */
  const [mapLetterboxClipPx, setMapLetterboxClipPx] = useState(null);

  /** Max brush/eraser radius: 20% of visible map height (feet), at least 1′. */
  const drawBrushRadiusMaxFt = useMemo(() => {
    const viewHeightFt =
      containerHeight > 0 && pxPerFt > 0 && mapZoom > 0
        ? Math.min(mapHeightFt, containerHeight / (pxPerFt * mapZoom))
        : mapHeightFt;
    return Math.max(MAP_DRAW_BRUSH_RADIUS_FT_MIN, viewHeightFt * 0.2);
  }, [mapHeightFt, containerHeight, pxPerFt, mapZoom]);

  /** Sync in-map anchor rect → fixed layer in document.body (above DiceRoller z-15 WebGL). */
  const syncFireworksViewport = useCallback(() => {
    const el = fireworksAnchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    setFireworksViewport((prev) => {
      const next = {
        top: Math.round(r.top * 10) / 10,
        left: Math.round(r.left * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      };
      if (
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    syncFireworksViewport();
  }, [
    syncFireworksViewport,
    viewZoom,
    viewPanLeft,
    viewPanTop,
    renderedWidthPx,
    renderedHeightPx,
    containerWidth,
    containerHeight,
  ]);

  useLayoutEffect(() => {
    const el = fireworksAnchorRef.current;
    if (!el) return;
    syncFireworksViewport();
    const ro = new ResizeObserver(() => syncFireworksViewport());
    ro.observe(el);
    window.addEventListener('resize', syncFireworksViewport);
    window.addEventListener('scroll', syncFireworksViewport, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncFireworksViewport);
      window.removeEventListener('scroll', syncFireworksViewport, true);
    };
  }, [syncFireworksViewport]);

  useLayoutEffect(() => {
    const mount = fireworksPortalMountRef.current;
    if (!mount || !fireworksViewport || fireworksViewport.width <= 0 || fireworksViewport.height <= 0) return;

    let fw = fireworksInstanceRef.current;
    if (!fw) {
      fw = new Fireworks(mount, {
        intensity: 0,
        autoresize: false,
        mouse: { click: false, move: false, max: 1 },
        sound: { enabled: false },
      });
      fw.start();
      fireworksInstanceRef.current = fw;
    }
    fw.updateSize({ width: fireworksViewport.width, height: fireworksViewport.height });
  }, [fireworksViewport]);

  useEffect(() => {
    return () => {
      fireworksInstanceRef.current?.stop?.(true);
      fireworksInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const fw = fireworksInstanceRef.current;
    if (!fw || !fireworksViewport) return;
    const sx = fireworksViewport.width / renderedWidthPx;
    const sy = fireworksViewport.height / renderedHeightPx;
    for (const p of visibleMapPings) {
      if (mapPingSeenIdsRef.current.has(p.id)) continue;
      mapPingSeenIdsRef.current.add(p.id);
      const px = p.xFt * pxPerFt * sx;
      const py = p.yFt * pxPerFt * sy;
      fw.mouse.x = px;
      fw.mouse.y = py;
      fw.mouse.active = true;
      fw.launch(1);
      fw.mouse.active = false;
    }
  }, [visibleMapPings, pxPerFt, renderedWidthPx, renderedHeightPx, fireworksViewport]);

  const gmViewHydratedRef = useRef(false);
  const mapViewPersistTimerRef = useRef(null);
  /** Latest `onMapViewSync` — debounced persist must not call a stale closure (wrong camera `viewId`). */
  const onMapViewSyncRef = useRef(onMapViewSync);
  onMapViewSyncRef.current = onMapViewSync;
  const playerFreeMapPersistTimerRef = useRef(null);
  const playerFreeMapHydratedKeyRef = useRef('');
  const playerRemoteViewStateCacheRef = useRef(new Map());
  const playerRemoteViewSwitchPendingRef = useRef(false);
  const playerRemoteViewKeyRef = useRef('');
  const [drawTool, setDrawTool] = useState('scribble');
  const [rectShapeFilled, setRectShapeFilled] = useState(true);
  const [ovalShapeFilled, setOvalShapeFilled] = useState(true);
  const [drawBrushRadiusFt, setDrawBrushRadiusFt] = useState(DEFAULT_MAP_DRAW_BRUSH_RADIUS_FT);
  const drawBrushRadiusClampedFt = Math.min(
    Math.max(drawBrushRadiusFt, MAP_DRAW_BRUSH_RADIUS_FT_MIN),
    drawBrushRadiusMaxFt,
  );
  useEffect(() => {
    setDrawBrushRadiusFt((prev) => {
      const viewHeightFt =
        containerHeight > 0 && pxPerFt > 0 && mapZoom > 0
          ? Math.min(mapHeightFt, containerHeight / (pxPerFt * mapZoom))
          : mapHeightFt;
      const maxR = Math.max(MAP_DRAW_BRUSH_RADIUS_FT_MIN, viewHeightFt * 0.2);
      const next = Math.min(Math.max(prev, MAP_DRAW_BRUSH_RADIUS_FT_MIN), maxR);
      return next === prev ? prev : next;
    });
  }, [mapHeightFt, containerHeight, pxPerFt, mapZoom]);
  const [drawColorHex, setDrawColorHex] = useState('#000000');
  const [drawOpacity, setDrawOpacity] = useState(1);
  /** True when cursor is over a placed token — draw layers ignore pointer so tokens stay draggable. */
  const [hoveringTokenBlocksDraw, setHoveringTokenBlocksDraw] = useState(false);
  /** True after pointer-down on map draw/scribble until pointer-up/cancel — keeps draw canvas receiving events over tokens mid-stroke. */
  const [mapDrawCaptureActive, setMapDrawCaptureActive] = useState(false);
  /** True while interacting with brush radius or opacity — shows live viewport preview dot (not color). */
  const [brushPreviewControlsActive, setBrushPreviewControlsActive] = useState(false);
  /** When true, next click on the map samples a color into the brush color + opacity. */
  const [drawEyedropperActive, setDrawEyedropperActive] = useState(false);
  const mapImageRef = useRef(null);
  const mapOverlayImgRef = useRef(null);
  const cameraOverlayImgRef = useRef(null);
  const drawPaintRef = useRef(null);
  const drawSizeRef = useRef({ w: 0, h: 0 });
  const drawBrushActiveRef = useRef(false);
  /** Pointer id passed to `setPointerCapture` on draw/scribble canvases — released when a second touch starts a map pinch. */
  const mapDrawCapturePointerIdRef = useRef(null);
  /** Active pointers on the map viewport (for two-finger pinch zoom on touch devices). */
  const mapPinchPointersRef = useRef(new Map());
  const mapPinchActiveRef = useRef(false);
  const mapPinchLastDistanceRef = useRef(0);
  const drawLastPxRef = useRef(null);
  const drawShapeDragRef = useRef(null);
  /** Eraser: click-to-flood vs drag — set on pointer down, cleared when drag starts or up/cancel */
  const drawEraserPendingRef = useRef(null);
  const scribbleCanvasRef = useRef(null);
  const scribbleStrokesRef = useRef([]);
  const scribbleRafRef = useRef(null);
  const scribbleSizeRef = useRef({ w: 0, h: 0 });
  const scribbleBrushActiveRef = useRef(false);
  const scribbleLastPxRef = useRef(null);
  /** Shared start time for all segments in one scribble gesture (whole stroke fades together). */
  const scribbleStrokeT0Ref = useRef(0);
  const scribbleStrokeIdRef = useRef(null);
  /** Last `performance.now()` when we sent a scribble segment (throttle network). */
  const scribbleBroadcastLastSentRef = useRef(0);
  /** Last draw-canvas position included in a broadcast (dot or segment); bridges throttle gaps for peers. */
  const scribbleBroadcastLastPxRef = useRef(null);
  const mapScribbleSeenIdsRef = useRef(new Set());

  useEffect(() => {
    if (isPlayer) setDrawTool('scribble');
  }, [isPlayer]);

  useEffect(() => {
    setDrawEyedropperActive(false);
  }, [drawTool]);

  useEffect(() => {
    if (!drawEyedropperActive) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawEyedropperActive(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawEyedropperActive]);
  const mapAllowsPlayerCameras = maps.find(m => m.id === activeMapIdResolved)?.shareWithPlayers !== false;
  /** GM: can persist a new named view (table op). */
  const gmCanCreateCameraView = !isPlayer && Boolean(onAddMapViewOp);
  const canControlMapView =
    (!isPlayer && !!onMapViewSync) ||
    (isPlayer && mapAllowsPlayerCameras && playerFreeMapExplore);

  const mapViewSig = useMemo(
    () =>
      `${mapConfig?.mapViewZoomRatio ?? ''}|${JSON.stringify(mapConfig?.mapViewPanNorm ?? null)}|${JSON.stringify(mapConfig?.mapViewVisibleNorm ?? null)}`,
    [mapConfig?.mapViewZoomRatio, mapConfig?.mapViewPanNorm, mapConfig?.mapViewVisibleNorm],
  );

  const shouldApplyPlayerFollowClip = useMemo(
    () =>
      isPlayer &&
      !playerFreeMapExplore &&
      isValidMapViewVisibleNorm(mapConfig?.mapViewVisibleNorm),
    [isPlayer, playerFreeMapExplore, mapConfig?.mapViewVisibleNorm],
  );

  const schedulePersistView = useCallback(() => {
    if (!onMapViewSyncRef.current) return;
    if (mapViewPersistTimerRef.current) clearTimeout(mapViewPersistTimerRef.current);
    mapViewPersistTimerRef.current = setTimeout(() => {
      mapViewPersistTimerRef.current = null;
      // Double rAF: let layout settle after viewport resize before measuring vw/vh and reading pan refs.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!gmViewHydratedRef.current) return;
          const wrap = scrollWrapperRef.current;
          const vw = wrap?.clientWidth ?? 0;
          const vh = wrap?.clientHeight ?? 0;
          if (vw <= 0 || vh <= 0) return;
          const encoded = encodeMapViewState({
            mapZoom: mapZoomRef.current,
            scrollLeft: mapPanLeftRef.current,
            scrollTop: mapPanTopRef.current,
            minZoom: minZoomRef.current,
            maxZoom: maxZoomRef.current,
            renderedWidthPx: renderedWRef.current,
            renderedHeightPx: renderedHRef.current,
            viewportW: vw,
            viewportH: vh,
          });
          callLatestOnMapViewSync(onMapViewSyncRef, encoded);
        });
      });
    }, 120);
  }, []);

  const schedulePersistPlayerFreeMap = useCallback(() => {
    if (!isPlayer || !tableId || !playerFreeExploreMapId) return;
    if (playerFreeMapPersistTimerRef.current) clearTimeout(playerFreeMapPersistTimerRef.current);
    playerFreeMapPersistTimerRef.current = setTimeout(() => {
      playerFreeMapPersistTimerRef.current = null;
      const wrap = scrollWrapperRef.current;
      const vw = wrap?.clientWidth ?? 0;
      const vh = wrap?.clientHeight ?? 0;
      if (vw <= 0 || vh <= 0) return;
      const encoded = encodeMapViewState({
        mapZoom: mapZoomRef.current,
        scrollLeft: mapPanLeftRef.current,
        scrollTop: mapPanTopRef.current,
        minZoom: minZoomRef.current,
        maxZoom: maxZoomRef.current,
        renderedWidthPx: renderedWRef.current,
        renderedHeightPx: renderedHRef.current,
        viewportW: vw,
        viewportH: vh,
      });
      try {
        localStorage.setItem(
          `dh_player_free_map:${tableId}:${playerFreeExploreMapId}`,
          JSON.stringify({
            mapViewZoomRatio: encoded.mapViewZoomRatio,
            mapViewPanNorm: encoded.mapViewPanNorm,
            mapViewVisibleNorm: encoded.mapViewVisibleNorm,
          }),
        );
      } catch {
        /* ignore */
      }
    }, 120);
  }, [isPlayer, tableId, playerFreeExploreMapId]);

  const schedulePersistPlayerViewport = useCallback(() => {
    if (playerFreeMapExplore) schedulePersistPlayerFreeMap();
  }, [playerFreeMapExplore, schedulePersistPlayerFreeMap]);

  /** Must be useLayoutEffect (not useEffect) so this runs before the GM hydrate effect below — otherwise hydration sees gmViewHydratedRef still true and skips applying mapConfig when switching named views. */
  useLayoutEffect(() => {
    if (mapViewPersistTimerRef.current) {
      clearTimeout(mapViewPersistTimerRef.current);
      mapViewPersistTimerRef.current = null;
    }
    gmViewHydratedRef.current = false;
  }, [mapConfig?.mapImageUrl, gmUid, activeMapIdResolved, gmActiveViewId]);

  const handleSplitCamera = useCallback(async () => {
    const wrap = scrollWrapperRef.current;
    const vw = wrap?.clientWidth ?? 0;
    const vh = wrap?.clientHeight ?? 0;
    if (vw <= 0 || vh <= 0) return;
    const encoded = encodeMapViewState({
      mapZoom: mapZoomRef.current,
      scrollLeft: mapPanLeftRef.current,
      scrollTop: mapPanTopRef.current,
      minZoom: minZoomRef.current,
      maxZoom: maxZoomRef.current,
      renderedWidthPx: renderedWRef.current,
      renderedHeightPx: renderedHRef.current,
      viewportW: vw,
      viewportH: vh,
    });
    const name = window.prompt('Name this view', 'View');
    if (name === null) return;
    const trimmed = (name || 'View').trim() || 'View';
    if (onAddMapViewOp) {
      onAddMapViewOp({
        name: trimmed,
        mapViewZoomRatio: encoded.mapViewZoomRatio,
        mapViewPanNorm: encoded.mapViewPanNorm,
        mapViewVisibleNorm: encoded.mapViewVisibleNorm,
      });
    }
  }, [onAddMapViewOp]);

  // GM: broadcast portable mapViewZoomRatio/mapViewPanNorm (same encoding as wheel/keyboard pan and zoom) whenever the
  // map viewport or zoom bounds change, so players receive updates after layout and when the GM resizes or edits map size.
  useEffect(() => {
    if (!onMapViewSync) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    schedulePersistView();
  }, [
    onMapViewSync,
    containerWidth,
    containerHeight,
    renderedWidthPx,
    renderedHeightPx,
    minZoom,
    maxZoom,
    schedulePersistView,
  ]);

  useLayoutEffect(() => {
    if (!onMapViewSync) return;
    if (!tableStateReady) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    if (gmViewHydratedRef.current) return;
    if (
      mapConfig?.mapViewZoomRatio == null &&
      mapConfig?.mapViewPanNorm == null &&
      !isValidMapViewVisibleNorm(mapConfig?.mapViewVisibleNorm)
    ) {
      gmViewHydratedRef.current = true;
      setMapLetterboxClipPx(null);
      return;
    }
    const d = decodeMapViewState(mapConfig, {
      minZoom,
      maxZoom,
      renderedWidthPx,
      renderedHeightPx,
      viewportW: containerWidth,
      viewportH: containerHeight,
    });
    if (!d) {
      gmViewHydratedRef.current = true;
      setMapLetterboxClipPx(null);
      return;
    }
    gmViewHydratedRef.current = true;
    mapZoomRef.current = d.mapZoom;
    setMapZoom(d.mapZoom);
    mapPanLeftRef.current = d.scrollLeft;
    mapPanTopRef.current = d.scrollTop;
    setMapPanLeft(d.scrollLeft);
    setMapPanTop(d.scrollTop);
    setMapLetterboxClipPx(null);
  }, [
    onMapViewSync,
    tableStateReady,
    /** Must re-run when switching named cameras even if normalized pan/zoom match the previous view. */
    gmActiveViewId,
    mapConfig?.mapImageUrl,
    mapConfig?.mapViewZoomRatio,
    mapConfig?.mapViewPanNorm,
    mapConfig?.mapViewVisibleNorm,
    minZoom,
    maxZoom,
    renderedWidthPx,
    renderedHeightPx,
    containerWidth,
    containerHeight,
  ]);

  useLayoutEffect(() => {
    const nextKey =
      isPlayer && !playerFreeMapExplore && activeViewIdResolved
        ? `${tableId ?? ''}:${activeViewIdResolved}:${mapConfig?.mapImageUrl ?? ''}`
        : '';
    playerRemoteViewSwitchPendingRef.current = playerRemoteViewKeyRef.current !== nextKey;
    playerRemoteViewKeyRef.current = nextKey;
  }, [isPlayer, playerFreeMapExplore, activeViewIdResolved, tableId, mapConfig?.mapImageUrl]);

  useLayoutEffect(() => {
    if (onMapViewSync || !tableStateReady) return;
    const applyRemote = shouldApplyRemotePlayerMapView(isPlayer, playerFreeMapExplore);
    if (!applyRemote) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    const decodeCtx = {
      minZoom,
      maxZoom,
      renderedWidthPx,
      renderedHeightPx,
      viewportW: containerWidth,
      viewportH: containerHeight,
      /** Match GM’s viewport to the top of the player viewport — centering adds a scroll-scaled gap above the shared frame. */
      decodeAlign: shouldApplyPlayerFollowClip ? 'topLeft' : 'center',
    };
    const liveViewState = hasDecodableView(mapConfig) ? copyMapViewState(mapConfig) : null;
    const liveDecoded = liveViewState ? decodeMapViewState(liveViewState, decodeCtx) : null;
    const playerRemoteViewKey =
      isPlayer && activeViewIdResolved
        ? `${tableId ?? ''}:${activeViewIdResolved}:${mapConfig?.mapImageUrl ?? ''}`
        : '';
    const cachedViewState = playerRemoteViewKey
      ? playerRemoteViewStateCacheRef.current.get(playerRemoteViewKey) ?? null
      : null;
    const cachedDecoded = cachedViewState ? decodeMapViewState(cachedViewState, decodeCtx) : null;

    const useCachedView = shouldPreferCachedPlayerRemoteView({
      switchedViews: playerRemoteViewSwitchPendingRef.current,
      liveDecoded,
      cachedDecoded,
    });
    const d = useCachedView ? cachedDecoded : liveDecoded;
    if (!d) return;
    mapZoomRef.current = d.mapZoom;
    setMapZoom(d.mapZoom);
    mapPanLeftRef.current = d.scrollLeft;
    mapPanTopRef.current = d.scrollTop;
    setMapPanLeft(d.scrollLeft);
    setMapPanTop(d.scrollTop);
    setMapLetterboxClipPx(
      shouldApplyPlayerFollowClip && d.letterboxClipPx ? d.letterboxClipPx : null,
    );
    playerRemoteViewSwitchPendingRef.current = false;
    if (!useCachedView && playerRemoteViewKey && liveViewState) {
      playerRemoteViewStateCacheRef.current.set(playerRemoteViewKey, liveViewState);
    }
  }, [
    onMapViewSync,
    tableStateReady,
    isPlayer,
    playerFreeMapExplore,
    activeViewIdResolved,
    tableId,
    mapConfig?.mapImageUrl,
    mapViewSig,
    shouldApplyPlayerFollowClip,
    minZoom,
    maxZoom,
    renderedWidthPx,
    renderedHeightPx,
    containerWidth,
    containerHeight,
  ]);

  useLayoutEffect(() => {
    if (!isPlayer || !playerFreeMapExplore || !playerFreeExploreMapId || !tableId) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    const key = `${tableId}:${playerFreeExploreMapId}:${mapConfig?.mapImageUrl ?? ''}`;
    if (playerFreeMapHydratedKeyRef.current === key) return;
    let d = null;
    try {
      const raw = localStorage.getItem(`dh_player_free_map:${tableId}:${playerFreeExploreMapId}`);
      if (raw) {
        const { mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm } = JSON.parse(raw);
        d = decodeMapViewState(
          { mapViewZoomRatio, mapViewPanNorm, mapViewVisibleNorm },
          {
            minZoom,
            maxZoom,
            renderedWidthPx,
            renderedHeightPx,
            viewportW: containerWidth,
            viewportH: containerHeight,
          },
        );
      }
    } catch {
      /* ignore */
    }
    if (!d) {
      d = decodeMapViewState(
        {
          mapViewZoomRatio: mapConfig?.mapViewZoomRatio ?? null,
          mapViewPanNorm: mapConfig?.mapViewPanNorm ?? null,
          mapViewVisibleNorm: mapConfig?.mapViewVisibleNorm ?? null,
        },
        {
          minZoom,
          maxZoom,
          renderedWidthPx,
          renderedHeightPx,
          viewportW: containerWidth,
          viewportH: containerHeight,
        },
      );
    }
    if (d) {
      mapZoomRef.current = d.mapZoom;
      setMapZoom(d.mapZoom);
      mapPanLeftRef.current = d.scrollLeft;
      mapPanTopRef.current = d.scrollTop;
      setMapPanLeft(d.scrollLeft);
      setMapPanTop(d.scrollTop);
    }
    setMapLetterboxClipPx(null);
    playerFreeMapHydratedKeyRef.current = key;
  }, [
    isPlayer,
    playerFreeMapExplore,
    playerFreeExploreMapId,
    tableId,
    mapConfig?.mapImageUrl,
    mapConfig?.mapViewZoomRatio,
    mapConfig?.mapViewPanNorm,
    mapConfig?.mapViewVisibleNorm,
    containerWidth,
    containerHeight,
    minZoom,
    maxZoom,
    renderedWidthPx,
    renderedHeightPx,
  ]);

  useEffect(() => {
    if (!playerFreeMapExplore) playerFreeMapHydratedKeyRef.current = '';
  }, [playerFreeMapExplore]);

  useEffect(() => () => {
    if (mapViewPersistTimerRef.current) clearTimeout(mapViewPersistTimerRef.current);
    if (playerFreeMapPersistTimerRef.current) clearTimeout(playerFreeMapPersistTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    setMapZoom((z) => clampMapZoom(z, minZoom, maxZoom));
  }, [minZoom, maxZoom]);

  useLayoutEffect(() => {
    if (containerWidth <= 0 || containerHeight <= 0) return;
    /** Use ref zoom: GM hydrate / wheel update refs before React state commits; clamping with stale `mapZoom` state after a camera switch corrupts pan and the next `set-map-view` overwrites the wrong camera. */
    const panParams = {
      mapZoom: mapZoomRef.current,
      renderedWidthPx,
      renderedHeightPx,
      viewportW: containerWidth,
      viewportH: containerHeight,
    };
    const c = clampPanScroll(mapPanLeftRef.current, mapPanTopRef.current, panParams);
    if (c.scrollLeft !== mapPanLeftRef.current || c.scrollTop !== mapPanTopRef.current) {
      mapPanLeftRef.current = c.scrollLeft;
      mapPanTopRef.current = c.scrollTop;
      setMapPanLeft(c.scrollLeft);
      setMapPanTop(c.scrollTop);
    }
  }, [mapZoom, containerWidth, containerHeight, renderedWidthPx, renderedHeightPx]);

  const maxPanLeft = Math.max(0, renderedWidthPx * mapZoom - containerWidth);
  const maxPanTop = Math.max(0, renderedHeightPx * mapZoom - containerHeight);
  const canPanMap = maxPanLeft > 0 || maxPanTop > 0;

  /** Live normalized view for the active map — strip thumbnails match the main viewport before SSE catches up. */
  const liveStripView = useMemo(() => {
    if (isPlayer) return null;
    if (!containerWidth || !containerHeight) return null;
    return encodeMapViewState({
      mapZoom,
      scrollLeft: mapPanLeft,
      scrollTop: mapPanTop,
      minZoom,
      maxZoom,
      renderedWidthPx,
      renderedHeightPx,
      viewportW: containerWidth,
      viewportH: containerHeight,
    });
  }, [
    isPlayer,
    containerWidth,
    containerHeight,
    mapZoom,
    mapPanLeft,
    mapPanTop,
    minZoom,
    maxZoom,
    renderedWidthPx,
    renderedHeightPx,
  ]);

  const viewStateForStripTile = useCallback(
    (view) => {
      const m = maps.find(x => x.id === view?.mapId);
      if (!m || !view) return null;
      if (!isPlayer && gmActiveViewId && view.id === gmActiveViewId && liveStripView) {
        return liveStripView;
      }
      return {
        mapViewZoomRatio: view.mapViewZoomRatio,
        mapViewPanNorm: view.mapViewPanNorm,
        mapViewVisibleNorm: view.mapViewVisibleNorm,
      };
    },
    [isPlayer, gmActiveViewId, liveStripView, maps],
  );

  /** Player strip: one scroll batch per map — include shared maps (free-map tile) even when no broadcast views. */
  const playerViewBatches = useMemo(() => {
    const out = [];
    for (const m of maps) {
      const gmViews = playerStripViews.filter((v) => v.mapId === m.id);
      const showSharedMapTile = m.shareWithPlayers !== false;
      if (!gmViews.length && !showSharedMapTile) continue;
      out.push({ map: m, gmViews });
    }
    return out;
  }, [maps, playerStripViews]);

  const showPlayerMapViewStrip = useMemo(
    () => shouldShowPlayerMapViewStrip(playerViewBatches),
    [playerViewBatches],
  );

  useEffect(() => {
    if (!isPlayer) return;
    if (freeMapExploreTargetsUnsharedMap(playerFreeExploreMapId, playerFreeMapExplore, maps)) {
      onPlayerExitMapFreeExplore?.();
    }
  }, [
    isPlayer,
    maps,
    playerFreeMapExplore,
    playerFreeExploreMapId,
    onPlayerExitMapFreeExplore,
  ]);

  const centerMapOnPlacedActor = useCallback(
    (element) => {
      if (!canControlMapView) return;
      if (mapAiGenPreviewUrlRef.current) return;
      const wrap = scrollContainerRef.current;
      if (!wrap) return;
      const vw = wrap.clientWidth;
      const vh = wrap.clientHeight;
      if (vw <= 0 || vh <= 0) return;
      if (element.tokenX == null || element.tokenY == null) return;
      if (effectiveTokenMapId(element.mapId) !== activeMapIdResolved) return;
      const z = mapZoomRef.current;
      const rw = renderedWRef.current;
      const rh = renderedHRef.current;
      const innerCx = (element.tokenX + 2.5) * pxPerFt;
      const innerCy = (element.tokenY + 2.5) * pxPerFt;
      const next = computePanToCenterInnerPointPx({
        innerCenterXPx: innerCx,
        innerCenterYPx: innerCy,
        mapZoom: z,
        renderedWidthPx: rw,
        renderedHeightPx: rh,
        viewportW: vw,
        viewportH: vh,
      });
      mapPanLeftRef.current = next.scrollLeft;
      mapPanTopRef.current = next.scrollTop;
      setMapPanLeft(next.scrollLeft);
      setMapPanTop(next.scrollTop);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    },
    [canControlMapView, onMapViewSync, pxPerFt, schedulePersistView, schedulePersistPlayerViewport, isPlayer, activeMapIdResolved],
  );

  useEffect(() => {
    const id = pendingShelfNavigateCenterInstanceIdRef.current;
    if (!id) return;
    const el = activeElements.find((e) => e.instanceId === id);
    if (!el || el.tokenX == null) {
      pendingShelfNavigateCenterInstanceIdRef.current = null;
      return;
    }
    if (effectiveTokenMapId(el.mapId) !== activeMapIdResolved) return;
    pendingShelfNavigateCenterInstanceIdRef.current = null;
    centerMapOnPlacedActor(el);
  }, [activeMapIdResolved, activeElements, centerMapOnPlacedActor]);

  const applyZoomToFitActors = useCallback(() => {
    if (!canControlMapView) return;
    if (mapAiGenPreviewUrlRef.current) return;
    const wrap = scrollContainerRef.current;
    if (!wrap) return;
    const vw = wrap.clientWidth;
    const vh = wrap.clientHeight;
    if (vw <= 0 || vh <= 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of activeElements) {
      if (el.elementType !== 'character' && el.elementType !== 'adversary' && el.elementType !== 'boardToken') {
        continue;
      }
      if (el.tokenX == null || el.tokenY == null) continue;
      if (effectiveTokenMapId(el.mapId) !== activeMapIdResolved) continue;
      const left = el.tokenX * pxPerFt;
      const top = el.tokenY * pxPerFt;
      const right = left + tokenSizePx;
      const bottom = top + tokenSizePx;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }
    if (!Number.isFinite(minX)) return;
    const result = computeZoomAndPanToFitInnerBounds({
      minInnerX: minX,
      minInnerY: minY,
      maxInnerX: maxX,
      maxInnerY: maxY,
      paddingPx: 12,
      minZoom: minZoomRef.current,
      maxZoom: maxZoomRef.current,
      renderedWidthPx: renderedWRef.current,
      renderedHeightPx: renderedHRef.current,
      viewportW: vw,
      viewportH: vh,
    });
    mapZoomRef.current = result.mapZoom;
    mapPanLeftRef.current = result.scrollLeft;
    mapPanTopRef.current = result.scrollTop;
    setMapZoom(result.mapZoom);
    setMapPanLeft(result.scrollLeft);
    setMapPanTop(result.scrollTop);
    if (onMapViewSync) schedulePersistView();
    if (isPlayer) schedulePersistPlayerViewport();
  }, [canControlMapView, onMapViewSync, activeElements, pxPerFt, tokenSizePx, schedulePersistView, schedulePersistPlayerViewport, isPlayer, activeMapIdResolved]);

  // Map viewport: wheel = pan Y, Shift+wheel = pan X, ⌘/Ctrl+wheel = zoom toward cursor (GM persists; player local only)
  useEffect(() => {
    if (!canControlMapView) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (mapAiGenPreviewUrlRef.current) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw <= 0 || vh <= 0) return;

      const rect = el.getBoundingClientRect();
      const viewportX = e.clientX - rect.left;
      const viewportY = e.clientY - rect.top;
      const rw = renderedWRef.current;
      const rh = renderedHRef.current;

      const next = applyViewportWheelPanZoom(e, {
        viewportW: vw,
        viewportH: vh,
        viewportX,
        viewportY,
        scrollLeft: mapPanLeftRef.current,
        scrollTop: mapPanTopRef.current,
        mapZoom: mapZoomRef.current,
        minZoom: minZoomRef.current,
        maxZoom: maxZoomRef.current,
        renderedWidthPx: rw,
        renderedHeightPx: rh,
      });
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      mapZoomRef.current = next.mapZoom;
      mapPanLeftRef.current = next.scrollLeft;
      mapPanTopRef.current = next.scrollTop;
      setMapZoom(next.mapZoom);
      setMapPanLeft(next.scrollLeft);
      setMapPanTop(next.scrollTop);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    };

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [canControlMapView, onMapViewSync, schedulePersistView, schedulePersistPlayerViewport, containerWidth, containerHeight, isPlayer]);

  // Categorize elements
  const characters = useMemo(() => activeElements.filter(el => el.elementType === 'character'), [activeElements]);
  const adversaries = useMemo(() => activeElements.filter(el => el.elementType === 'adversary'), [activeElements]);
  const boardTokens = useMemo(
    () => activeElements.filter((el) => el.elementType === 'boardToken'),
    [activeElements],
  );
  const parentByInstanceId = useMemo(() => {
    const m = new Map();
    for (const el of activeElements) {
      if (el.instanceId) m.set(el.instanceId, el);
    }
    return m;
  }, [activeElements]);

  // Build adversary instance numbers (1-based per unique id)
  const instanceNumbers = useMemo(() => {
    const countByAdv = {};
    const result = {};
    for (const el of adversaries) {
      countByAdv[el.id] = (countByAdv[el.id] || 0) + 1;
      result[el.instanceId] = countByAdv[el.id];
    }
    // Only show number if there are multiples with the same id
    const totalById = {};
    for (const el of adversaries) totalById[el.id] = (totalById[el.id] || 0) + 1;
    for (const el of adversaries) {
      if (totalById[el.id] <= 1) result[el.instanceId] = null;
    }
    return result;
  }, [adversaries]);

  const isMyCharacter = useCallback((el) => {
    if (!user) return false;
    return el.assignedPlayerUid === user.uid || el.assignedPlayerEmail === user.email;
  }, [user?.uid, user?.email]);

  const canDrag = useCallback(
    (el) => {
      if (el.elementType === 'boardToken') {
        const parent = parentByInstanceId.get(el.parentInstanceId);
        if (!parent) return false;
        const moveLocked =
          (parent.moveDisabledSources?.length > 0) || (parent.elementType === 'character' && parent.retractedActive);
        if (moveLocked) return false;
        if (!isPlayer) return true;
        return isMyCharacter(parent);
      }
      const moveLocked =
        (el.moveDisabledSources?.length > 0) || (el.elementType === 'character' && el.retractedActive);
      if (moveLocked) return false;
      if (!isPlayer) return true; // GM can drag anything else
      if (el.elementType === 'adversary') return false; // players can't drag adversaries
      return isMyCharacter(el);
    },
    [isPlayer, isMyCharacter, parentByInstanceId],
  );

  // Tray: all characters — unplaced, then active-map proxies, then other-map proxies (click switches map)
  const charTrayTokens = useMemo(
    () => buildCharacterTrayTokenEntries(characters, activeMapIdResolved, isMyCharacter),
    [characters, isMyCharacter, activeMapIdResolved],
  );

  const boardTrayTokens = useMemo(
    () =>
      boardTokens
        .filter((el) => el.tokenX == null)
        .map((el) => ({
          element: el,
          instanceNum: null,
          isMyCharacter: isMyCharacter(parentByInstanceId.get(el.parentInstanceId) || {}),
          isProxy: false,
        })),
    [boardTokens, parentByInstanceId, isMyCharacter],
  );

  const charTrayTokensMerged = useMemo(
    () => [...charTrayTokens, ...boardTrayTokens],
    [charTrayTokens, boardTrayTokens],
  );

  // Players don't see adversary tray. All adversaries — in-tray first, then dim proxies for those on the active map.
  const advTrayTokens = useMemo(() => {
    if (isPlayer) return [];
    const onActive = (el) => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved;
    const inTray = adversaries.filter(el => el.tokenX == null).map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false, isProxy: false }));
    const onMap = adversaries.filter(onActive).map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false, isProxy: true }));
    return [...inTray, ...onMap];
  }, [isPlayer, adversaries, instanceNumbers, activeMapIdResolved]);

  // Map tokens (placed on active map)
  const charMapTokens = useMemo(() =>
    characters
      .filter(el => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved)
      .map(el => ({ element: el, instanceNum: null, isMyCharacter: isMyCharacter(el) })),
    [characters, isMyCharacter, activeMapIdResolved]);

  const boardMapTokens = useMemo(
    () =>
      boardTokens
        .filter((el) => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved)
        .map((el) => ({
          element: el,
          instanceNum: null,
          isMyCharacter: isMyCharacter(parentByInstanceId.get(el.parentInstanceId) || {}),
        })),
    [boardTokens, isMyCharacter, parentByInstanceId, activeMapIdResolved],
  );

  const advMapTokens = useMemo(() =>
    adversaries
      .filter(el => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved)
      .map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false })),
    [adversaries, instanceNumbers, activeMapIdResolved]);

  // All placed tokens for snap detection and range band computation
  const allMapTokens = useMemo(
    () => [...charMapTokens, ...boardMapTokens, ...advMapTokens],
    [charMapTokens, boardMapTokens, advMapTokens],
  );

  const hasPlacedActorsOnMap = useMemo(
    () =>
      activeElements.some(
        (el) =>
          (el.elementType === 'character' ||
            el.elementType === 'adversary' ||
            el.elementType === 'boardToken') &&
          el.tokenX != null &&
          el.tokenY != null &&
          effectiveTokenMapId(el.mapId) === activeMapIdResolved,
      ),
    [activeElements, activeMapIdResolved],
  );

  // Convert client coordinates to map feet, accounting for pan offset and display zoom
  const clientToFt = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const { viewZoom: vz, viewPanLeft: vpl, viewPanTop: vpt } = viewStateRef.current;
    const rect = container.getBoundingClientRect();
    const mapX = (clientX - rect.left + vpl) / vz;
    const mapY = (clientY - rect.top + vpt) / vz;
    return { x: mapX / pxPerFt, y: mapY / pxPerFt };
  }, [pxPerFt]);

  const handleGmSetActiveView = useCallback(
    (viewId) => {
      setMapLetterboxClipPx(null);
      onSetActiveView?.(viewId);
    },
    [onSetActiveView],
  );

  const handleGmMapFreeExplore = useCallback(
    (mapId) => {
      setMapLetterboxClipPx(null);
      onMapFreeExplore?.(mapId);
    },
    [onMapFreeExplore],
  );

  const handleGmSetActiveMap = useCallback(
    (mapId) => {
      setMapLetterboxClipPx(null);
      onSetActiveMap?.(mapId);
    },
    [onSetActiveMap],
  );

  /** Player or GM: jump table view to the map where a shelf token lives (used for other-map character proxies). */
  const navigateShelfToCharacterMap = useCallback(
    (mapId) => {
      const mid = effectiveTokenMapId(mapId);
      if (!isPlayer) {
        onSetActiveMap?.(mid);
        return true;
      }
      const viewsOnMap = mapViews.filter((v) => v.mapId === mid);
      const broadcastView = viewsOnMap.find((v) => v.broadcastToPlayers);
      if (broadcastView) {
        onPlayerSelectView?.(broadcastView.id);
        return true;
      }
      const mapRow = maps.find((m) => m.id === mid);
      if (mapRow && mapRow.shareWithPlayers !== false) {
        onPlayerEnterMapFreeExplore?.(mid);
        return true;
      }
      return false;
    },
    [isPlayer, onSetActiveMap, mapViews, onPlayerSelectView, maps, onPlayerEnterMapFreeExplore],
  );

  const drawEditContext = useMemo(() => {
    if (isPlayer) return null;
    if (!mapConfigHasImage(mapConfig)) return null;
    if (gmActiveViewId) return { kind: 'view', id: gmActiveViewId };
    return { kind: 'map', mapId: activeMapIdResolved };
  }, [isPlayer, mapConfig, gmActiveViewId, activeMapIdResolved]);

  const brushRgba = useMemo(() => hexToRgba(drawColorHex, drawOpacity), [drawColorHex, drawOpacity]);

  const paintScribbleCanvas = useCallback((nowMs) => {
    const canvas = scribbleCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return true;
    const { w, h } = scribbleSizeRef.current;
    if (!w || !h) return true;
    ctx.clearRect(0, 0, w, h);
    const strokes = scribbleStrokesRef.current;
    const keep = [];
    for (const seg of strokes) {
      const age = nowMs - seg.t0;
      if (age >= SCRIBBLE_FADE_MS) continue;
      const fade = 1 - age / SCRIBBLE_FADE_MS;
      const faded = multiplyRgbaAlpha(seg.rgba, fade);
      if (seg.type === 'dot') {
        fillBrushDot(ctx, seg.x, seg.y, seg.r, faded);
      } else {
        strokeDrawSegment(ctx, seg.x0, seg.y0, seg.x1, seg.y1, seg.r, 'brush', faded);
      }
      keep.push(seg);
    }
    scribbleStrokesRef.current = keep;
    return keep.length === 0;
  }, []);

  const scribbleLoop = useCallback(() => {
    scribbleRafRef.current = null;
    const empty = paintScribbleCanvas(Date.now());
    if (!empty) {
      scribbleRafRef.current = requestAnimationFrame(scribbleLoop);
    }
  }, [paintScribbleCanvas]);

  const scheduleScribblePaint = useCallback(() => {
    const empty = paintScribbleCanvas(Date.now());
    if (!empty && scribbleRafRef.current == null) {
      scribbleRafRef.current = requestAnimationFrame(scribbleLoop);
    }
  }, [paintScribbleCanvas, scribbleLoop]);

  /** Send any ink from last broadcast position to current pointer (pointer up / cancel). */
  const flushScribbleTailToPeers = useCallback(() => {
    const endPx = scribbleLastPxRef.current;
    const sid = scribbleStrokeIdRef.current;
    const t0 = scribbleStrokeT0Ref.current;
    const fromPx = scribbleBroadcastLastPxRef.current;
    const sz = scribbleSizeRef.current;
    if (!tableId || !sid || !endPx || !fromPx || !sz?.w) return;
    if (!isNonDegenerateScribbleSegmentPx(fromPx, endPx)) return;
    const f0 = drawPixelToFt(fromPx.x, fromPx.y, mapWidthFt, mapHeightFt, sz);
    const f1 = drawPixelToFt(endPx.x, endPx.y, mapWidthFt, mapHeightFt, sz);
    void postMapScribble(
      tableId,
      {
        id: crypto.randomUUID(),
        _clientId: CLIENT_ID,
        mapId: activeMapIdResolved,
        strokeId: sid,
        t0,
        kind: 'segment',
        x0Ft: f0.x,
        y0Ft: f0.y,
        x1Ft: f1.x,
        y1Ft: f1.y,
        rFt: drawBrushRadiusClampedFt,
        rgba: brushRgba,
      },
      !isPlayer,
    );
  }, [
    tableId,
    activeMapIdResolved,
    mapWidthFt,
    mapHeightFt,
    drawBrushRadiusClampedFt,
    brushRgba,
    isPlayer,
  ]);

  useEffect(() => {
    return () => {
      if (scribbleRafRef.current != null) cancelAnimationFrame(scribbleRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mapConfigHasImage(mapConfig)) {
      scribbleStrokesRef.current = [];
      return;
    }
    const { w, h } = computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
    scribbleSizeRef.current = { w, h };
    scribbleStrokesRef.current = [];
    const c = scribbleCanvasRef.current;
    if (c) {
      c.width = w;
      c.height = h;
    }
    // Deps: `scribbleLayoutKey` only — `mapConfig` reference churn from SSE must not reset the overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapConfig read from latest render when key changes
  }, [scribbleLayoutKey]);

  useEffect(() => {
    if (!mapScribbles?.length) return;
    const size = computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
    scribbleSizeRef.current = size;
    for (const evt of mapScribbles) {
      if (mapScribbleSeenIdsRef.current.has(evt.id)) continue;
      mapScribbleSeenIdsRef.current.add(evt.id);
      if (effectiveTokenMapId(evt.mapId) !== effectiveTokenMapId(activeMapIdResolved)) continue;
      if (evt.kind === 'dot') {
        const p = ftToDrawPixel(evt.xFt, evt.yFt, mapWidthFt, mapHeightFt, size);
        const r = Math.max(1, (evt.rFt / mapWidthFt) * size.w);
        scribbleStrokesRef.current.push({ type: 'dot', x: p.x, y: p.y, r, rgba: evt.rgba, t0: evt.t0 });
      } else if (evt.kind === 'segment') {
        const p0 = ftToDrawPixel(evt.x0Ft, evt.y0Ft, mapWidthFt, mapHeightFt, size);
        const p1 = ftToDrawPixel(evt.x1Ft, evt.y1Ft, mapWidthFt, mapHeightFt, size);
        const r = Math.max(1, (evt.rFt / mapWidthFt) * size.w);
        scribbleStrokesRef.current.push({
          type: 'segment',
          x0: p0.x,
          y0: p0.y,
          x1: p1.x,
          y1: p1.y,
          r,
          rgba: evt.rgba,
          t0: evt.t0,
        });
      }
    }
    scheduleScribblePaint();
  }, [mapScribbles, mapWidthFt, mapHeightFt, activeMapIdResolved, scheduleScribblePaint]);

  const mapOverlayPngSrc = useMemo(
    () => getRowOverlayPng(maps.find((m) => m.id === activeMapIdResolved)),
    [maps, activeMapIdResolved],
  );

  const cameraOverlayPngSrc = useMemo(() => {
    if (isPlayer) {
      if (playerFreeMapExplore) return null;
      return getRowOverlayPng(mapViews.find((v) => v.id === playerSelectedViewId));
    }
    if (gmActiveViewId) {
      return getRowOverlayPng(mapViews.find((v) => v.id === gmActiveViewId));
    }
    return null;
  }, [isPlayer, gmActiveViewId, playerFreeMapExplore, playerSelectedViewId, mapViews]);

  const editableDrawSourceUrl = useMemo(() => {
    if (!drawEditContext) return null;
    if (drawEditContext.kind === 'map') return mapOverlayPngSrc;
    return getRowOverlayPng(mapViews.find((v) => v.id === drawEditContext.id));
  }, [drawEditContext, mapOverlayPngSrc, mapViews]);

  const clientToDrawPx = useCallback(
    (clientX, clientY) => {
      const ft = clientToFt(clientX, clientY);
      if (!ft) return null;
      if (ft.x < 0 || ft.x > mapWidthFt || ft.y < 0 || ft.y > mapHeightFt) return null;
      const fs = drawSizeRef.current;
      const { w, h } =
        fs && fs.w > 0 && fs.h > 0
          ? fs
          : computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
      return ftToDrawPixel(ft.x, ft.y, mapWidthFt, mapHeightFt, { w, h });
    },
    [clientToFt, mapWidthFt, mapHeightFt],
  );

  const clampDrawPx = useCallback((p, w, h) => {
    if (!p) return null;
    return {
      x: Math.max(0, Math.min(w, p.x)),
      y: Math.max(0, Math.min(h, p.y)),
    };
  }, []);

  const applyEyedropperAtClient = useCallback(
    (clientX, clientY) => {
      const p = clientToDrawPx(clientX, clientY);
      if (!p) return false;
      const size =
        drawSizeRef.current.w > 0 ? drawSizeRef.current : computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
      const { w, h } = size;
      const px = Math.floor(p.x);
      const py = Math.floor(p.y);
      if (px < 0 || py < 0 || px >= w || py >= h) return false;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;

      const fillBlank = () => {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--color-dh-map-blank').trim();
        ctx.fillStyle = v || 'rgb(15, 23, 42)';
        ctx.fillRect(0, 0, w, h);
      };

      /** Map image only — no fog overlay, draw layer, or scribbles. */
      try {
        const mapImg = mapImageRef.current;
        if (mapImg?.complete && mapImg.naturalWidth > 0) {
          ctx.drawImage(mapImg, 0, 0, w, h);
        } else {
          fillBlank();
        }
      } catch {
        fillBlank();
      }

      let data;
      try {
        data = ctx.getImageData(px, py, 1, 1).data;
      } catch {
        return false;
      }
      const a = data[3] / 255;
      setDrawColorHex(rgbBytesToHex(data[0], data[1], data[2]));
      setDrawOpacity(Math.min(1, Math.max(0.05, a)));
      return true;
    },
    [clientToDrawPx, mapWidthFt, mapHeightFt],
  );

  const commitOverlayPng = useCallback(
    async (png) => {
      if (!drawEditContext || isPlayer) return;
      try {
        if (drawEditContext.kind === 'map') {
          onSetMapOverlay?.(drawEditContext.mapId, png);
        } else {
          onSetMapViewOverlay?.(drawEditContext.id, png);
        }
      } catch (err) {
        console.error('[BattleMap] map draw save failed:', err);
      }
    },
    [drawEditContext, isPlayer, onSetMapOverlay, onSetMapViewOverlay],
  );

  useEffect(() => {
    if (isPlayer) return;
    if (drawTool !== 'brush' && drawTool !== 'eraser' && drawTool !== 'rect' && drawTool !== 'oval') return;
    const c = drawPaintRef.current;
    if (!c) return;
    const { w, h } = computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
    drawSizeRef.current = { w, h };
    if (drawBrushActiveRef.current || drawShapeDragRef.current) return;
    void loadDrawDataUrlOntoCanvas(editableDrawSourceUrl, c, { w, h });
  }, [isPlayer, drawTool, mapWidthFt, mapHeightFt, editableDrawSourceUrl]);

  useEffect(() => {
    if (isPlayer) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        drawEraserPendingRef.current = null;
        setDrawTool('scribble');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlayer]);

  useEffect(() => {
    if (!brushPreviewControlsActive) return;
    const end = () => setBrushPreviewControlsActive(false);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [brushPreviewControlsActive]);

  const handleScribbleClear = useCallback(() => {
    if (!mapConfigHasImage(mapConfig)) return;
    if (!window.confirm(isPlayer ? 'Clear your scribbles?' : 'Clear all scribbles on your screen?')) return;
    scribbleStrokesRef.current = [];
    const c = scribbleCanvasRef.current;
    const { w, h } = scribbleSizeRef.current;
    if (c && w && h) {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, w, h);
    }
  }, [mapConfig, isPlayer]);

  const handleDrawPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (drawEyedropperActive) {
        e.preventDefault();
        e.stopPropagation();
        if (applyEyedropperAtClient(e.clientX, e.clientY)) {
          setDrawEyedropperActive(false);
        }
        return;
      }
      if (drawTool === 'scribble' || isPlayer) {
        e.preventDefault();
        e.stopPropagation();
        const c = scribbleCanvasRef.current;
        if (!c) return;
        const size = computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
        if (c.width !== size.w || c.height !== size.h) {
          c.width = size.w;
          c.height = size.h;
          scribbleStrokesRef.current = [];
        }
        scribbleSizeRef.current = size;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const { w, h } = size;
        const p0 = clientToDrawPx(e.clientX, e.clientY);
        if (!p0) return;
        const p = clampDrawPx(p0, w, h);
        const rw = w;
        const r = Math.max(1, (drawBrushRadiusClampedFt / mapWidthFt) * rw);
        const t0 = Date.now();
        scribbleStrokeT0Ref.current = t0;
        const strokeId = crypto.randomUUID();
        scribbleStrokeIdRef.current = strokeId;
        scribbleStrokesRef.current.push({ type: 'dot', x: p.x, y: p.y, r, rgba: brushRgba, t0 });
        scribbleBrushActiveRef.current = true;
        setMapDrawCaptureActive(true);
        scribbleLastPxRef.current = p;
        scheduleScribblePaint();
        if (tableId) {
          const ft = drawPixelToFt(p.x, p.y, mapWidthFt, mapHeightFt, size);
          void postMapScribble(
            tableId,
            {
              id: crypto.randomUUID(),
              _clientId: CLIENT_ID,
              mapId: activeMapIdResolved,
              strokeId,
              t0,
              kind: 'dot',
              xFt: ft.x,
              yFt: ft.y,
              rFt: drawBrushRadiusClampedFt,
              rgba: brushRgba,
            },
            !isPlayer,
          );
        }
        scribbleBroadcastLastPxRef.current = p;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          mapDrawCapturePointerIdRef.current = e.pointerId;
        } catch {
          /* ignore */
        }
        return;
      }
      if (isPlayer) return;
      e.preventDefault();
      e.stopPropagation();
      const c = drawPaintRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const { w, h } = drawSizeRef.current;

      if (drawTool === 'rect' || drawTool === 'oval') {
        const p0 = clientToDrawPx(e.clientX, e.clientY);
        if (!p0) return;
        const p = clampDrawPx(p0, w, h);
        try {
          const snapshot = ctx.getImageData(0, 0, w, h);
          drawShapeDragRef.current = {
            snapshot,
            startX: p.x,
            startY: p.y,
            tool: drawTool,
            filled: drawTool === 'rect' ? rectShapeFilled : ovalShapeFilled,
          };
          setMapDrawCaptureActive(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          mapDrawCapturePointerIdRef.current = e.pointerId;
        } catch {
          /* ignore */
        }
        return;
      }

      if (drawTool !== 'brush' && drawTool !== 'eraser') return;
      const p = clientToDrawPx(e.clientX, e.clientY);
      if (!p) return;
      const { w: rw } = drawSizeRef.current;
      const r = Math.max(1, (drawBrushRadiusClampedFt / mapWidthFt) * rw);
      if (drawTool === 'eraser') {
        drawEraserPendingRef.current = {
          startClientX: e.clientX,
          startClientY: e.clientY,
          startPx: { x: p.x, y: p.y },
        };
        setMapDrawCaptureActive(true);
      } else {
        drawBrushActiveRef.current = true;
        setMapDrawCaptureActive(true);
        drawLastPxRef.current = { x: p.x, y: p.y };
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alphaFromRgbaString(brushRgba);
        ctx.fillStyle = rgbStringFromRgba(brushRgba);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
        mapDrawCapturePointerIdRef.current = e.pointerId;
      } catch {
        /* ignore */
      }
    },
    [
      isPlayer,
      drawTool,
      clientToDrawPx,
      clampDrawPx,
      drawBrushRadiusClampedFt,
      mapWidthFt,
      mapHeightFt,
      brushRgba,
      rectShapeFilled,
      ovalShapeFilled,
      scheduleScribblePaint,
      tableId,
      activeMapIdResolved,
      drawEyedropperActive,
      applyEyedropperAtClient,
    ],
  );

  const handleDrawPointerMove = useCallback(
    (e) => {
      if (drawTool === 'scribble' || isPlayer) {
        if (!scribbleBrushActiveRef.current) return;
        const p = clientToDrawPx(e.clientX, e.clientY);
        if (!p) return;
        const { w, h } = scribbleSizeRef.current;
        if (!w || !h) return;
        const cur = clampDrawPx(p, w, h);
        const last = scribbleLastPxRef.current;
        const rw = w;
        const rad = Math.max(1, (drawBrushRadiusClampedFt / mapWidthFt) * rw);
        const t0 = scribbleStrokeT0Ref.current;
        if (last) {
          scribbleStrokesRef.current.push({
            type: 'segment',
            x0: last.x,
            y0: last.y,
            x1: cur.x,
            y1: cur.y,
            r: rad,
            rgba: brushRgba,
            t0,
          });
        }
        scribbleLastPxRef.current = cur;
        scheduleScribblePaint();
        if (tableId && scribbleStrokeIdRef.current) {
          const tPerf = performance.now();
          if (tPerf - scribbleBroadcastLastSentRef.current >= 40) {
            const fromPx = scribbleBroadcastLastPxRef.current;
            if (fromPx && isNonDegenerateScribbleSegmentPx(fromPx, cur)) {
              scribbleBroadcastLastSentRef.current = tPerf;
              const sz = scribbleSizeRef.current;
              const f0 = drawPixelToFt(fromPx.x, fromPx.y, mapWidthFt, mapHeightFt, sz);
              const f1 = drawPixelToFt(cur.x, cur.y, mapWidthFt, mapHeightFt, sz);
              void postMapScribble(
                tableId,
                {
                  id: crypto.randomUUID(),
                  _clientId: CLIENT_ID,
                  mapId: activeMapIdResolved,
                  strokeId: scribbleStrokeIdRef.current,
                  t0,
                  kind: 'segment',
                  x0Ft: f0.x,
                  y0Ft: f0.y,
                  x1Ft: f1.x,
                  y1Ft: f1.y,
                  rFt: drawBrushRadiusClampedFt,
                  rgba: brushRgba,
                },
                !isPlayer,
              );
              scribbleBroadcastLastPxRef.current = cur;
            }
          }
        }
        return;
      }
      if (isPlayer) return;
      const c = drawPaintRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const { w, h } = drawSizeRef.current;

      const shape = drawShapeDragRef.current;
      if (shape) {
        const p0 = clientToDrawPx(e.clientX, e.clientY);
        if (!p0) return;
        const cur = clampDrawPx(p0, w, h);
        try {
          ctx.putImageData(shape.snapshot, 0, 0);
        } catch {
          return;
        }
        const x0 = Math.min(shape.startX, cur.x);
        const x1 = Math.max(shape.startX, cur.x);
        const y0 = Math.min(shape.startY, cur.y);
        const y1 = Math.max(shape.startY, cur.y);
        ctx.save();
        ctx.strokeStyle = brushRgba;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        if (shape.tool === 'rect') {
          ctx.strokeRect(x0, y0, Math.max(x1 - x0, 0.5), Math.max(y1 - y0, 0.5));
        } else {
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          const rx = Math.max((x1 - x0) / 2, 0.5);
          const ry = Math.max((y1 - y0) / 2, 0.5);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      const eraserPending = drawEraserPendingRef.current;
      if (eraserPending && drawTool === 'eraser' && !drawBrushActiveRef.current) {
        const dx = e.clientX - eraserPending.startClientX;
        const dy = e.clientY - eraserPending.startClientY;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
          drawEraserPendingRef.current = null;
          const p = clientToDrawPx(e.clientX, e.clientY);
          if (!p) return;
          const { w: rw } = drawSizeRef.current;
          const rad = Math.max(1, (drawBrushRadiusClampedFt / mapWidthFt) * rw);
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = ERASER_DESTINATION_OUT;
          ctx.beginPath();
          ctx.arc(eraserPending.startPx.x, eraserPending.startPx.y, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          drawBrushActiveRef.current = true;
          drawLastPxRef.current = eraserPending.startPx;
          const cur = clampDrawPx(p, w, h);
          strokeDrawSegment(
            ctx,
            eraserPending.startPx.x,
            eraserPending.startPx.y,
            cur.x,
            cur.y,
            rad,
            'eraser',
            brushRgba,
          );
          drawLastPxRef.current = cur;
        }
        return;
      }

      if (!drawBrushActiveRef.current) return;
      if (drawTool !== 'brush' && drawTool !== 'eraser') return;
      const p = clientToDrawPx(e.clientX, e.clientY);
      if (!p) return;
      const last = drawLastPxRef.current;
      const { w: rw } = drawSizeRef.current;
      const rad = Math.max(1, (drawBrushRadiusClampedFt / mapWidthFt) * rw);
      if (last) {
        strokeDrawSegment(ctx, last.x, last.y, p.x, p.y, rad, drawTool, brushRgba);
      }
      drawLastPxRef.current = { x: p.x, y: p.y };
    },
    [
      isPlayer,
      drawTool,
      clientToDrawPx,
      clampDrawPx,
      drawBrushRadiusClampedFt,
      mapWidthFt,
      brushRgba,
      scheduleScribblePaint,
      tableId,
      activeMapIdResolved,
    ],
  );

  const handleDrawPointerUp = useCallback(
    async (e) => {
      try {
      if (drawTool === 'scribble' || isPlayer) {
        if (!scribbleBrushActiveRef.current) return;
        flushScribbleTailToPeers();
        scribbleBrushActiveRef.current = false;
        scribbleLastPxRef.current = null;
        scribbleStrokeIdRef.current = null;
        scribbleBroadcastLastPxRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      const eraserPending = drawEraserPendingRef.current;
      if (eraserPending && drawTool === 'eraser') {
        drawEraserPendingRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        if (!drawBrushActiveRef.current) {
          const c = drawPaintRef.current;
          const ctx = c?.getContext('2d');
          if (c && ctx) {
            const { w, h } = drawSizeRef.current;
            const changed = floodEraseConnectedComponent(
              ctx,
              w,
              h,
              eraserPending.startPx.x,
              eraserPending.startPx.y,
            );
            if (changed) {
              const png = c.toDataURL('image/png');
              await commitOverlayPng(png);
            }
          }
          return;
        }
      }

      const shape = drawShapeDragRef.current;
      if (shape) {
        drawShapeDragRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        const c = drawPaintRef.current;
        const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        const { w, h } = drawSizeRef.current;
        const p0 = clientToDrawPx(e.clientX, e.clientY);
        if (!p0) return;
        const cur = clampDrawPx(p0, w, h);
        try {
          ctx.putImageData(shape.snapshot, 0, 0);
        } catch {
          return;
        }
        const x0 = Math.min(shape.startX, cur.x);
        const x1 = Math.max(shape.startX, cur.x);
        const y0 = Math.min(shape.startY, cur.y);
        const y1 = Math.max(shape.startY, cur.y);
        const lineW = Math.max(1, 2 * (drawBrushRadiusClampedFt / mapWidthFt) * w);
        if (shape.filled) {
          if (shape.tool === 'rect') {
            fillDrawRect(ctx, x0, y0, x1, y1, 'brush', brushRgba);
          } else {
            fillDrawEllipse(ctx, x0, y0, x1, y1, 'brush', brushRgba);
          }
        } else if (shape.tool === 'rect') {
          strokeOutlineRect(ctx, x0, y0, x1, y1, lineW, brushRgba);
        } else {
          strokeOutlineEllipse(ctx, x0, y0, x1, y1, lineW, brushRgba);
        }
        const png = c.toDataURL('image/png');
        await commitOverlayPng(png);
        return;
      }

      if (!drawBrushActiveRef.current) return;
      drawBrushActiveRef.current = false;
      drawLastPxRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const c = drawPaintRef.current;
      if (c) {
        const png = c.toDataURL('image/png');
        await commitOverlayPng(png);
      }
      } finally {
        mapDrawCapturePointerIdRef.current = null;
        setMapDrawCaptureActive(false);
      }
    },
    [
      clientToDrawPx,
      clampDrawPx,
      brushRgba,
      commitOverlayPng,
      drawTool,
      drawBrushRadiusClampedFt,
      mapWidthFt,
      isPlayer,
      flushScribbleTailToPeers,
    ],
  );

  const handleDrawPointerCancel = useCallback(
    async (e) => {
      try {
      if (drawTool === 'scribble' || isPlayer) {
        if (scribbleBrushActiveRef.current) {
          flushScribbleTailToPeers();
        }
        scribbleBrushActiveRef.current = false;
        scribbleLastPxRef.current = null;
        scribbleStrokeIdRef.current = null;
        scribbleBroadcastLastPxRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      if (drawShapeDragRef.current) {
        const shape = drawShapeDragRef.current;
        drawShapeDragRef.current = null;
        const c = drawPaintRef.current;
        const ctx = c?.getContext('2d');
        if (ctx && c) {
          try {
            ctx.putImageData(shape.snapshot, 0, 0);
          } catch {
            /* ignore */
          }
        }
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      if (drawEraserPendingRef.current) {
        drawEraserPendingRef.current = null;
        drawBrushActiveRef.current = false;
        drawLastPxRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      await handleDrawPointerUp(e);
      } finally {
        mapDrawCapturePointerIdRef.current = null;
        setMapDrawCaptureActive(false);
      }
    },
    [handleDrawPointerUp, drawTool, isPlayer, flushScribbleTailToPeers],
  );

  /** End draw/scribble stroke without relying on canvas target (second finger starts pinch on iPad). */
  const abortActiveMapDrawForPinch = useCallback(() => {
    const pid = mapDrawCapturePointerIdRef.current;
    if (pid != null) {
      for (const node of [scribbleCanvasRef.current, drawPaintRef.current]) {
        if (!node) continue;
        try {
          node.releasePointerCapture(pid);
        } catch {
          /* ignore */
        }
      }
      mapDrawCapturePointerIdRef.current = null;
    }

    if (scribbleBrushActiveRef.current) {
      flushScribbleTailToPeers();
    }
    scribbleBrushActiveRef.current = false;
    scribbleLastPxRef.current = null;
    scribbleStrokeIdRef.current = null;
    scribbleBroadcastLastPxRef.current = null;

    if (drawShapeDragRef.current) {
      const shape = drawShapeDragRef.current;
      drawShapeDragRef.current = null;
      const c = drawPaintRef.current;
      const ctx = c?.getContext('2d');
      if (ctx && c && shape.snapshot) {
        try {
          ctx.putImageData(shape.snapshot, 0, 0);
        } catch {
          /* ignore */
        }
      }
    }

    if (drawEraserPendingRef.current) {
      drawEraserPendingRef.current = null;
    }

    if (drawBrushActiveRef.current) {
      const commitStroke = drawTool === 'brush' || drawTool === 'eraser';
      drawBrushActiveRef.current = false;
      drawLastPxRef.current = null;
      if (commitStroke && drawPaintRef.current) {
        const png = drawPaintRef.current.toDataURL('image/png');
        void commitOverlayPng(png);
      }
    }

    setMapDrawCaptureActive(false);
  }, [flushScribbleTailToPeers, drawTool, commitOverlayPng]);

  useEffect(() => {
    if (!canControlMapView) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const pointers = mapPinchPointersRef.current;

    const pinchDistance = () => {
      const vals = [...pointers.values()];
      if (vals.length < 2) return 0;
      const dx = vals[1].x - vals[0].x;
      const dy = vals[1].y - vals[0].y;
      return Math.hypot(dx, dy);
    };

    const onPointerDownCapture = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        abortActiveMapDrawForPinch();
        mapPinchActiveRef.current = true;
        const d0 = pinchDistance();
        mapPinchLastDistanceRef.current = d0 > 1e-6 ? d0 : 1;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const onPointerMoveCapture = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!mapPinchActiveRef.current || pointers.size < 2) return;
      if (mapAiGenPreviewUrlRef.current) return;

      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw <= 0 || vh <= 0) return;

      const newDist = pinchDistance();
      const lastDist = mapPinchLastDistanceRef.current;
      if (newDist < 1e-6 || lastDist < 1e-6) return;
      const ratio = newDist / lastDist;
      mapPinchLastDistanceRef.current = newDist;

      const oldZ = mapZoomRef.current;
      const newZ = clampMapZoom(oldZ * ratio, minZoomRef.current, maxZoomRef.current);
      if (newZ === oldZ) return;

      const rect = el.getBoundingClientRect();
      const vals = [...pointers.values()];
      const viewportX = (vals[0].x + vals[1].x) / 2 - rect.left;
      const viewportY = (vals[0].y + vals[1].y) / 2 - rect.top;

      const pan = scrollAfterZoomTowardPoint({
        scrollLeft: mapPanLeftRef.current,
        scrollTop: mapPanTopRef.current,
        viewportX,
        viewportY,
        oldZoom: oldZ,
        newZoom: newZ,
        innerWidthPx: renderedWRef.current,
        innerHeightPx: renderedHRef.current,
        viewportW: vw,
        viewportH: vh,
      });

      mapZoomRef.current = newZ;
      mapPanLeftRef.current = pan.scrollLeft;
      mapPanTopRef.current = pan.scrollTop;
      setMapZoom(newZ);
      setMapPanLeft(pan.scrollLeft);
      setMapPanTop(pan.scrollTop);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();

      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const onPointerUpCapture = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        mapPinchActiveRef.current = false;
        mapPinchLastDistanceRef.current = 0;
      }
    };

    el.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    el.addEventListener('pointermove', onPointerMoveCapture, { capture: true });
    el.addEventListener('pointerup', onPointerUpCapture, { capture: true });
    el.addEventListener('pointercancel', onPointerUpCapture, { capture: true });
    return () => {
      pointers.clear();
      mapPinchActiveRef.current = false;
      el.removeEventListener('pointerdown', onPointerDownCapture, { capture: true });
      el.removeEventListener('pointermove', onPointerMoveCapture, { capture: true });
      el.removeEventListener('pointerup', onPointerUpCapture, { capture: true });
      el.removeEventListener('pointercancel', onPointerUpCapture, { capture: true });
    };
  }, [canControlMapView, abortActiveMapDrawForPinch, onMapViewSync, schedulePersistView, schedulePersistPlayerViewport, isPlayer]);

  const handleDrawClearAll = useCallback(() => {
    if (!drawEditContext || isPlayer) return;
    if (!window.confirm('Clear all drawings on this layer?')) return;
    const { w, h } = computeMapDrawCanvasSize(mapWidthFt, mapHeightFt);
    const c = drawPaintRef.current;
    if (c) clearDrawCanvas(c, { w, h });
    void commitOverlayPng(null);
    if (
      (drawTool === 'brush' || drawTool === 'eraser' || drawTool === 'rect' || drawTool === 'oval') &&
      drawPaintRef.current
    ) {
      void loadDrawDataUrlOntoCanvas(null, drawPaintRef.current, { w, h });
    }
  }, [drawEditContext, isPlayer, mapWidthFt, mapHeightFt, commitOverlayPng, drawTool]);

  const showDrawPaintCanvas =
    !isPlayer &&
    (drawTool === 'brush' || drawTool === 'eraser' || drawTool === 'rect' || drawTool === 'oval') &&
    drawEditContext;
  const showScribbleCanvas = mapConfigHasImage(mapConfig);
  const drawLayerBlockedByTokenHover = hoveringTokenBlocksDraw && !mapDrawCaptureActive;
  const scribbleCanvasPointerEvents =
    drawTool === 'scribble' || isPlayer
      ? drawLayerBlockedByTokenHover
        ? 'none'
        : 'auto'
      : 'none';
  const scribbleCanvasZ =
    showDrawPaintCanvas && drawTool !== 'scribble' ? 19 : 21;
  /** Brush radius in screen pixels (matches stroke width at current zoom). */
  const brushRadiusPreviewScreenPx = drawBrushRadiusClampedFt * pxPerFt * viewZoom;

  // Find a placed token whose bounding box contains the given client point
  const findTokenAtClient = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const mapX = (clientX - rect.left + viewPanLeft) / viewZoom;
    const mapY = (clientY - rect.top + viewPanTop) / viewZoom;
    const halfToken = tokenSizePx / 2;
    for (const { element } of allMapTokens) {
      if (element.tokenX == null) continue;
      const cx = element.tokenX * pxPerFt + halfToken;
      const cy = element.tokenY * pxPerFt + halfToken;
      if (Math.abs(mapX - cx) <= halfToken && Math.abs(mapY - cy) <= halfToken) {
        return element;
      }
    }
    return null;
  }, [allMapTokens, pxPerFt, tokenSizePx, viewZoom, viewPanLeft, viewPanTop]);

  // Handle pointer move over the map canvas area (not trays)
  const handleMapPointerMove = useCallback((e) => {
    if (panRightDragRef.current) return;
    const overToken = findTokenAtClient(e.clientX, e.clientY);
    setHoveringTokenBlocksDraw(!!overToken);
    // During an active drag, the bullseye is frozen at the drag origin — don't update
    if (frozenBullseyeRef.current) {
      scheduleBullseyeFt(frozenBullseyeRef.current);
      return;
    }
    // Snap to token center if hovering over a placed token (reuse the lookup above — same point).
    if (overToken) {
      scheduleBullseyeFt({ x: overToken.tokenX + 2.5, y: overToken.tokenY + 2.5, excludeInstanceId: overToken.instanceId });
    } else {
      const ft = clientToFt(e.clientX, e.clientY);
      if (ft) scheduleBullseyeFt(ft);
    }
  }, [findTokenAtClient, clientToFt, scheduleBullseyeFt]);

  const handleMapPointerLeave = useCallback(() => {
    setHoveringTokenBlocksDraw(false);
    if (!frozenBullseyeRef.current) scheduleBullseyeFt(null);
  }, [scheduleBullseyeFt]);

  const handleMapPingPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (drawEyedropperActive) {
      e.preventDefault();
      e.stopPropagation();
      if (applyEyedropperAtClient(e.clientX, e.clientY)) {
        setDrawEyedropperActive(false);
      }
      return;
    }
    if (!tableId) return;
    if (panRightDragRef.current) return;
    if (
      !isPlayer &&
      (drawTool === 'brush' ||
        drawTool === 'eraser' ||
        drawTool === 'rect' ||
        drawTool === 'oval' ||
        drawTool === 'scribble')
    )
      return;
    mapPingTapRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    const onUp = async (e2) => {
      if (e2.pointerId !== mapPingTapRef.current?.pointerId) return;
      window.removeEventListener('pointerup', onUp);
      mapPingPointerUpRef.current = null;
      const d = mapPingTapRef.current;
      mapPingTapRef.current = null;
      if (!d) return;
      const dx = e2.clientX - d.x;
      const dy = e2.clientY - d.y;
      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      const ft = clientToFt(e2.clientX, e2.clientY);
      if (!ft) return;
      if (ft.x < 0 || ft.x > mapWidthFt || ft.y < 0 || ft.y > mapHeightFt) return;
      const res = await postMapPing(tableId, { xFt: ft.x, yFt: ft.y, mapId: activeMapIdResolved }, !isPlayer);
      if (res?.ping) appendMapPing(res.ping);
    };
    mapPingPointerUpRef.current = onUp;
    window.addEventListener('pointerup', onUp);
  }, [
    tableId,
    clientToFt,
    mapWidthFt,
    mapHeightFt,
    activeMapIdResolved,
    isPlayer,
    appendMapPing,
    drawTool,
    drawEyedropperActive,
    applyEyedropperAtClient,
  ]);

  useEffect(() => () => {
    if (mapPingPointerUpRef.current) {
      window.removeEventListener('pointerup', mapPingPointerUpRef.current);
      mapPingPointerUpRef.current = null;
    }
  }, []);

  // Compute range band index (0–4) for each placed token based on distance to bullseye.
  // During drag from map, use the follow bullseye (moving) so highlights reflect the token being moved.
  const tokenRangeBands = useMemo(() => {
    const center = followBullseyeFt ?? bullseyeFt;
    if (!center) return {};
    const result = {};
    for (const { element } of allMapTokens) {
      if (element.tokenX == null) continue;
      if (element.instanceId === center.excludeInstanceId) continue;
      const dx = (element.tokenX + 2.5) - center.x;
      const dy = (element.tokenY + 2.5) - center.y;
      // Use nearest-edge distance: subtract token radius so any overlap with a band counts (shared with map-range)
      const dist = Math.max(0, Math.sqrt(dx * dx + dy * dy) - 2.5);
      const bandIdx = getRangeBandIndexForDistanceFt(dist);
      result[element.instanceId] = bandIdx; // -1 means Out of Range
    }
    return result;
  }, [bullseyeFt, followBullseyeFt, allMapTokens]);

  // Dragged token's range band relative to the static (left-behind) bullseye, for ghost highlight
  const draggedTokenRangeBandFromStatic = useMemo(() => {
    if (!bullseyeFt || !followBullseyeFt) return null;
    const dx = followBullseyeFt.x - bullseyeFt.x;
    const dy = followBullseyeFt.y - bullseyeFt.y;
    const dist = Math.max(0, Math.sqrt(dx * dx + dy * dy) - 2.5);
    const bandIdx = getRangeBandIndexForDistanceFt(dist);
    return bandIdx >= 0 ? RANGE_BANDS[bandIdx] : null;
  }, [bullseyeFt, followBullseyeFt]);

  // ─── Drag handlers ──────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e, element, fromTray) => {
    if (e.button !== 0) return;
    /** Players can't drag adversaries, but they should still click-to-pin the token detail panel. */
    const pinOnly =
      !fromTray &&
      isPlayer &&
      element.elementType === 'adversary' &&
      !canDrag(element);
    if (!canDrag(element) && !pinOnly) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const tokenSize = fromTray ? trayTokenSizePx : tokenSizePx;

    // Compute where on the token the user grabbed, so the ghost stays aligned
    // and the drop lands exactly where the ghost was.
    let grabOffsetX = tokenSize / 2;
    let grabOffsetY = tokenSize / 2;
    if (!fromTray && element.tokenX != null) {
      const container = scrollContainerRef.current;
      if (container) {
        const { viewZoom: vz, viewPanLeft: vpl, viewPanTop: vpt } = viewStateRef.current;
        const rect = container.getBoundingClientRect();
        const tokenClientX = element.tokenX * pxPerFt * vz - vpl + rect.left;
        const tokenClientY = element.tokenY * pxPerFt * vz - vpt + rect.top;
        grabOffsetX = Math.max(0, Math.min(tokenSize, e.clientX - tokenClientX));
        grabOffsetY = Math.max(0, Math.min(tokenSize, e.clientY - tokenClientY));
      }
    }

    const myChar =
      element.elementType === 'boardToken'
        ? isMyCharacter(parentByInstanceId.get(element.parentInstanceId) || {})
        : isMyCharacter(element);
    dragRef.current = {
      instanceId: element.instanceId,
      element,
      fromTray,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      pinOnly: !!pinOnly,
      pointerId: e.pointerId,
      instanceNum: instanceNumbers[element.instanceId],
      myChar,
      tokenSize,
      grabOffsetX,
      grabOffsetY,
      prevTokenFt:
        element.tokenX != null && element.tokenY != null
          ? { tokenX: element.tokenX, tokenY: element.tokenY }
          : null,
    };
  }, [canDrag, instanceNumbers, isMyCharacter, isPlayer, trayTokenSizePx, tokenSizePx, pxPerFt, parentByInstanceId]);

  const handlePointerMove = useCallback((e) => {
    const ds = dragRef.current;
    if (!ds) return;
    if (ds.pinOnly) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.isDragging && (dx * dx + dy * dy) >= DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      ds.isDragging = true;
      // Freeze bullseye at the dragged token's origin center
      const el = ds.element;
      if (el.tokenX != null) {
        frozenBullseyeRef.current = { x: el.tokenX + 2.5, y: el.tokenY + 2.5, excludeInstanceId: el.instanceId };
        setBullseyeFt(frozenBullseyeRef.current);
      }
    }
    if (ds.isDragging) {
      setDragGhost({
        element: ds.element,
        clientX: e.clientX,
        clientY: e.clientY,
        instanceNum: ds.instanceNum,
        isMyChar: ds.myChar,
        tokenSize: ds.tokenSize,
        grabOffsetX: ds.grabOffsetX,
        grabOffsetY: ds.grabOffsetY,
        fromTray: ds.fromTray,
      });
      setHighlightLeftTray(pointInRect(e.clientX, e.clientY, leftTrayRef.current));
      setHighlightRightTray(!isPlayer && pointInRect(e.clientX, e.clientY, rightTrayRef.current));
      // Update follow bullseye at ghost center when we have a frozen origin (drag from map)
      if (frozenBullseyeRef.current) {
        const ghostCenterX = e.clientX - ds.grabOffsetX + ds.tokenSize / 2;
        const ghostCenterY = e.clientY - ds.grabOffsetY + ds.tokenSize / 2;
        let ft = clientToFt(ghostCenterX, ghostCenterY);
        if (ft) {
          ft = {
            x: Math.max(0, Math.min(mapWidthFt, ft.x)),
            y: Math.max(0, Math.min(mapHeightFt, ft.y)),
            excludeInstanceId: ds.element.instanceId,
          };
        }
        setFollowBullseyeFt(ft);
      }
    }
  }, [isPlayer, clientToFt, mapWidthFt, mapHeightFt]);

  const handlePointerUp = useCallback((e) => {
    const ds = dragRef.current;
    dragRef.current = null;
    setDragGhost(null);
    setHighlightLeftTray(false);
    setHighlightRightTray(false);
    setFollowBullseyeFt(null);
    // Unfreeze bullseye after drag end
    frozenBullseyeRef.current = null;

    if (!ds) return;

    if (!ds.isDragging) {
      if (ds.fromTray && ds.element.tokenX != null && ds.element.tokenY != null) {
        const tokenMap = effectiveTokenMapId(ds.element.mapId);
        if (tokenMap !== activeMapIdResolved) {
          if (navigateShelfToCharacterMap(ds.element.mapId)) {
            pendingShelfNavigateCenterInstanceIdRef.current = ds.element.instanceId;
          }
          return;
        }
        if (canControlMapView) {
          centerMapOnPlacedActor(ds.element);
        }
      }
      // Click: toggle pin
      setPinnedToken(prev => {
        if (prev?.element.instanceId === ds.element.instanceId) return null;
        return { element: ds.element, anchorX: e.clientX, anchorY: e.clientY };
      });
      return;
    }

    // Dropped in a tray?
    const inLeftTray = pointInRect(e.clientX, e.clientY, leftTrayRef.current);
    const inRightTray = !isPlayer && pointInRect(e.clientX, e.clientY, rightTrayRef.current);

    if (inLeftTray || inRightTray) {
      if (!ds.fromTray) {
        updateActiveElement(ds.instanceId, { tokenX: null, tokenY: null, mapId: null });
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
        const postMove = activeElements.map((el) =>
          el.instanceId === ds.instanceId ? { ...el, tokenX: null, tokenY: null, mapId: null } : el
        );
        onTokenDragEnd?.({
          instanceId: ds.instanceId,
          previousTokenFt: ds.prevTokenFt,
          nextTokenFt: null,
          fromTray: false,
          postMoveActiveElements: postMove,
        });
      }
      return;
    }

    // Dropped on map?
    const container = scrollContainerRef.current;
    if (container) {
      const { viewZoom: vz, viewPanLeft: vpl, viewPanTop: vpt } = viewStateRef.current;
      const rect = container.getBoundingClientRect();
      // Subtract grab offset so the token's top-left lands where the ghost was,
      // not where the raw cursor was.
      const mapX =
        (e.clientX - rect.left + vpl) / vz - (ds.grabOffsetX ?? ds.tokenSize / 2);
      const mapY =
        (e.clientY - rect.top + vpt) / vz - (ds.grabOffsetY ?? ds.tokenSize / 2);
      const ftX = mapX / pxPerFt;
      const ftY = mapY / pxPerFt;

      if (ftX >= 0 && ftX <= mapWidthFt && ftY >= 0 && ftY <= mapHeightFt) {
        const clampedX = Math.max(0, Math.min(mapWidthFt - 5, ftX));
        const clampedY = Math.max(0, Math.min(mapHeightFt - 5, ftY));
        updateActiveElement(ds.instanceId, { tokenX: clampedX, tokenY: clampedY, mapId: activeMapIdResolved });
        const postMove = activeElements.map((el) =>
          el.instanceId === ds.instanceId ? { ...el, tokenX: clampedX, tokenY: clampedY, mapId: activeMapIdResolved } : el
        );
        onTokenDragEnd?.({
          instanceId: ds.instanceId,
          previousTokenFt: ds.fromTray ? null : ds.prevTokenFt,
          nextTokenFt: { tokenX: clampedX, tokenY: clampedY },
          fromTray: ds.fromTray,
          postMoveActiveElements: postMove,
        });
      } else if (!ds.fromTray) {
        // Dropped outside map and trays while dragging from map: return to tray
        updateActiveElement(ds.instanceId, { tokenX: null, tokenY: null, mapId: null });
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
        onTokenDragEnd?.({
          instanceId: ds.instanceId,
          previousTokenFt: ds.prevTokenFt,
          nextTokenFt: null,
          fromTray: false,
        });
      }
    }
  }, [isPlayer, pxPerFt, mapWidthFt, mapHeightFt, updateActiveElement, pinnedToken, activeElements, onTokenDragEnd, canControlMapView, centerMapOnPlacedActor, activeMapIdResolved, navigateShelfToCharacterMap]);

  /** Keep the stable proxy callbacks (declared earlier) pointed at the latest handler closures. */
  handlersRef.current = { handlePointerDown, handlePointerMove, handlePointerUp };

  // Dismiss detail panel when clicking outside
  const handleMapClick = useCallback((e) => {
    if (e.button !== 0) return;
    // Only dismiss if clicking directly on the map/scroll container (not a token)
    if (e.target === scrollContainerRef.current || e.target === e.currentTarget) {
      setPinnedToken(null);
    }
  }, []);

  const handleRightPanPointerDown = useCallback(
    (e) => {
      if (!canControlMapView) return;
      if (mapAiGenPreviewUrlRef.current) return;
      if (!canPanMap) return;
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      panRightDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPanLeft: mapPanLeftRef.current,
        startPanTop: mapPanTopRef.current,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      setRightPanDragging(true);
    },
    [canControlMapView, canPanMap],
  );

  const handleRightPanPointerMove = useCallback(
    (e) => {
      const d = panRightDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      e.preventDefault();
      const el = scrollContainerRef.current;
      const vw = el?.clientWidth ?? 0;
      const vh = el?.clientHeight ?? 0;
      if (vw <= 0 || vh <= 0) return;
      const z = mapZoomRef.current;
      const rw = renderedWRef.current;
      const rh = renderedHRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      // Grab semantics: drag right → map moves right with the pointer (invert scroll delta)
      const next = clampPanScroll(
        d.startPanLeft - dx,
        d.startPanTop - dy,
        { mapZoom: z, renderedWidthPx: rw, renderedHeightPx: rh, viewportW: vw, viewportH: vh },
      );
      mapPanLeftRef.current = next.scrollLeft;
      mapPanTopRef.current = next.scrollTop;
      setMapPanLeft(next.scrollLeft);
      setMapPanTop(next.scrollTop);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    },
    [schedulePersistView, onMapViewSync, schedulePersistPlayerViewport, isPlayer],
  );

  const handleRightPanPointerUp = useCallback(
    (e) => {
      const d = panRightDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      panRightDragRef.current = null;
      setRightPanDragging(false);
      if (onMapViewSync) schedulePersistView();
    },
    [schedulePersistView, onMapViewSync],
  );

  const handleRightPanLostCapture = useCallback(
    (e) => {
      const d = panRightDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      panRightDragRef.current = null;
      setRightPanDragging(false);
      if (onMapViewSync) schedulePersistView();
    },
    [schedulePersistView, onMapViewSync],
  );

  // Keep pinned token data fresh
  useEffect(() => {
    if (!pinnedToken) return;
    const fresh = activeElements.find(el => el.instanceId === pinnedToken.element.instanceId);
    if (!fresh) { setPinnedToken(null); return; }
    setPinnedToken(prev => prev ? { ...prev, element: fresh } : null);
  }, [activeElements]); // intentionally broad

  // ─── onMapConfigChange wrapper (handles scale for size changes) ──────────

  const handleMapConfigChange = useCallback((patch, resetTokenPositions = false, scale = null) => {
    if (scale != null && scale !== 1) {
      // Rescale placed tokens on the active map proportionally
      const scaledElements = activeElements
        .filter(
          (el) =>
            el.tokenX != null &&
            effectiveTokenMapId(el.mapId) === activeMapIdResolved &&
            (el.elementType === 'character' ||
              el.elementType === 'adversary' ||
              el.elementType === 'boardToken'),
        )
        .map((el) => ({ instanceId: el.instanceId, tokenX: el.tokenX * scale, tokenY: el.tokenY * scale }));
      scaledElements.forEach(({ instanceId, tokenX, tokenY }) => updateActiveElement(instanceId, { tokenX, tokenY }));
    }
    onMapConfigChange(patch, resetTokenPositions);
  }, [activeElements, updateActiveElement, onMapConfigChange, activeMapIdResolved]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const showLeftTray =
    characters.length > 0 ||
    boardTrayTokens.length > 0 ||
    (!isPlayer && pendingBannerCount > 0);
  const showRightTray = !isPlayer && adversaries.length > 0;
  const showDiceTrayControls =
    onClearDice ||
    onToggleDiceVisibility ||
    (typeof onCancelAllBanners === 'function' && pendingBannerCount > 0);

  const hasMapArt = mapConfigHasImage(mapConfig);
  const displayMapImageUrl = mapAiGenPreviewUrl ?? mapConfig?.mapImageUrl ?? null;
  const gmEmptyMapHint =
    !isPlayer &&
    getGmTotMEmptyMapHint({
      tableStateReady,
      mapConfigHasImage: hasMapArt,
    });
  const playerEmptyMapHint =
    isPlayer &&
    getPlayerTotMEmptyMapHint({
      tableStateReady,
      mapConfigHasImage: hasMapArt,
    });

  const showTotmOverlay = !hasMapArt && (gmEmptyMapHint || playerEmptyMapHint);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar — GM only */}
      {!isPlayer && (
        <MapConfigToolbar
          mapConfig={mapConfig}
          onMapConfigChange={handleMapConfigChange}
          isUploading={false}
          onFileSelect={(f) => unifiedImportEnabled && openImport([f])}
          tableName={tableName}
          tableStateReady={tableStateReady}
          onTableNameChange={onTableNameChange}
          onDeleteTable={onDeleteTable}
          onMapAiGenerationPreviewChange={setMapAiGenPreviewUrl}
          showImageGenAiUi={showImageGenAiUi}
          aiMapOpen={aiMapOpen}
          setAiMapOpen={setAiMapOpen}
        />
      )}
      {!isPlayer && maps.length > 0 && onSetActiveView && onMapFreeExplore && (
        <div className="flex items-start gap-2 px-3 py-1.5 bg-dh-surface border-b border-dh-border text-xs shrink-0 flex-wrap">
          <div
            className="flex shrink-0 flex-col gap-1 items-stretch pt-0.5 box-border overflow-hidden"
            style={{ width: CHARACTER_TRAY_WIDTH_PX, maxWidth: CHARACTER_TRAY_WIDTH_PX }}
          >
            {onAddMap ? (
              <Tooltip label="Add map" placement="right" className="relative block w-full min-w-0">
                <button
                  type="button"
                  onClick={onAddMap}
                  className="w-full max-w-full min-w-0 flex justify-center items-center rounded px-0.5 py-0.5 text-violet-300/90 border border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35 hover:underline box-border"
                  aria-label="Add map"
                >
                  <span className="relative inline-flex shrink-0">
                    <MapIcon size={trayTokenSizePx - 6} strokeWidth={1.25} aria-hidden />
                    <Plus
                      className="absolute -bottom-0.5 -right-0.5 text-violet-100"
                      size={16}
                      strokeWidth={3.5}
                      aria-hidden
                    />
                  </span>
                </button>
              </Tooltip>
            ) : null}
            <Tooltip
              label={
                gmCanCreateCameraView
                  ? 'Add camera at the current zoom and pan'
                  : 'Cameras'
              }
              placement="right"
              className="relative block w-full min-w-0"
            >
              {gmCanCreateCameraView ? (
                <button
                  type="button"
                  onClick={() => void handleSplitCamera()}
                  className="w-full max-w-full min-w-0 flex justify-center items-center rounded px-0.5 py-0.5 text-violet-300/90 border border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35 hover:underline box-border"
                  aria-label="Add camera at the current zoom and pan"
                >
                  <span className="relative inline-flex shrink-0">
                    <Camera size={trayTokenSizePx - 6} strokeWidth={1.25} aria-hidden />
                    <Plus
                      className="absolute -bottom-0.5 -right-0.5 text-violet-100"
                      size={16}
                      strokeWidth={3.5}
                      aria-hidden
                    />
                  </span>
                </button>
              ) : (
                <span
                  className="shrink-0 flex flex-col items-center justify-center text-dh-muted w-full"
                  role="img"
                  aria-label="Camera views"
                >
                  <Camera size={trayTokenSizePx} strokeWidth={1.25} aria-hidden />
                </span>
              )}
            </Tooltip>
          </div>
          <div
            className="flex flex-1 min-w-0 items-stretch gap-2 overflow-x-auto pb-0.5 -mb-0.5"
            role="tablist"
            aria-label="Map views"
          >
            {gmMapViewGroups.map(({ map, views }, idx) => (
              <Fragment key={map.id}>
                {idx > 0 ? (
                  <div
                    className="w-px shrink-0 self-stretch min-h-[4.75rem] bg-dh-border/60"
                    aria-hidden
                  />
                ) : null}
                <div className="flex shrink-0 items-start gap-1 rounded-md border border-dh-border/50 bg-dh-canvas/15 p-1">
                <MapViewStripTile
                  variant="map"
                  showMapBadge
                  mapRow={map}
                  mapOverlayPng={getRowOverlayPng(map)}
                  viewState={
                    gmActiveViewId === null && map.id === activeMapIdResolved && liveStripView
                      ? liveStripView
                      : null
                  }
                  activeElements={activeElements}
                  stripMapId={map.id}
                  label={map.name || 'Map'}
                  tooltipTitle={
                    onForcePlayersToMapView && map.shareWithPlayers !== false
                      ? `${map.name || 'Map'}: double-click to bring players`
                      : undefined
                  }
                  isActive={gmMapStripFullMapTileActive({
                    gmActiveViewId,
                    mapId: map.id,
                    activeMapIdResolved,
                  })}
                  broadcastHighlight={map.shareWithPlayers !== false}
                  onClick={() => {
                    if (handleGmMapFreeExplore) handleGmMapFreeExplore(map.id);
                  }}
                  onDoubleClick={
                    onForcePlayersToMapView && map.shareWithPlayers !== false
                      ? (e) => {
                          e.preventDefault();
                          onForcePlayersToMapView({ freeMapExploreMapId: map.id });
                        }
                      : undefined
                  }
                  actions={
                    onSetMapShare || onRenameMap || (onRemoveMap && maps.length > 1) ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {onSetMapShare ? (
                          <Tooltip
                            label={
                              map.shareWithPlayers !== false
                                ? 'Players see the map tile and can pan/zoom freely (not locked to the GM)'
                                : 'Players only see broadcast views (no map tile or free pan/zoom)'
                            }
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const allowed = map.shareWithPlayers !== false;
                                onSetMapShare(map.id, !allowed);
                              }}
                              className={`rounded p-0.5 ${
                                map.shareWithPlayers !== false
                                  ? 'text-sky-400'
                                  : 'text-dh-muted hover:text-dh'
                              }`}
                              aria-label={
                                map.shareWithPlayers !== false
                                  ? 'Player map tile and free pan/zoom on'
                                  : 'Player map tile and free pan/zoom off'
                              }
                            >
                              <Radio size={11} aria-hidden />
                            </button>
                          </Tooltip>
                        ) : null}
                        {onRenameMap ? (
                          <Tooltip label="Rename map">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const cur = map.name ?? '';
                                const name = window.prompt('Map name', cur);
                                if (name != null && name.trim()) onRenameMap(map.id, name.trim());
                              }}
                              className="rounded p-0.5 text-dh-muted hover:bg-dh-hover/80 hover:text-dh"
                              aria-label="Rename map"
                            >
                              <Pencil size={11} aria-hidden />
                            </button>
                          </Tooltip>
                        ) : null}
                        {onRemoveMap && maps.length > 1 ? (
                          <Tooltip label="Remove map">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!window.confirm('Remove this map? Tokens on it return to the tray.')) return;
                                onRemoveMap(map.id);
                              }}
                              className="rounded p-0.5 text-dh-muted hover:bg-red-900/35 hover:text-red-200"
                              aria-label="Remove map"
                            >
                              <Trash2 size={11} aria-hidden />
                            </button>
                          </Tooltip>
                        ) : null}
                      </div>
                    ) : null
                  }
                />
                {views.map((view) => {
                  const nOnMap = views.length;
                  const label = view.name || 'View';
                  return (
                    <MapViewStripTile
                      key={view.id}
                      variant="map"
                      captionAbove
                      showCameraBadge
                      mapRow={map}
                      mapOverlayPng={getRowOverlayPng(map)}
                      cameraOverlayPng={getRowOverlayPng(view)}
                      viewState={viewStateForStripTile(view)}
                      activeElements={activeElements}
                      stripMapId={map.id}
                      label={label}
                      tooltipTitle={
                        onForcePlayersToMapView && view.broadcastToPlayers
                          ? `${label}: double-click to bring players`
                          : undefined
                      }
                      isActive={view.id === gmActiveViewId}
                      broadcastHighlight={view.broadcastToPlayers}
                      onClick={() => handleGmSetActiveView(view.id)}
                      onDoubleClick={
                        onForcePlayersToMapView && view.broadcastToPlayers
                          ? (e) => {
                              e.preventDefault();
                              onForcePlayersToMapView({ viewId: view.id });
                            }
                          : undefined
                      }
                      actions={
                        <div className="flex items-center justify-center gap-0.5">
                          {onSetViewBroadcast ? (
                            <Tooltip label={view.broadcastToPlayers ? 'Broadcasting to players' : 'Not broadcast'}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetViewBroadcast(view.id, !view.broadcastToPlayers);
                                }}
                                className={`rounded p-0.5 ${view.broadcastToPlayers ? 'text-sky-400' : 'text-dh-muted hover:text-dh'}`}
                                aria-label={view.broadcastToPlayers ? 'Stop broadcast' : 'Broadcast to players'}
                              >
                                <Radio size={11} aria-hidden />
                              </button>
                            </Tooltip>
                          ) : null}
                          {onRenameMapView ? (
                            <Tooltip label="Rename view">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cur = view.name || 'View';
                                  const name = window.prompt('View name', cur);
                                  if (name != null && name.trim()) onRenameMapView(view.id, name.trim());
                                }}
                                className="rounded p-0.5 text-dh-muted hover:bg-dh-hover/80 hover:text-dh"
                                aria-label="Rename view"
                              >
                                <Pencil size={11} aria-hidden />
                              </button>
                            </Tooltip>
                          ) : null}
                          {onRemoveMapView && nOnMap > 1 ? (
                            <Tooltip label="Delete view">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!window.confirm('Delete this view?')) return;
                                  onRemoveMapView(view.id);
                                }}
                                className="rounded p-0.5 text-dh-muted hover:bg-red-900/35 hover:text-red-200"
                                aria-label="Delete view"
                              >
                                <Trash2 size={11} aria-hidden />
                              </button>
                            </Tooltip>
                          ) : null}
                        </div>
                      }
                    />
                  );
                })}
                </div>
              </Fragment>
            ))}
          </div>
          {canControlMapView ? (
            <div
              className="flex shrink-0 flex-col items-stretch pt-0.5 box-border overflow-hidden self-start"
              style={{ width: CHARACTER_TRAY_WIDTH_PX, maxWidth: CHARACTER_TRAY_WIDTH_PX }}
            >
              <Tooltip label="Fit everyone on the map at the closest zoom" placement="left" className="relative block w-full min-w-0">
                <button
                  type="button"
                  onClick={applyZoomToFitActors}
                  disabled={!hasPlacedActorsOnMap || mapAiPreviewActive}
                  className="w-full max-w-full min-w-0 flex flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[10px] leading-tight text-center text-violet-200/95 border border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35 disabled:opacity-40 disabled:pointer-events-none box-border"
                  aria-label="Zoom to Actors"
                >
                  <Focus size={Math.max(12, trayTokenSizePx - 8)} strokeWidth={1.25} aria-hidden />
                  <span className="px-0.5 font-medium">Zoom to Actors</span>
                </button>
              </Tooltip>
            </div>
          ) : null}
        </div>
      )}
      {isPlayer && tableId && showPlayerMapViewStrip && (
          <div className="flex items-start gap-2 px-3 py-1.5 bg-dh-surface border-b border-dh-border text-xs shrink-0 flex-wrap">
            <div
              className="flex flex-1 min-w-0 items-stretch gap-2 overflow-x-auto pb-0.5 -mb-0.5"
              aria-label="GM broadcast views"
            >
              {playerViewBatches.map(({ map: m, gmViews }, idx) => (
                <Fragment key={m.id}>
                  {idx > 0 ? (
                    <div
                      className="w-px shrink-0 self-stretch min-h-[4.75rem] bg-dh-border/60"
                      aria-hidden
                    />
                  ) : null}
                  <div className="flex shrink-0 items-start gap-1 rounded-md border border-dh-border/50 bg-dh-canvas/15 p-1">
                    {m.shareWithPlayers !== false ? (
                    <MapViewStripTile
                      variant="map"
                      showMapBadge
                      mapRow={m}
                      mapOverlayPng={getRowOverlayPng(m)}
                      viewState={null}
                      activeElements={activeElements}
                      stripMapId={m.id}
                      label={m.name || 'Map'}
                      tooltipTitle={`${m.name || 'Map'} — Pan and zoom freely (not a saved view)`}
                      isActive={playerMapStripFullMapTileActive({
                        playerFreeMapExplore,
                        playerFreeExploreMapId,
                        mapId: m.id,
                      })}
                      onClick={() => {
                        onPlayerEnterMapFreeExplore?.(m.id);
                      }}
                    />
                    ) : null}
                    {gmViews.map((view) => (
                      <MapViewStripTile
                        key={view.id}
                        variant="map"
                        captionAbove
                        showCameraBadge
                        mapRow={m}
                        mapOverlayPng={getRowOverlayPng(m)}
                        cameraOverlayPng={getRowOverlayPng(view)}
                        viewState={viewStateForStripTile(view)}
                        activeElements={activeElements}
                        stripMapId={m.id}
                        label={view.name || 'View'}
                        isActive={
                          view.id === playerSelectedViewId &&
                          !playerFreeMapExplore
                        }
                        onClick={() => {
                          onPlayerSelectView?.(view.id);
                        }}
                      />
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
            {canControlMapView ? (
              <div
                className="flex shrink-0 flex-col items-stretch pt-0.5 box-border overflow-hidden self-start"
                style={{ width: CHARACTER_TRAY_WIDTH_PX, maxWidth: CHARACTER_TRAY_WIDTH_PX }}
              >
                <Tooltip label="Fit everyone on the map at the closest zoom" placement="left" className="relative block w-full min-w-0">
                  <button
                    type="button"
                    onClick={applyZoomToFitActors}
                    disabled={!hasPlacedActorsOnMap || mapAiPreviewActive}
                    className="w-full max-w-full min-w-0 flex flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[10px] leading-tight text-center text-violet-200/95 border border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35 disabled:opacity-40 disabled:pointer-events-none box-border"
                    aria-label="Zoom to Actors"
                  >
                    <Focus size={Math.max(12, trayTokenSizePx - 8)} strokeWidth={1.25} aria-hidden />
                    <span className="px-0.5 font-medium">Zoom to Actors</span>
                  </button>
                </Tooltip>
              </div>
            ) : null}
          </div>
        )}
      {/* Map area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left tray — character tokens shelf */}
        {showLeftTray && (
          <div
            ref={leftTrayRef}
            className={`flex flex-col shrink-0 border-r border-dh-border ${highlightLeftTray ? 'bg-amber-900/30' : 'bg-dh-surface/60'}`}
            style={{ width: CHARACTER_TRAY_WIDTH_PX, minHeight: 0 }}
          >
            <div className="flex-1 min-h-0 overflow-hidden">
              <TrayColumn
                tokens={charTrayTokensMerged}
                side="left"
                isHighlighted={highlightLeftTray}
                trayRef={null}
                tokenSizePx={trayTokenSizePx}
                dragRef={dragRef}
                onPointerDown={stableOnPointerDown}
                onPointerMove={stableOnPointerMove}
                onPointerUp={stableOnPointerUp}
                pinnedInstanceId={pinnedToken?.element.instanceId}
              />
            </div>
            {showDiceTrayControls && (
              <div className="p-1.5 border-t border-dh-border shrink-0 flex flex-col">
                {typeof onCancelAllBanners === 'function' && pendingBannerCount > 0 && (
                  <Tooltip label={`Cancel all ${pendingBannerCount} pending roll banner${pendingBannerCount === 1 ? '' : 's'} (no effects)`}>
                    <button
                      type="button"
                      onClick={onCancelAllBanners}
                      className="w-full flex items-center justify-center py-1.5 rounded bg-dh-raised/80 hover:bg-dh-hover text-amber-300/90 hover:text-amber-200 border border-amber-800/60 transition-colors mb-7"
                      aria-label="Cancel all pending banners"
                    >
                      <CircleX size={14} className="shrink-0" />
                    </button>
                  </Tooltip>
                )}
                <div className="flex flex-col gap-1">
                  {onToggleDiceVisibility && (
                    <Tooltip label={diceCanvasHidden ? 'Show 3D dice' : 'Hide 3D dice'}>
                      <button
                        type="button"
                        onClick={onToggleDiceVisibility}
                        className="w-full flex items-center justify-center py-1.5 rounded bg-dh-raised/80 hover:bg-dh-hover text-dh-muted hover:text-dh border border-dh-strong transition-colors"
                        aria-label={diceCanvasHidden ? 'Show dice' : 'Hide dice'}
                      >
                        {diceCanvasHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </Tooltip>
                  )}
                  {onClearDice && (
                    <Tooltip label="Clear 3D dice">
                      <button
                        type="button"
                        onClick={onClearDice}
                        className="w-full flex items-center justify-center py-1.5 rounded bg-dh-raised/80 hover:bg-dh-hover text-dh-muted hover:text-dh border border-dh-strong transition-colors"
                        aria-label="Clear dice"
                      >
                        <Eraser size={14} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hidden tray ref for drop detection even when left tray is empty */}
        {!showLeftTray && (
          <div ref={leftTrayRef} className="hidden" />
        )}

        {/* Map column: draw toolbar (optional) + viewport (measured via scrollWrapperRef) */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
          {mapConfigHasImage(mapConfig) &&
            ((!isPlayer && (onSetMapOverlay || onSetMapViewOverlay)) || isPlayer) && (
              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-dh-border bg-dh-canvas/40 text-[11px] shrink-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                  {!isPlayer ? (
                    <>
                      <span className="text-dh-muted font-semibold tracking-wide">Map draw</span>
                      <span className="text-dh-muted/80 hidden sm:inline">
                        {drawEditContext?.kind === 'map' ? 'Map layer' : 'Camera layer'}
                      </span>
                    </>
                  ) : (
                    <span className="text-dh-muted font-semibold tracking-wide">Scribble</span>
                  )}
                  {!isPlayer && (
                    <>
                      <Tooltip label="Scribble: fades over 10 seconds (not saved). Click and drag.">
                        <button
                          type="button"
                          onClick={() => setDrawTool('scribble')}
                          className={`inline-flex items-center justify-center rounded border p-1.5 ${
                            drawTool === 'scribble'
                              ? 'border-fuchsia-500/60 bg-fuchsia-950/35 text-fuchsia-100'
                              : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                          }`}
                          aria-label="Scribble: temporary strokes"
                        >
                          <PencilLine size={15} aria-hidden />
                        </button>
                      </Tooltip>
                      <Tooltip label="Paint on the map (click and drag)">
                        <button
                          type="button"
                          onClick={() => setDrawTool('brush')}
                          className={`inline-flex items-center justify-center rounded border p-1.5 ${
                            drawTool === 'brush'
                              ? 'border-violet-500/60 bg-violet-950/40 text-violet-100'
                              : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                          }`}
                          aria-label="Brush"
                        >
                          <Paintbrush size={15} aria-hidden />
                        </button>
                      </Tooltip>
                      <Tooltip label="Click a drawn region to remove it, or drag to erase freehand (full strength; opacity does not apply)">
                        <button
                          type="button"
                          onClick={() => setDrawTool('eraser')}
                          className={`inline-flex items-center justify-center rounded border p-1.5 ${
                            drawTool === 'eraser'
                              ? 'border-sky-500/60 bg-sky-950/35 text-sky-100'
                              : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                          }`}
                          aria-label="Eraser"
                        >
                          <Eraser size={15} aria-hidden />
                        </button>
                      </Tooltip>
                      <Tooltip label="Rectangle: drag on the map. Click again while selected to toggle filled vs outline.">
                        <button
                          type="button"
                          onClick={() =>
                            setDrawTool((prev) => {
                              if (prev === 'rect') {
                                setRectShapeFilled((f) => !f);
                                return 'rect';
                              }
                              return 'rect';
                            })
                          }
                          className={`inline-flex items-center justify-center rounded border p-1.5 ${
                            drawTool === 'rect'
                              ? 'border-amber-500/55 bg-amber-950/35 text-amber-100'
                              : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                          }`}
                          aria-label="Rectangle"
                        >
                          <Square size={15} aria-hidden fill={rectShapeFilled ? 'currentColor' : 'none'} />
                        </button>
                      </Tooltip>
                      <Tooltip label="Oval: drag on the map. Click again while selected to toggle filled vs outline.">
                        <button
                          type="button"
                          onClick={() =>
                            setDrawTool((prev) => {
                              if (prev === 'oval') {
                                setOvalShapeFilled((f) => !f);
                                return 'oval';
                              }
                              return 'oval';
                            })
                          }
                          className={`inline-flex items-center justify-center rounded border p-1.5 ${
                            drawTool === 'oval'
                              ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-100'
                              : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                          }`}
                          aria-label="Oval"
                        >
                          <Circle size={15} aria-hidden fill={ovalShapeFilled ? 'currentColor' : 'none'} />
                        </button>
                      </Tooltip>
                    </>
                  )}
                  <label className="inline-flex items-center gap-1 text-dh-muted" title="Brush color">
                    <span className="whitespace-nowrap hidden sm:inline">Color</span>
                    <input
                      type="color"
                      value={drawColorHex}
                      onInput={(e) => setDrawColorHex(e.target.value)}
                      onChange={(e) => setDrawColorHex(e.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border border-dh-strong bg-dh-raised p-0"
                    />
                  </label>
                  <Tooltip label="Sample color from the map image only (not drawings or fog). Click, then click the map. Esc cancels.">
                    <button
                      type="button"
                      onClick={() => setDrawEyedropperActive((v) => !v)}
                      className={`inline-flex items-center justify-center rounded border p-1.5 ${
                        drawEyedropperActive
                          ? 'border-cyan-500/60 bg-cyan-950/35 text-cyan-100'
                          : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                      }`}
                      aria-label="Eyedropper: sample color from map image"
                      aria-pressed={drawEyedropperActive}
                    >
                      <Pipette size={15} aria-hidden />
                    </button>
                  </Tooltip>
                  <label
                    className={`inline-flex items-center gap-1.5 ${drawTool === 'eraser' && !isPlayer ? 'text-dh-muted/50' : 'text-dh-muted'}`}
                    title={
                      drawTool === 'eraser' && !isPlayer
                        ? 'Opacity applies to brush and shapes, not the eraser'
                        : undefined
                    }
                  >
                    <span className="whitespace-nowrap">Opacity</span>
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={drawOpacity}
                      onPointerDown={() => setBrushPreviewControlsActive(true)}
                      onInput={(e) => setDrawOpacity(Number(e.target.value))}
                      onChange={(e) => setDrawOpacity(Number(e.target.value))}
                      className="relative top-0.5 h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-dh-hover accent-cyan-500 disabled:opacity-40"
                      disabled={drawTool === 'eraser' && !isPlayer}
                    />
                    <span className="inline-block min-w-[5ch] text-end tabular-nums text-dh">
                      {Math.round(drawOpacity * 100)}%
                    </span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-dh-muted">
                    <span className="whitespace-nowrap">Radius</span>
                    <input
                      type="range"
                      min={MAP_DRAW_BRUSH_RADIUS_FT_MIN}
                      max={drawBrushRadiusMaxFt}
                      step={0.5}
                      value={drawBrushRadiusClampedFt}
                      onPointerDown={() => setBrushPreviewControlsActive(true)}
                      onChange={(e) => setDrawBrushRadiusFt(Number(e.target.value))}
                      className="relative top-0.5 h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-dh-hover accent-cyan-500"
                      disabled={drawTool === 'rect' || drawTool === 'oval'}
                      title={`${MAP_DRAW_BRUSH_RADIUS_FT_MIN}′–${Math.round(drawBrushRadiusMaxFt * 10) / 10}′ (max 20% of visible map height)`}
                    />
                    <span className="tabular-nums text-dh">{drawBrushRadiusClampedFt.toFixed(1)}′</span>
                  </label>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {!isPlayer ? (
                    <Tooltip label="Clear this layer only">
                      <button
                        type="button"
                        onClick={() => void handleDrawClearAll()}
                        className="inline-flex items-center justify-center rounded border border-dh-strong bg-dh-raised/70 p-1.5 text-dh-muted hover:text-amber-200 hover:border-amber-800/60"
                        aria-label="Clear layer"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip label="Clear your scribbles on this map">
                      <button
                        type="button"
                        onClick={() => void handleScribbleClear()}
                        className="inline-flex items-center justify-center rounded border border-dh-strong bg-dh-raised/70 p-1.5 text-dh-muted hover:text-amber-200 hover:border-amber-800/60"
                        aria-label="Clear scribbles"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
          <div ref={scrollWrapperRef} className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
          {/* Viewport: pan via translate (no native scrolling) */}
          <div
            ref={scrollContainerRef}
            className={`w-full h-full overflow-hidden relative touch-none bg-dh-canvas ${
              drawEyedropperActive
                ? 'cursor-crosshair'
                : !isPlayer && (drawTool === 'rect' || drawTool === 'oval')
                  ? 'cursor-crosshair'
                  : canControlMapView && !mapAiPreviewActive && (canPanMap || rightPanDragging)
                    ? (rightPanDragging ? 'cursor-grabbing' : 'cursor-grab')
                    : ''
            }`}
            style={
              mapLetterboxClipPx &&
              (mapLetterboxClipPx.top > 0 ||
                mapLetterboxClipPx.right > 0 ||
                mapLetterboxClipPx.bottom > 0 ||
                mapLetterboxClipPx.left > 0)
                ? {
                    clipPath: `inset(${mapLetterboxClipPx.top}px ${mapLetterboxClipPx.right}px ${mapLetterboxClipPx.bottom}px ${mapLetterboxClipPx.left}px)`,
                  }
                : undefined
            }
            onClick={handleMapClick}
            onPointerDown={handleRightPanPointerDown}
            onPointerMove={handleRightPanPointerMove}
            onPointerUp={handleRightPanPointerUp}
            onPointerCancel={handleRightPanPointerUp}
            onLostPointerCapture={handleRightPanLostCapture}
            onContextMenu={canControlMapView && canPanMap ? (ev) => { ev.preventDefault(); } : undefined}
            onDragOver={!isPlayer ? handleMapPanelDragOver : undefined}
            onDrop={!isPlayer ? handleMapPanelDrop : undefined}
          >
            <div
              className="relative shrink-0 will-change-transform"
              style={{
                transform: `translate(${-viewPanLeft}px, ${-viewPanTop}px)`,
                width: renderedWidthPx * viewZoom,
                height: renderedHeightPx * viewZoom,
              }}
            >
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: renderedWidthPx,
                  height: renderedHeightPx,
                  transform: `scale(${viewZoom})`,
                }}
                onPointerDown={handleMapPingPointerDown}
                onPointerMove={handleMapPointerMove}
                onPointerLeave={handleMapPointerLeave}
              >
              {/* Map image or blank white canvas (tokens and drag/drop work either way) */}
              {displayMapImageUrl ? (
                <img
                  ref={mapImageRef}
                  crossOrigin="anonymous"
                  src={displayMapImageUrl}
                  alt="Battle map"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 bg-dh-map-blank" />
              )}

              {mapOverlayPngSrc && !(showDrawPaintCanvas && drawEditContext?.kind === 'map') ? (
                <img
                  ref={mapOverlayImgRef}
                  crossOrigin="anonymous"
                  src={mapOverlayPngSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                  style={{ zIndex: 3 }}
                  draggable={false}
                />
              ) : null}
              {showDrawPaintCanvas && drawEditContext?.kind === 'map' ? (
                <canvas
                  ref={drawPaintRef}
                  className="absolute left-0 top-0"
                  style={{
                    width: renderedWidthPx,
                    height: renderedHeightPx,
                    zIndex: 20,
                    pointerEvents: drawLayerBlockedByTokenHover ? 'none' : 'auto',
                    touchAction: 'none',
                    cursor: drawEyedropperActive
                      ? 'crosshair'
                      : drawTool === 'rect' || drawTool === 'oval'
                        ? 'crosshair'
                        : 'default',
                  }}
                  onPointerDown={handleDrawPointerDown}
                  onPointerMove={handleDrawPointerMove}
                  onPointerUp={handleDrawPointerUp}
                  onPointerCancel={handleDrawPointerCancel}
                />
              ) : null}
              {cameraOverlayPngSrc && !(showDrawPaintCanvas && drawEditContext && drawEditContext.kind !== 'map') ? (
                <img
                  ref={cameraOverlayImgRef}
                  crossOrigin="anonymous"
                  src={cameraOverlayPngSrc}
                  alt=""
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                  style={{ zIndex: 4 }}
                  draggable={false}
                />
              ) : null}
              {showDrawPaintCanvas && drawEditContext && drawEditContext.kind !== 'map' ? (
                <canvas
                  ref={drawPaintRef}
                  className="absolute left-0 top-0"
                  style={{
                    width: renderedWidthPx,
                    height: renderedHeightPx,
                    zIndex: 20,
                    pointerEvents: drawLayerBlockedByTokenHover ? 'none' : 'auto',
                    touchAction: 'none',
                    cursor: drawEyedropperActive
                      ? 'crosshair'
                      : drawTool === 'rect' || drawTool === 'oval'
                        ? 'crosshair'
                        : 'default',
                  }}
                  onPointerDown={handleDrawPointerDown}
                  onPointerMove={handleDrawPointerMove}
                  onPointerUp={handleDrawPointerUp}
                  onPointerCancel={handleDrawPointerCancel}
                />
              ) : null}
              {showScribbleCanvas ? (
                <canvas
                  ref={scribbleCanvasRef}
                  className="absolute left-0 top-0"
                  style={{
                    width: renderedWidthPx,
                    height: renderedHeightPx,
                    zIndex: scribbleCanvasZ,
                    touchAction: 'none',
                    pointerEvents: scribbleCanvasPointerEvents,
                    cursor: 'default',
                  }}
                  onPointerDown={handleDrawPointerDown}
                  onPointerMove={handleDrawPointerMove}
                  onPointerUp={handleDrawPointerUp}
                  onPointerCancel={handleDrawPointerCancel}
                />
              ) : null}

              {/* Measure rect for portaled fireworks (above DiceRoller z-15); bursts render in document.body */}
              <div
                ref={fireworksAnchorRef}
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 7 }}
                aria-hidden
              />

              {/* Range band bullseye overlay (above draw canvas z-20) */}
              {bullseyeFt && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 25 }}
                  overflow="visible"
                >
                  {/* Draw largest ring first so inner bands paint on top */}
                  {[...RANGE_BANDS].reverse().map((band) => {
                    const cx = bullseyeFt.x * pxPerFt;
                    const cy = bullseyeFt.y * pxPerFt;
                    const r = band.maxFt * pxPerFt;
                    const labelY = cy - r + 14;
                    return (
                      <g key={band.name}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={band.fillColor}
                          stroke={band.ringColor}
                          strokeWidth={1.5}
                        />
                        <text
                          x={cx}
                          y={labelY}
                          textAnchor="middle"
                          fill={band.ringColor}
                          fontSize={Math.max(10, Math.min(13, r * 0.12))}
                          fontWeight="600"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {band.name}
                        </text>
                      </g>
                    );
                  })}
                  {/* Crosshair at bullseye center */}
                  <line
                    x1={bullseyeFt.x * pxPerFt - 6}
                    y1={bullseyeFt.y * pxPerFt}
                    x2={bullseyeFt.x * pxPerFt + 6}
                    y2={bullseyeFt.y * pxPerFt}
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1}
                  />
                  <line
                    x1={bullseyeFt.x * pxPerFt}
                    y1={bullseyeFt.y * pxPerFt - 6}
                    x2={bullseyeFt.x * pxPerFt}
                    y2={bullseyeFt.y * pxPerFt + 6}
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1}
                  />
                </svg>
              )}

              {/* Second bullseye: follows dragged token during drag */}
              {followBullseyeFt && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 26 }}
                  overflow="visible"
                >
                  {[...RANGE_BANDS].reverse().map((band) => {
                    const cx = followBullseyeFt.x * pxPerFt;
                    const cy = followBullseyeFt.y * pxPerFt;
                    const r = band.maxFt * pxPerFt;
                    const labelY = cy - r + 14;
                    return (
                      <g key={`follow-${band.name}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={band.fillColor}
                          stroke={band.ringColor}
                          strokeWidth={1.5}
                        />
                        <text
                          x={cx}
                          y={labelY}
                          textAnchor="middle"
                          fill={band.ringColor}
                          fontSize={Math.max(10, Math.min(13, r * 0.12))}
                          fontWeight="600"
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {band.name}
                        </text>
                      </g>
                    );
                  })}
                  <line
                    x1={followBullseyeFt.x * pxPerFt - 6}
                    y1={followBullseyeFt.y * pxPerFt}
                    x2={followBullseyeFt.x * pxPerFt + 6}
                    y2={followBullseyeFt.y * pxPerFt}
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1}
                  />
                  <line
                    x1={followBullseyeFt.x * pxPerFt}
                    y1={followBullseyeFt.y * pxPerFt - 6}
                    x2={followBullseyeFt.x * pxPerFt}
                    y2={followBullseyeFt.y * pxPerFt + 6}
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth={1}
                  />
                </svg>
              )}

              {/* Placed character tokens — rising z-index so overlaps pick the topmost; padded hit target for edges */}
              {charMapTokens.map(({ element, isMyCharacter: myChar }, stackIdx) => {
                const bandIdx = tokenRangeBands[element.instanceId];
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                return (
                  <PlacedToken
                    key={element.instanceId}
                    element={element}
                    isMyCharacter={myChar}
                    isPlayer={isPlayer}
                    isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                    isPinned={pinnedToken?.element.instanceId === element.instanceId}
                    rangeBand={rangeBand}
                    zIndex={10 + stackIdx}
                    pxPerFt={pxPerFt}
                    tokenSizePx={tokenSizePx}
                    onPointerDown={stableOnPointerDown}
                    onPointerMove={stableOnPointerMove}
                    onPointerUp={stableOnPointerUp}
                  />
                );
              })}

              {/* Placed companion / board tokens — above characters, below adversaries */}
              {boardMapTokens.map(({ element, isMyCharacter: myChar }, stackIdx) => {
                const bandIdx = tokenRangeBands[element.instanceId];
                const rangeBand = bandIdx != null && bandIdx >= 0 ? RANGE_BANDS[bandIdx] : null;
                return (
                  <PlacedToken
                    key={element.instanceId}
                    element={element}
                    isMyCharacter={myChar}
                    isPlayer={isPlayer}
                    isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                    isPinned={pinnedToken?.element.instanceId === element.instanceId}
                    rangeBand={rangeBand}
                    zIndex={10 + charMapTokens.length + stackIdx}
                    pxPerFt={pxPerFt}
                    tokenSizePx={tokenSizePx}
                    onPointerDown={stableOnPointerDown}
                    onPointerMove={stableOnPointerMove}
                    onPointerUp={stableOnPointerUp}
                  />
                );
              })}

              {/* Placed adversary tokens — after characters so adversaries stay above; later instances stack higher */}
              {advMapTokens.map(({ element, instanceNum }, advIdx) => {
                const bandIdx = tokenRangeBands[element.instanceId];
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                return (
                  <PlacedToken
                    key={element.instanceId}
                    element={element}
                    isMyCharacter={false}
                    isPlayer={isPlayer}
                    isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                    isPinned={pinnedToken?.element.instanceId === element.instanceId}
                    instanceNum={instanceNum}
                    rangeBand={rangeBand}
                    zIndex={10 + charMapTokens.length + boardMapTokens.length + advIdx}
                    pxPerFt={pxPerFt}
                    tokenSizePx={tokenSizePx}
                    onPointerDown={stableOnPointerDown}
                    onPointerMove={stableOnPointerMove}
                    onPointerUp={stableOnPointerUp}
                  />
                );
              })}

              {visibleMapPings.map(p => (
                <MapPingNameLabel
                  key={p.id}
                  pingId={p.id}
                  xFt={p.xFt}
                  yFt={p.yFt}
                  pxPerFt={pxPerFt}
                  displayName={p.displayName}
                  onDismissMapPing={onDismissMapPing}
                />
              ))}
              </div>
            </div>
            {brushPreviewControlsActive &&
            mapConfigHasImage(mapConfig) &&
            (drawTool === 'brush' || drawTool === 'eraser' || drawTool === 'scribble') ? (
              <div
                className="absolute inset-0 z-[28] flex items-center justify-center pointer-events-none"
                aria-hidden
              >
                <div
                  className="rounded-full shrink-0"
                  style={{
                    width: brushRadiusPreviewScreenPx * 2,
                    height: brushRadiusPreviewScreenPx * 2,
                    backgroundColor:
                      drawTool === 'eraser' && !isPlayer ? 'transparent' : brushRgba,
                    border:
                      drawTool === 'eraser' && !isPlayer
                        ? '2px dashed rgba(255,255,255,0.85)'
                        : 'none',
                    boxShadow:
                      drawTool === 'eraser' && !isPlayer ? 'inset 0 0 0 1px rgba(0,0,0,0.35)' : undefined,
                  }}
                />
              </div>
            ) : null}
          </div>
          {mapAiPreviewActive ? (
            <div
              className="absolute inset-0 z-[8] bg-transparent"
              aria-hidden
              style={{ pointerEvents: 'auto' }}
            />
          ) : null}
          {showTotmOverlay ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-4 overflow-y-auto py-8"
              role="status"
            >
              <div className="text-dh-muted text-sm text-center max-w-3xl w-full space-y-2">
                <MapIcon size={32} className="mx-auto mb-1 opacity-50" aria-hidden />
                {gmEmptyMapHint ? (
                  <>
                    <div className="text-dh font-semibold tracking-wide text-base">Theatre of the Mind</div>
                    <p className="leading-snug">Drag tokens here and use relative positioning</p>
                    <div className="text-dh-muted/90 text-xs font-medium py-0.5">OR</div>
                    <p className="leading-snug">Drag / paste an image here and use a map</p>
                    {showImageGenAiUi ? (
                      <>
                        <div className="text-dh-muted/90 text-xs font-medium py-0.5">OR</div>
                        <div className="pointer-events-auto flex justify-center pt-1">
                          <button
                            type="button"
                            onClick={() => setAiMapOpen(true)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded border border-purple-800/50 hover:border-purple-600 text-purple-300 hover:text-purple-100 bg-purple-950/30 hover:bg-purple-900/40 transition-colors"
                            title="Generate map image with AI (x.ai)"
                          >
                            <Sparkles size={12} />
                            Generate with AI
                          </button>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="leading-snug">No map loaded</p>
                )}
              </div>
            </div>
          ) : null}
          {canControlMapView &&
            !(
              (!isPlayer && maps.length > 0 && onSetActiveView && onMapFreeExplore) ||
              (isPlayer && tableId && showPlayerMapViewStrip)
            ) && (
            <div className="pointer-events-none absolute right-2 bottom-2 z-20">
              <Tooltip label="Zoom to actors — fit everyone on the map at the closest zoom">
                <button
                  type="button"
                  aria-label="Zoom to Actors"
                  onClick={applyZoomToFitActors}
                  disabled={!hasPlacedActorsOnMap || mapAiPreviewActive}
                  className="pointer-events-auto shrink-0 p-1.5 rounded border border-dh-strong bg-dh-raised/90 shadow-md hover:bg-dh-hover text-dh-muted hover:text-dh disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Focus size={14} />
                </button>
              </Tooltip>
            </div>
          )}
          </div>
        </div>

        {/* Right tray — adversaries without position (GM only) */}
        {showRightTray && (
          <TrayColumn
            tokens={advTrayTokens}
            side="right"
            isHighlighted={highlightRightTray}
            trayRef={rightTrayRef}
            tokenSizePx={trayTokenSizePx}
            dragRef={dragRef}
            onPointerDown={stableOnPointerDown}
            onPointerMove={stableOnPointerMove}
            onPointerUp={stableOnPointerUp}
            pinnedInstanceId={pinnedToken?.element.instanceId}
          />
        )}

        {/* Hidden right tray ref for drop detection */}
        {!showRightTray && (
          <div ref={rightTrayRef} className="hidden" />
        )}

        {/* Drag ghost — follows cursor globally, same size as the source token */}
        {dragGhost && (
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: dragGhost.clientX - (dragGhost.grabOffsetX ?? dragGhost.tokenSize / 2),
              top: dragGhost.clientY - (dragGhost.grabOffsetY ?? dragGhost.tokenSize / 2),
            }}
          >
            <TokenCircle
              element={dragGhost.element}
              size={
                dragGhost.fromTray
                  ? (dragGhost.tokenSize ?? trayTokenSizePx)
                  : Math.round((dragGhost.tokenSize ?? tokenSizePx) * viewZoom)
              }
              instanceNum={dragGhost.instanceNum}
              isMyCharacter={dragGhost.isMyChar}
              isPlayer={isPlayer}
              isGhost
              rangeBand={draggedTokenRangeBandFromStatic}
              rangeBandGlowScale={3}
            />
          </div>
        )}
      </div>

      {/* Click-to-pin detail panel */}
      {pinnedToken && (() => {
        const el = activeElements.find(e => e.instanceId === pinnedToken.element.instanceId);
        if (!el) return null;
        const myChar =
          el.elementType === 'boardToken'
            ? isMyCharacter(parentByInstanceId.get(el.parentInstanceId) || {})
            : isMyCharacter(el);
        const canRemove = !isPlayer || myChar;
        if (el.elementType === 'character' && typeof renderPinnedCharacterPanel === 'function') {
          return renderPinnedCharacterPanel({
            element: el,
            anchorX: pinnedToken.anchorX,
            anchorY: pinnedToken.anchorY,
            onClose: () => setPinnedToken(null),
            updateActiveElement,
            onRemoveFromMap: canRemove
              ? () => {
                  updateActiveElement(el.instanceId, { tokenX: null, tokenY: null, mapId: null });
                  setPinnedToken(null);
                }
              : undefined,
          });
        }
        const advPinInstanceNum = el.elementType === 'adversary' ? instanceNumbers[el.instanceId] : null;
        return (
          <TokenDetailPanel
            element={el}
            isPlayer={isPlayer}
            isMyCharacter={myChar}
            updateActiveElement={updateActiveElement}
            queueManualTrackEdit={queueManualTrackEdit}
            pendingBanners={pendingBanners}
            pendingResourceCosts={pendingResourceCosts}
            lifeSupportSelections={lifeSupportSelections}
            onRemoveFromMap={canRemove ? () => {
              updateActiveElement(el.instanceId, { tokenX: null, tokenY: null, mapId: null });
              setPinnedToken(null);
            } : undefined}
            onClose={() => setPinnedToken(null)}
            anchorX={pinnedToken.anchorX}
            anchorY={pinnedToken.anchorY}
            tableId={tableId}
            adversaryTargetAid={
              el.elementType === 'adversary' && typeof renderAdversaryTargetAid === 'function'
                ? renderAdversaryTargetAid(el)
                : null
            }
            adversaryPinInstanceNum={advPinInstanceNum}
          />
        );
      })()}

      {typeof document !== 'undefined' && fireworksViewport && fireworksViewport.width > 0 && createPortal(
        <div
          ref={fireworksPortalMountRef}
          className="pointer-events-none overflow-hidden"
          style={{
            position: 'fixed',
            top: fireworksViewport.top,
            left: fireworksViewport.left,
            width: fireworksViewport.width,
            height: fireworksViewport.height,
            zIndex: 25,
          }}
          aria-hidden
        />,
        document.body,
      )}
    </div>
  );
}
