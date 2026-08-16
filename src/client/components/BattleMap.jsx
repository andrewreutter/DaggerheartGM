import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, Fragment, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  applyViewportWheelPanZoom,
  clampMapZoom,
  clampPanScroll,
  computeCameraViewportFt,
  computeDragDropTopLeftLocalPx,
  computeDragGhostCenterClientPx,
  computeMapZoomBounds,
  computePanToCenterInnerPointPx,
  computeZoomAndPanToFitInnerBounds,
  collectPlacedTokenInnerBounds,
  ZOOM_FIT_FILL_FRACTION,
  ZOOM_FIT_KIND_TYPES,
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
  ArrowRightToLine,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Settings,
  Eraser,
  Eye,
  EyeOff,
  Trash2,
  CircleX,
  Focus,
  Users,
  Swords,
  Camera,
  Radio,
  Paintbrush,
  PencilLine,
  Square,
  Circle,
  Pipette,
  Sparkles,
  Image as ImageIcon,
  Maximize2,
  Lock,
  LockOpen,
  FolderOpen,
  Hand,
  ArrowUpDown,
  Tag,
  Crown,
} from 'lucide-react';
import {
  assignSpotlightHolder,
  highestCatchUpKeys,
  isGmHolder,
  isSpotlightHolder,
  SPOTLIGHT_ACTIVE_BEAM_OPACITY,
  spotlightCatchUpCount,
  spotlightCharacterTooltip,
  spotlightInactiveBeamOpacity,
} from '../lib/spotlight.js';
import { ConditionsEditor } from './ConditionsEditor.jsx';
import { Tooltip } from './Tooltip.jsx';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { normalizeConditionsToList } from '../lib/conditions-utils.js';
import { conditionMarks } from '../lib/condition-symbols.js';
import { layoutTokenDotRing } from '../lib/token-dot-ring.js';
import { AnchoredFloatingPanel } from './AnchoredFloatingPanel.jsx';
import { getAuthToken, postMapPing, postMapScribble, postBannerAck, CLIENT_ID, imageGenEnabled } from '../lib/api.js';
import { useAiUiPreference } from '../lib/ai-ui-preference-context.jsx';
import { shouldShowImageGenAiUi } from '../lib/ai-ui-visibility.js';
import { MapAiImageDialog } from './MapAiImageDialog.jsx';
import { MapDetailsDialog } from './modals/MapDetailsDialog.jsx';
import { MapArtistCredit } from './MapArtistCredit.jsx';
import Fireworks from 'fireworks-js';
import { effectiveTokenMapId, DEFAULT_LEGACY_MAP_ID, mapConfigHasImage } from '../lib/map-table-state.js';
import { buildCharacterTrayTokenEntries, buildBoardTrayTokenEntries } from '../lib/character-tray-tokens.js';
import {
  trayProxyShouldSnapBullseye,
  bullseyeFtForPlacedTokenHover,
} from '../lib/tray-proxy-hover.js';
import { getMapDimensionsFt as getMapDimensions, MAP_SIZE_FT_MIN, MAP_SIZE_FT_MAX, DEFAULT_MAP_SIZE_FT } from '../lib/map-dimensions-ft.js';
import { getPlayerTotMEmptyMapHint } from '../lib/battle-map-totm-hint.js';
import { isAdversaryDefeated } from '../lib/helpers.js';
import { EncounterAdversaryMarkedSummary } from './EncounterAdversaryMarkedSummary.jsx';
import { playerEncounterInstanceRowVisible } from '../lib/encounter-adversary-player-summary.js';
import {
  getRangeBandIndexForDistanceFt,
  getTokenFootprintFt,
  ellipseRadiusAtAngle,
  tokenDistanceFtForElements,
  DEFAULT_TOKEN_FOOTPRINT_FT,
  combinePlanarDistanceWithAltitude,
} from '../lib/map-range.js';
import { computeTokenRenderPx } from '../lib/token-size.js';
import { pickRandomPlaceOnMapSpot, pickRandomPlaceOnMapSpots, getTokenTrayDirection } from '../lib/place-token-on-map.js';
import {
  ALTITUDE_CONTROL_GAP_PX,
  ALTITUDE_CONTROL_WIDTH_PX,
  ALTITUDE_STEP_FT,
  altitudeDragPxPerStep,
  altitudeStemOffsetPx,
  computeAltitudeStepsFromDragDeltaPx,
  formatAltitudeFt,
  isPointInExpandedHoverZone,
} from '../lib/token-altitude.js';
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
import { isAdversaryPresentForParty } from '../lib/party-scaled-adversaries.js';
import {
  isAdversaryVisibleToPlayers,
  canRevealAnyAdversaries,
  canHideAnyAdversaries,
} from '../lib/adversary-player-visibility.js';
import {
  canModifyMapObject,
  computeCornerAnchor,
  computeCornerResize,
  scaleBrushStroke,
} from '../lib/map-object-transform.js';

const MIN_PX_PER_FT = 33 / 5; // 6.6 px/ft — 5' token ≥ 33px touch target
const DRAG_THRESHOLD_PX = 8;
/** Approx. time for fireworks-js rocket to reach target (no API hook); tuned for default trace speed. */
const MAP_PING_FIREWORK_LAND_MS = 800;
const MAP_PING_LABEL_FADE_MS = 5000;
/** Placed tokens (characters, companions, adversaries) stack starting at this z-index — above the
 * persisted mapImage/drawShape objects (z=22) and the interactive draw/scribble canvases (z<=21),
 * so drawings on the map never render over tokens. */
const TOKEN_BASE_Z_INDEX = 30;
/** Range-band bullseye ring overlays render at z-index 55 (hover) / 56 (drag-follow). The token
 * currently snapped to the bullseye (bullseyeFt.excludeInstanceId) is elevated above both so it
 * isn't visually obscured by the rings drawn over it — matching how non-snapped tokens whose
 * normal stacking z-index happens to exceed 55/56 already render on top. */
const SNAPPED_TOKEN_Z_INDEX = 57;

/** Clears placement AND altitude so a re-placed token doesn't keep a stale height. */
const TRAY_UNPLACE_UPDATES = { tokenX: null, tokenY: null, mapId: null, altitude: 0 };

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
/** Extra tray width for the spotlight beam beside each character / the GM token. */
export const SPOTLIGHT_BEAM_WIDTH_PX = 35;
/** Tall enough that neighboring cones almost meet; width/left edge stay unchanged. */
const SPOTLIGHT_BEAM_HEIGHT_PX = 56;
/** How far the beam pulls back over the token so the cone kisses the circle. */
const SPOTLIGHT_BEAM_OVERLAP_PX = 6;

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

/**
 * Resolve the object that carries `tokenSizeWidth`/`tokenSizeLength`/`tokenSizeLinked` for a
 * placed/tray token. Characters and adversaries carry these fields directly (library-scoped
 * fields resolved onto the element). A Beastbound companion `boardToken` has no library record
 * of its own — its size lives on the parent character's `companion` sub-object instead.
 */
function resolveTokenSizeSource(element, parentByInstanceId) {
  if (!element) return null;
  if (element.elementType === 'boardToken' && element.tokenKind === 'companion') {
    const parent = parentByInstanceId?.get(element.parentInstanceId);
    return parent?.companion ?? null;
  }
  return element;
}

/**
 * Resolve the `imageUrl` that should be displayed on a token.
 * For a Beastbound companion `boardToken`, the URL lives on the parent character's `companion.imageUrl`.
 */
function resolveTokenImageUrl(element, parentByInstanceId) {
  if (element?.elementType === 'boardToken' && element.tokenKind === 'companion') {
    return parentByInstanceId?.get(element.parentInstanceId)?.companion?.imageUrl ?? null;
  }
  return element?.imageUrl ?? null;
}

/**
 * Return `element` with `imageUrl` set to the resolved companion portrait when it differs,
 * preserving object reference equality when nothing changed (keeps token memoization stable).
 */
function withResolvedTokenImage(element, parentByInstanceId) {
  if (!element) return element;
  const url = resolveTokenImageUrl(element, parentByInstanceId);
  const current = element.imageUrl ?? null;
  if (current === (url ?? null)) return element;
  return { ...element, imageUrl: url ?? undefined };
}

/**
 * Return `element` with `maxStress`, `currentStress`, and `conditions` merged from the parent
 * character's `companion` object for Beastbound companion boardTokens, so `TokenCircle` can show
 * pip rings and condition marks without extra prop threading. Preserves object reference when
 * values are unchanged.
 */
function withResolvedCompanionStress(element, parentByInstanceId) {
  if (!element) return element;
  if (element.elementType !== 'boardToken' || element.tokenKind !== 'companion') return element;
  const parent = parentByInstanceId?.get(element.parentInstanceId);
  const companion = parent?.companion;
  if (!companion) return element;
  const maxStress = companion.maxStress ?? 3;
  const currentStress = companion.currentStress ?? 0;
  const conditions = companion.conditions ?? '';
  if (
    element.maxStress === maxStress &&
    element.currentStress === currentStress &&
    (element.conditions ?? '') === conditions
  ) return element;
  return { ...element, maxStress, currentStress, conditions };
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
    mapSizeFt: mapRow?.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
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
function getThumbViewportTokenProxies(mapRow, viewState, activeElements, stripMapId, adversaryPartyScaleCount = null) {
  if (!mapConfigHasImage({ mapImageUrl: mapRow?.mapImageUrl }) || stripMapId == null) return [];
  const vw = THUMB_STRIP_W_PX;
  const vh = THUMB_STRIP_H_PX;
  const mc = {
    mapSizeFt: mapRow?.mapSizeFt ?? DEFAULT_MAP_SIZE_FT,
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
    if (isAdv && adversaryPartyScaleCount != null && !isAdversaryPresentForParty(el, adversaryPartyScaleCount)) continue;
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
    prev.stripMapId !== next.stripMapId ||
    prev.adversaryPartyScaleCount !== next.adversaryPartyScaleCount
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
  adversaryPartyScaleCount = null,
}) {
  const titleAttr = tooltipTitle !== undefined ? tooltipTitle : label;
  const thumbTokenProxies = useMemo(
    () => getThumbViewportTokenProxies(mapRow, viewState, activeElements, stripMapId, adversaryPartyScaleCount),
    [mapRow, viewState, activeElements, stripMapId, adversaryPartyScaleCount],
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
 * groups: [{ color, total, filled, kind?, marks? }] — empty groups already filtered out.
 * Each group's center is equally spaced around the ring (clockwise from 12 o'clock).
 * Within a resource group, filled dots come first, then empty (outline) dots.
 * A `kind: 'condition'` group is one pip per applied condition (symbols + instant tooltip)
 * and is omitted entirely when the token has no conditions, so it takes no ring space.
 */
function TokenDotRing({ sizeW, sizeH, groups }) {
  const layout = layoutTokenDotRing(sizeW, sizeH, groups);
  if (!layout) return null;
  const { dr, dots } = layout;
  const resourceDots = dots.filter((d) => d.kind !== 'condition');
  const conditionDots = dots.filter((d) => d.kind === 'condition');
  const markDiameter = Math.max(1, dr * 2);
  const markFont = Math.max(4, dr * 1.55);

  const filledSw = Math.min(0.5, dr * 0.3);
  const emptySw = Math.min(1, dr * 0.5);

  return (
    <div
      className="absolute pointer-events-none z-20"
      style={{ overflow: 'visible', top: -2, left: -2, width: sizeW, height: sizeH }}
    >
      <svg
        className="absolute pointer-events-none"
        width={sizeW}
        height={sizeH}
        viewBox={`0 0 ${sizeW} ${sizeH}`}
        style={{ overflow: 'visible' }}
      >
        {resourceDots.map((d) => (
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
        {conditionDots.map((d) => (
          <g key={d.key}>
            <circle
              cx={d.x}
              cy={d.y}
              r={dr}
              fill="rgba(15,15,20,0.92)"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={emptySw}
            />
            <text
              x={d.x}
              y={d.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#f8fafc"
              fontSize={markFont}
              fontWeight="700"
              style={{ pointerEvents: 'none' }}
            >
              {d.symbol}
            </text>
          </g>
        ))}
      </svg>
      {conditionDots.map((d) => (
        <div
          key={d.key}
          className="absolute pointer-events-auto"
          style={{
            left: d.x,
            top: d.y,
            width: markDiameter,
            height: markDiameter,
            transform: 'translate(-50%, -50%)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip label={d.name} placement="top" className="relative block w-full h-full">
            <span className="block w-full h-full" data-condition-mark={d.name} aria-label={d.name} />
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

// ─── MapConfigToolbar ────────────────────────────────────────────────────────

function MapConfigToolbar({
  mapConfig,
  onMapConfigChange,
  isUploading,
  onFileSelect,
  /** When provided, the upload label opens the quick-pick menu instead of a raw file picker. */
  onOpenQuickPick,
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
    mapSizeFt = DEFAULT_MAP_SIZE_FT,
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

  // Focus name input whenever the editor opens (gear click or new-table auto-edit)
  useEffect(() => {
    if (!isEditingName) return;
    const el = nameInputRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.focus();
      el.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isEditingName]);

  const commitName = () => {
    const trimmed = (nameInput || '').trim() || 'New Table';
    setNameInput(trimmed);
    if (onTableNameChange && trimmed !== tableName) onTableNameChange(trimmed);
    setIsEditingName(false);
  };

  const commitSize = () => {
    const v = Math.max(MAP_SIZE_FT_MIN, Math.min(MAP_SIZE_FT_MAX, parseInt(sizeInput, 10) || DEFAULT_MAP_SIZE_FT));
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
            <>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  nameInputRef.current?.focus();
                  nameInputRef.current?.select();
                }}
                className="flex items-center gap-1 py-1 pl-1 pr-0 rounded hover:bg-dh-hover/80 text-dh-muted hover:text-dh transition-colors"
                title="Table settings"
                aria-label="Table settings"
              >
                <Settings size={12} className="shrink-0" />
              </button>
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
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-dh-hover/80 text-dh font-semibold text-sm transition-colors"
              title="Table settings"
              aria-label="Table settings"
            >
              <Settings size={12} className="shrink-0 text-dh-muted" />
              <span className="truncate max-w-[200px]">{tableName || 'Untitled'}</span>
            </button>
          )
        ) : (
          <span className="px-2 py-1 text-dh font-semibold text-sm truncate max-w-[200px]">{tableName || 'Untitled'}</span>
        )}
        {onDeleteTable && isEditingName && (
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
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

        {onOpenQuickPick ? (
          <button
            type="button"
            onClick={() => onOpenQuickPick()}
            disabled={isUploading}
            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors border ${
              isUploading
                ? 'bg-dh-hover text-dh-muted cursor-not-allowed border-transparent'
                : 'text-violet-300/90 border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35'
            }`}
            title="Upload map image or place image on map"
            data-prep-target="build"
          >
            <Upload size={12} />
            {isUploading ? 'Uploading…' : mapImageUrl ? 'Map Image…' : 'Upload Map Image…'}
          </button>
        ) : (
          <label
            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors border ${
              isUploading
                ? 'bg-dh-hover text-dh-muted cursor-not-allowed border-transparent'
                : 'text-violet-300/90 border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35'
            }`}
            title="Upload or replace map image"
            data-prep-target="build"
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
        )}

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
            <Trash2 size={11} /> Remove
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

// ─── Token color classes (bg + border) ───────────────────────────────────────
// Both strings must be full literal class names so Tailwind's scanner picks them up.

const ADVERSARY_ROLE_TOKEN_CLASSES = {
  solo:     { bg: 'bg-red-800',     border: 'border-red-800' },
  bruiser:  { bg: 'bg-orange-700',  border: 'border-orange-700' },
  standard: { bg: 'bg-amber-800',   border: 'border-amber-800' },
  leader:   { bg: 'bg-yellow-500',  border: 'border-yellow-500' },
  ranged:   { bg: 'bg-lime-500',    border: 'border-lime-500' },
  skulk:    { bg: 'bg-violet-700',  border: 'border-violet-700' },
  horde:    { bg: 'bg-purple-600',  border: 'border-purple-600' },
  support:  { bg: 'bg-fuchsia-500', border: 'border-fuchsia-500' },
  social:   { bg: 'bg-pink-500',    border: 'border-pink-500' },
  minion:   { bg: 'bg-rose-400',    border: 'border-rose-400' },
};
const CHAR_MINE_TOKEN_CLASSES  = { bg: 'bg-green-700',   border: 'border-green-700' };
const CHAR_OTHER_TOKEN_CLASSES = { bg: 'bg-sky-700',     border: 'border-sky-700' };
const COMPANION_TOKEN_CLASSES  = { bg: 'bg-emerald-900', border: 'border-emerald-900' };
const DEFEATED_TOKEN_CLASSES   = { bg: 'bg-black',       border: 'border-black' };

// Rotating ally palette for characters + companions. Stays in the cool blue→green family so
// "good guys" remain visually distinct from the warm/magenta adversary role colors above.
// Ordered so the first few assignments are maximally distinct hues.
const ALLY_TOKEN_PALETTE = [
  { bg: 'bg-sky-600',     border: 'border-sky-600' },
  { bg: 'bg-emerald-600', border: 'border-emerald-600' },
  { bg: 'bg-cyan-400',    border: 'border-cyan-400' },
  { bg: 'bg-blue-700',    border: 'border-blue-700' },
  { bg: 'bg-teal-500',    border: 'border-teal-500' },
  { bg: 'bg-green-600',   border: 'border-green-600' },
  { bg: 'bg-blue-400',    border: 'border-blue-400' },
  { bg: 'bg-teal-800',    border: 'border-teal-800' },
  { bg: 'bg-green-800',   border: 'border-green-800' },
  { bg: 'bg-cyan-700',    border: 'border-cyan-700' },
];

/** Role / ally { bg, border } pair — same source TokenCircle and altitude stems use. */
function resolveTokenColorClasses(element, { isMyCharacter = false, allyColorClasses = null } = {}) {
  if (element.elementType === 'boardToken') return allyColorClasses ?? COMPANION_TOKEN_CLASSES;
  if (element.elementType === 'character') {
    return allyColorClasses ?? (isMyCharacter ? CHAR_MINE_TOKEN_CLASSES : CHAR_OTHER_TOKEN_CLASSES);
  }
  if (element.elementType === 'adversary' && isAdversaryDefeated(element)) return DEFEATED_TOKEN_CLASSES;
  return ADVERSARY_ROLE_TOKEN_CLASSES[element.role] ?? ADVERSARY_ROLE_TOKEN_CLASSES.standard;
}

/**
 * Fill class for the altitude stem: always the ally/role color (same `bg-*` as the
 * token), ignoring range-band glow and whether the token has a portrait. Tokens
 * without a portrait still use a black *border*; the stem uses the fill color.
 */
function tokenBaseBorderFillClass(element, opts) {
  return resolveTokenColorClasses(element, opts).bg;
}

// ─── TokenCircle ─────────────────────────────────────────────────────────────

function TokenCircle({
  element,
  sizeW,
  sizeH,
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
  allyColorClasses = null,
}) {
  const isChar = element.elementType === 'character';
  const isAdv = element.elementType === 'adversary';
  const isBoard = element.elementType === 'boardToken';

  const label = tokenAbbrev(
    isBoard ? (element.label != null ? String(element.label) : element.name) : element.name,
  );
  const instLabel = isAdv && instanceNum != null ? `#${instanceNum}` : null;

  // Build dot groups for border ring indicator. Skipped for dim tray proxies (`isProxy`) — the GM
  // already sees live HP/Stress/Armor pips (and condition marks) on the actual placed token, so
  // building + rendering a second full `TokenDotRing` per proxy (up to ~15 adversaries when most
  // are on-map) is wasted work.
  const dotGroups = [];
  if (!isProxy) {
    if (isBoard) {
      // Stress lives on the companion data merged onto the boardToken via withResolvedCompanionStress
      const stressMax = element.maxStress || 0;
      const stressMarked = Math.max(0, element.currentStress || 0);
      if (stressMax > 0) dotGroups.push({ color: '#f97316', total: stressMax, filled: Math.min(stressMarked, stressMax) });
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
    const marks = conditionMarks(element.conditions);
    if (marks.length > 0) {
      dotGroups.push({ kind: 'condition', total: marks.length, filled: marks.length, marks });
    }
  }

  // Range-band decoration: solid ring + intense outer glow (scale widens ring and blur, e.g. 3 for drag ghost)
  const glowScale = rangeBandGlowScale ?? 1;
  const glowStyle = rangeBand
    ? { boxShadow: `0 0 0 ${3 * glowScale}px ${rangeBand.tokenRing}, 0 0 ${18 * glowScale}px ${6 * glowScale}px ${rangeBand.tokenGlow}` }
    : {};

  // Pick the { bg, border } class pair for this token type. Characters and companions use their
  // rotating ally-palette assignment when provided; the mine/other/companion constants remain as
  // fallbacks for render paths without an assignment map.
  const tokenColorClasses = resolveTokenColorClasses(element, { isMyCharacter, allyColorClasses });
  const hasImage = !!element.imageUrl;
  // When the token has an image, use the role/type color as the border instead of black.
  const borderClass = hasImage ? tokenColorClasses.border : 'border-black';
  // Companions keep their ring decoration; other tokens use the plain bg.
  const bgRingClass = isBoard
    ? `${tokenColorClasses.bg} ring-2 ring-emerald-400/90`
    : tokenColorClasses.bg;

  const minSize = Math.min(sizeW, sizeH);
  const advDefeated = isAdv && isAdversaryDefeated(element);

  return (
    <div
      className={`
        relative rounded-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing
        border-2 ${borderClass} transition-opacity
        ${!hasImage ? bgRingClass : ''}
        ${isDragging ? 'opacity-30' : ''}
        ${isGhost ? 'opacity-90 pointer-events-none' : ''}
        ${isProxy ? (isOtherMapShelf ? 'opacity-[0.38]' : 'opacity-20') : ''}
        ${isPinned ? 'ring-2 ring-white ring-offset-1 ring-offset-dh-surface' : ''}
      `}
      style={{
        width: sizeW,
        height: sizeH,
        minWidth: sizeW,
        minHeight: sizeH,
        userSelect: 'none',
        ...glowStyle,
      }}
      title={isBoard ? (element.label || element.name || 'Token') : element.name}
    >
      {hasImage && (
        <img
          src={element.imageUrl}
          alt={element.name || ''}
          className="absolute inset-0 w-full h-full object-cover rounded-full pointer-events-none"
          draggable={false}
        />
      )}
      {!isProxy && <TokenDotRing sizeW={sizeW} sizeH={sizeH} groups={dotGroups} />}
      {advDefeated && (
        <div className="absolute inset-0 rounded-full bg-black/70 pointer-events-none" />
      )}
      {!hasImage && (
        <div className="relative z-10 flex flex-col items-center justify-center leading-none pointer-events-none">
          <span
            className="text-white font-bold leading-none"
            style={{ fontSize: Math.max(10, Math.round(minSize * (instLabel ? 0.3 : 0.35))) }}
          >
            {label}
          </span>
          {instLabel && (
            <span
              className="text-white/90 font-bold tabular-nums mt-0.5"
              style={{ fontSize: Math.max(7, Math.round(minSize * 0.2)) }}
            >
              {instLabel}
            </span>
          )}
        </div>
      )}
      {hasImage && instLabel && (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none z-10">
          <span
            className="bg-black/70 text-white font-bold tabular-nums rounded-sm px-0.5 leading-tight"
            style={{ fontSize: Math.max(7, Math.round(minSize * 0.2)) }}
          >
            {instLabel}
          </span>
        </div>
      )}
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
    pE.altitude === nE.altitude &&
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
    pE.maxArmor === nE.maxArmor &&
    pE.tokenSizeWidth === nE.tokenSizeWidth &&
    pE.tokenSizeLength === nE.tokenSizeLength &&
    pE.tokenSizeLinked === nE.tokenSizeLinked &&
    pE.imageUrl === nE.imageUrl &&
    pE.conditions === nE.conditions &&
    pE.visibleToPlayers === nE.visibleToPlayers
  );
}

const placedTokenPropsAreEqual = (prev, next) => {
  if (
    prev.zIndex !== next.zIndex ||
    prev.pxPerFt !== next.pxPerFt ||
    prev.tokenSizeWpx !== next.tokenSizeWpx ||
    prev.tokenSizeHpx !== next.tokenSizeHpx ||
    prev.isMyCharacter !== next.isMyCharacter ||
    prev.isPlayer !== next.isPlayer ||
    prev.isDragging !== next.isDragging ||
    prev.isPinned !== next.isPinned ||
    prev.instanceNum !== next.instanceNum ||
    prev.rangeBand !== next.rangeBand ||
    prev.allyColorClasses !== next.allyColorClasses ||
    prev.onPointerDown !== next.onPointerDown ||
    prev.onPointerMove !== next.onPointerMove ||
    prev.onPointerUp !== next.onPointerUp ||
    prev.onRevealHidden !== next.onRevealHidden
  ) {
    return false;
  }
  return tokenElementFieldsEqual(prev.element, next.element);
};

/**
 * Floating altitude HUD: a map-scale stem from the token center (positive = up the
 * screen, colored to the token's ally/role fill) with a compact always-on value
 * at the tip; the interactive control (and Δ chip) sits to the left of the token
 * and is hover-only. Drag the hover control vertically to change altitude (5' steps,
 * 1:1 with stem growth at the current map scale × zoom — pointer capture keeps the
 * drag even though the control stays put); double-click resets to ground. Permission
 * mirrors `canDrag`.
 */
function TokenAltitudeControl({
  element,
  tokenSizeWpx,
  tokenSizeHpx,
  pxPerFt,
  viewZoom,
  zIndex,
  altitudeDeltaFt = 0,
  showDelta = false,
  hoverFocused = false,
  positionDragActive = false,
  canAdjust = false,
  isMyCharacter = false,
  allyColorClasses = null,
  onChangeAltitude,
}) {
  const altitude = element.altitude ?? 0;

  // Local display altitude during drag. Kept in state so the label *and* stem update
  // live without sending a server op on every pointer move (which causes SSE round-trips
  // to snap the value back to earlier in-flight results).
  const [dragDisplayAltitude, setDragDisplayAltitude] = useState(null);
  const isDraggingRef = useRef(false);

  // Use the drag-local value while dragging; fall back to authoritative element value.
  const displayAltitude = dragDisplayAltitude ?? altitude;
  const dragging = dragDisplayAltitude != null;
  const showInteractive = (hoverFocused && !positionDragActive) || dragging;
  const showTip = displayAltitude !== 0;
  const stemOffsetPx = altitudeStemOffsetPx(displayAltitude, pxPerFt);
  const stemAbsPx = Math.abs(stemOffsetPx);
  const centerX = element.tokenX * pxPerFt + tokenSizeWpx / 2;
  const centerY = element.tokenY * pxPerFt + tokenSizeHpx / 2;
  const tipY = centerY - stemOffsetPx;
  const stemFillClass = tokenBaseBorderFillClass(element, { isMyCharacter, allyColorClasses });
  const tipLabelTransform = stemOffsetPx >= 0
    ? 'translate(-50%, calc(-100% - 2px))'
    : 'translate(-50%, 2px)';

  const lastPointerDownTimeRef = useRef(0);
  const dragRef = useRef(null);

  const onPointerDown = useCallback((e) => {
    if (!canAdjust) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const now = performance.now();
    const dt = now - lastPointerDownTimeRef.current;
    lastPointerDownTimeRef.current = now;
    if (dt < 400 && dt > 0) {
      lastPointerDownTimeRef.current = 0;
      onChangeAltitude?.(0);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = false;
    dragRef.current = {
      startClientY: e.clientY,
      startAltitude: altitude,
      latestAltitude: altitude,
      moved: false,
    };
  }, [canAdjust, altitude, onChangeAltitude]);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    const dy = Math.abs(e.clientY - d.startClientY);
    if (dy > DRAG_THRESHOLD_PX) {
      d.moved = true;
      isDraggingRef.current = true;
    }
    const pxPerStep = altitudeDragPxPerStep(pxPerFt, viewZoom);
    const steps = computeAltitudeStepsFromDragDeltaPx(d.startClientY - e.clientY, pxPerStep);
    const newAlt = d.startAltitude + steps * ALTITUDE_STEP_FT;
    d.latestAltitude = newAlt;
    // Update the visual display locally — no server op yet. Stem length uses this same value.
    setDragDisplayAltitude(newAlt);
  }, [pxPerFt, viewZoom]);

  const onPointerUp = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    e.stopPropagation();
    if (d.moved) {
      // Single server op on release; avoids SSE round-trip flicker during drag.
      onChangeAltitude?.(d.latestAltitude);
    }
    dragRef.current = null;
    isDraggingRef.current = false;
    setDragDisplayAltitude(null);
  }, [onChangeAltitude]);

  if (!showTip && !showInteractive && !showDelta) return null;

  return (
    <>
      {stemAbsPx > 0.5 && (
        <div
          aria-hidden
          className={`absolute pointer-events-none ${stemFillClass}`}
          style={{
            left: centerX,
            top: Math.min(centerY, tipY),
            width: 2,
            height: stemAbsPx,
            marginLeft: -1,
            boxShadow: '0 0 0 1px rgb(0 0 0 / 0.45)',
            zIndex: Math.max(1, zIndex - 1),
          }}
        />
      )}
      {showTip && (
        <div
          aria-hidden
          className="absolute pointer-events-none rounded border border-dh-border bg-dh-canvas/90 px-1 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-dh shadow-sm whitespace-nowrap"
          style={{
            left: centerX,
            top: tipY,
            transform: tipLabelTransform,
            width: 'fit-content',
            zIndex,
          }}
        >
          {formatAltitudeFt(displayAltitude)}
        </div>
      )}
      {(showDelta || showInteractive) && (
        <div
          className="absolute flex items-center justify-end gap-0.5"
          style={{
            left: element.tokenX * pxPerFt,
            top: centerY,
            transform: 'translate(-100%, -50%)',
            paddingRight: ALTITUDE_CONTROL_GAP_PX,
            zIndex,
            pointerEvents: 'none',
          }}
        >
          {showDelta && (
            <div className="rounded border border-sky-700/60 bg-sky-950/85 px-1 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-sky-200 shadow-sm">
              Δ{formatAltitudeFt(altitudeDeltaFt)}
            </div>
          )}
          {showInteractive && (
            <div
              className={`flex flex-col items-center rounded border border-dh-border bg-dh-canvas/90 px-1 py-0.5 text-[10px] font-semibold tabular-nums leading-none text-dh shadow-sm select-none ${canAdjust ? 'cursor-ns-resize' : ''}`}
              style={{
                width: ALTITUDE_CONTROL_WIDTH_PX,
                pointerEvents: canAdjust ? 'auto' : 'none',
                touchAction: canAdjust ? 'none' : undefined,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {canAdjust && <ArrowUpDown size={10} className="mb-0.5 text-dh-muted" />}
              {formatAltitudeFt(displayAltitude)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Memoized wrapper for a token placed on the map (see `placedTokenPropsAreEqual`). */
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
  tokenSizeWpx,
  tokenSizeHpx,
  allyColorClasses = null,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onRevealHidden,
}) {
  const p = MAP_TOKEN_HIT_PADDING_PX;
  const showHiddenReveal = typeof onRevealHidden === 'function';
  const badgeSize = Math.max(14, Math.min(22, Math.round(Math.min(tokenSizeWpx, tokenSizeHpx) * 0.36)));
  return (
    <div
      className="absolute"
      style={{
        left: element.tokenX * pxPerFt - p,
        top: element.tokenY * pxPerFt - p,
        padding: p,
        width: tokenSizeWpx + 2 * p,
        height: tokenSizeHpx + 2 * p,
        boxSizing: 'border-box',
        touchAction: 'none',
        zIndex,
      }}
      onPointerDown={(e) => onPointerDown(e, element, false)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="relative" style={{ width: tokenSizeWpx, height: tokenSizeHpx }}>
        <TokenCircle
          element={element}
          sizeW={tokenSizeWpx}
          sizeH={tokenSizeHpx}
          instanceNum={instanceNum}
          isMyCharacter={isMyCharacter}
          isPlayer={isPlayer}
          isDragging={isDragging}
          isPinned={isPinned}
          rangeBand={rangeBand}
          allyColorClasses={allyColorClasses}
        />
        {showHiddenReveal && (
          <div
            className="absolute z-20"
            style={{
              right: -Math.round(badgeSize * 0.15),
              bottom: -Math.round(badgeSize * 0.15),
            }}
          >
            <Tooltip label="Hidden from players — click to reveal">
              <button
                type="button"
                aria-label="Reveal adversary to players"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRevealHidden(element);
                }}
                className="flex items-center justify-center rounded-full border-2 border-black bg-dh-canvas text-amber-300 hover:text-amber-200 hover:bg-dh-hover shadow-md"
                style={{ width: badgeSize, height: badgeSize }}
              >
                <EyeOff size={Math.max(8, Math.round(badgeSize * 0.55))} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
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
    prev.allyColorClasses !== next.allyColorClasses ||
    prev.onPointerDown !== next.onPointerDown ||
    prev.onPointerMove !== next.onPointerMove ||
    prev.onPointerUp !== next.onPointerUp ||
    prev.onProxyHoverEnter !== next.onProxyHoverEnter ||
    prev.onProxyHoverLeave !== next.onProxyHoverLeave ||
    prev.onToggleVisibility !== next.onToggleVisibility
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
  allyColorClasses = null,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onProxyHoverEnter,
  onProxyHoverLeave,
  onToggleVisibility,
}) {
  const snapBullseyeOnHover = trayProxyShouldSnapBullseye({ isProxy, isOtherMapShelf });
  const showVisibility = typeof onToggleVisibility === 'function' && element.elementType === 'adversary';
  const visibleToPlayers = isAdversaryVisibleToPlayers(element);
  return (
    <div
      className="relative"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => onPointerDown(e, element, true)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={snapBullseyeOnHover && onProxyHoverEnter ? () => onProxyHoverEnter(element) : undefined}
      onPointerLeave={snapBullseyeOnHover && onProxyHoverLeave ? () => onProxyHoverLeave(element) : undefined}
    >
      <TokenCircle
        element={element}
        sizeW={tokenSizePx}
        sizeH={tokenSizePx}
        instanceNum={instanceNum}
        isMyCharacter={isMyCharacter}
        isDragging={isDragging}
        isPinned={isPinned}
        isProxy={isProxy}
        isOtherMapShelf={isOtherMapShelf}
        allyColorClasses={allyColorClasses}
      />
      {showVisibility && (
        <div className="absolute z-10" style={{ right: -2, bottom: -2 }}>
          <Tooltip label={visibleToPlayers ? 'Visible to players — click to hide' : 'Hidden from players — click to reveal'}>
            <button
              type="button"
              aria-label={visibleToPlayers ? 'Hide adversary from players' : 'Reveal adversary to players'}
              aria-pressed={!visibleToPlayers}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(element);
              }}
              className={`flex items-center justify-center rounded-full border border-dh-border bg-dh-canvas/95 shadow-sm
                ${visibleToPlayers ? 'text-dh-muted hover:text-dh' : 'text-amber-300 hover:text-amber-200'}`}
              style={{ width: 16, height: 16 }}
            >
              {visibleToPlayers ? <Eye size={10} /> : <EyeOff size={10} />}
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}, trayTokenPropsAreEqual);

/**
 * "Remove from map (return to tray)" / "Place on map" toggle button, shared by
 * `TokenDetailPanel` (adversaries, companion board tokens) and the character panel in
 * `GMTableView`. The icon always points toward the token's tray when removing it from the
 * map (left for characters/companions — left tray; right for adversaries — right tray) and
 * the opposite direction when placing it (moving away from the tray, onto the map).
 */
export function TokenTrayActionButton({
  elementType,
  isOnMap,
  onRemoveFromMap,
  onPlaceOnMap,
  size = 13,
  className,
}) {
  const trayDirection = getTokenTrayDirection(elementType);
  if (isOnMap) {
    if (!onRemoveFromMap) return null;
    const Icon = trayDirection === 'right' ? ArrowRightToLine : ArrowLeftToLine;
    return (
      <button
        type="button"
        onClick={onRemoveFromMap}
        className={className ?? 'p-1 rounded text-dh-muted hover:text-amber-400 transition-colors'}
        title="Remove from map (return to tray)"
      >
        <Icon size={size} />
      </button>
    );
  }
  if (!onPlaceOnMap) return null;
  const Icon = trayDirection === 'right' ? ArrowLeftToLine : ArrowRightToLine;
  return (
    <button
      type="button"
      onClick={onPlaceOnMap}
      className={className ?? 'p-1 rounded text-dh-muted hover:text-emerald-400 transition-colors'}
      title="Place on map"
    >
      <Icon size={size} />
    </button>
  );
}

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
  onPlaceOnMap,
  onDeleteFromTable,
  onClose,
  anchorX,
  anchorY,
  onOpenImageLightbox,
  tableId,
  /** Adversary pin: Encounter-panel-style marked stats + party target aid (replaces HP/Stress checkbox tracks). */
  adversaryTargetAid = null,
  adversaryPinInstanceNum = null,
  /** GM adversary pin: Encounter sidebar card + attack/feature actions. */
  adversaryEncounterCard = null,
  /** For boardToken companion panels: the parent character element (carries companion data and traits). */
  parentCharacterEl,
  /** Called with (rollText, displayName, rollMeta, opts) when the attack button is clicked. */
  onRoll,
  conditionsHistory = [],
  extraConditionSuggestions,
  onAddConditionsHistoryEntry,
  onRemoveConditionsHistoryEntry,
}) {
  const isAdv = element.elementType === 'adversary';
  const isBoard = element.elementType === 'boardToken';
  const isOnMap = element.tokenX != null && element.tokenY != null;
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

  const [openCompanionConditions, setOpenCompanionConditions] = useState(false);

  if (isBoard) {
    const companion = parentCharacterEl?.companion;
    const canEditCompanion = !isPlayer;
    const companionConditions = companion?.conditions || '';
    const companionHasConditions = normalizeConditionsToList(companionConditions).length > 0;
    const onCompanionStressChange = companion && canEditCompanion
      ? (s) => {
          const target = parentCharacterEl;
          if (!target) return;
          if (queueManualTrackEdit) {
            queueManualTrackEdit(target, { companion: { ...companion, currentStress: s } });
          } else {
            updateActiveElement(target.instanceId, { companion: { ...companion, currentStress: s } });
          }
        }
      : undefined;
    const onCompanionConditionsCommit = companion && canEditCompanion
      ? (v) => {
          const target = parentCharacterEl;
          if (!target) return;
          const next = { ...companion, conditions: v };
          if (queueManualTrackEdit) {
            queueManualTrackEdit(target, { companion: next });
          } else {
            updateActiveElement(target.instanceId, { companion: next });
          }
        }
      : undefined;
    const handleAttackRoll = onRoll && companion?.attackName?.trim() && parentCharacterEl
      ? () => {
          const spellcastKey = (parentCharacterEl.spellcastTrait || 'presence').toLowerCase();
          const spellcastScore = parentCharacterEl.traits?.[spellcastKey] ?? 0;
          const parts = [`${companion.name} ${companion.attackName} Hope [d12] Fear [d12]`];
          if (spellcastScore !== 0) parts.push(`${spellcastKey} [${spellcastScore}]`);
          parts.push('damage [d6] melee');
          onRoll(
            parts.join(' '),
            `${parentCharacterEl.name} (${companion.name})`,
            {
              _attackerInstanceId: parentCharacterEl.instanceId,
              _traitKey: spellcastKey,
              _intentPanelForActionRoll: true,
              _deferExperienceToPreRoll: true,
              _companionExperienceForRoll: true,
              _isSpellcastRoll: true,
            },
            { characterEl: parentCharacterEl },
          );
        }
      : null;
    const handleCompanionActRoll = onRoll && parentCharacterEl
      ? () => {
          const charName = parentCharacterEl.name != null ? String(parentCharacterEl.name) : 'Character';
          const spellcastKey = (parentCharacterEl.spellcastTrait || 'presence').toLowerCase();
          const spellcastScore = parentCharacterEl.traits?.[spellcastKey] ?? 0;
          const parts = [`${charName} Companion Act Hope [d12] Fear [d12]`];
          if (spellcastScore !== 0) parts.push(`${spellcastKey} [${spellcastScore}]`);
          onRoll(
            parts.join(' '),
            `${charName} Companion Act`,
            {
              _attackerInstanceId: parentCharacterEl.instanceId,
              _traitKey: spellcastKey,
              _intentPanelForActionRoll: true,
              _deferExperienceToPreRoll: true,
              _companionExperienceForRoll: true,
              _isSpellcastRoll: true,
            },
            { characterEl: parentCharacterEl },
          );
        }
      : null;

    return (
      <AnchoredFloatingPanel anchorX={anchorX} anchorY={anchorY} onEscape={onClose}>
      <div
        className="bg-dh-raised border border-dh-strong rounded-lg shadow-2xl min-w-[200px] max-w-[260px] overflow-hidden"
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b dh-tint-spellcast-strip flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {element.imageUrl && (
              <button
                type="button"
                onClick={() => onOpenImageLightbox?.(element.imageUrl)}
                className="shrink-0 rounded-full overflow-hidden border border-dh-strong hover:border-white transition-colors focus:outline-none focus:ring-1 focus:ring-white"
                style={{ width: 32, height: 32 }}
                title="View portrait"
              >
                <img src={element.imageUrl} alt={companion?.name || 'Companion'} className="w-full h-full object-cover" draggable={false} />
              </button>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-dh text-sm truncate">{companion?.name || element.label || 'Companion'}</div>
              {companion?.species ? (
                <div className="text-[11px] text-dh-muted truncate">{companion.species}</div>
              ) : (
                <div className="text-[11px] text-dh-muted">Companion</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TokenTrayActionButton
              elementType={element.elementType}
              isOnMap={isOnMap}
              onRemoveFromMap={onRemoveFromMap}
              onPlaceOnMap={onPlaceOnMap}
            />
            <button type="button" onClick={onClose} className="p-1 rounded text-dh-muted hover:text-white transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Body */}
        {companion && (
          <div className="p-3 space-y-2">
            {/* Evasion */}
            {companion.evasion != null && (
              <div className="text-[11px] text-dh-muted">
                Evasion <span className="font-bold text-cyan-400">{companion.evasion}</span>
              </div>
            )}

            {/* Stress track */}
            {(companion.maxStress || 0) > 0 && (
              <div className="flex items-center gap-1">
                <CheckboxTrack
                  total={companion.maxStress || 0}
                  filled={companion.currentStress ?? 0}
                  onSetFilled={onCompanionStressChange}
                  trackKind="stress"
                  label="Stress"
                  verbs={['Mark', 'Clear']}
                />
                {canEditCompanion && !companionHasConditions && !openCompanionConditions && (
                  <button
                    type="button"
                    onClick={() => setOpenCompanionConditions(true)}
                    className="ml-1 text-dh-muted hover:text-dh transition-colors shrink-0"
                    title="Add conditions"
                  >
                    <Tag size={10} />
                  </button>
                )}
              </div>
            )}
            {canEditCompanion && (companionHasConditions || openCompanionConditions) && (
              <div>
                <div className="text-xs text-dh-muted mb-0.5">Conditions</div>
                <ConditionsEditor
                  instanceId={`${parentCharacterEl?.instanceId || 'companion'}-companion-conditions`}
                  value={companionConditions}
                  onCommit={onCompanionConditionsCommit}
                  placeholder="Add condition…"
                  autoFocus={openCompanionConditions && !companionHasConditions}
                  suggestions={conditionsHistory}
                  extraSuggestions={extraConditionSuggestions}
                  onAddSuggestion={onAddConditionsHistoryEntry}
                  onRemoveSuggestion={onRemoveConditionsHistoryEntry}
                  onBlur={() => {
                    if (!companionHasConditions) setOpenCompanionConditions(false);
                  }}
                  className="w-full flex flex-wrap items-center gap-1 px-1.5 py-0.5 rounded bg-dh-hover border border-dh-strong text-dh text-xs focus-within:border-sky-500"
                />
              </div>
            )}
            {!canEditCompanion && companionHasConditions && (
              <div>
                <div className="text-xs text-dh-muted mb-0.5">Conditions</div>
                <ConditionsEditor value={companionConditions} readOnly />
              </div>
            )}

            {/* Attack */}
            {companion.attackName?.trim() && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-dh flex-1 min-w-0 truncate">
                  <span className="text-dh-muted">Attack: </span>{companion.attackName}
                </span>
                {handleAttackRoll && (
                  <button
                    type="button"
                    onClick={handleAttackRoll}
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border border-sky-700/60 bg-sky-900/30 text-sky-300 hover:bg-sky-800/50 hover:border-sky-500 transition-colors"
                  >
                    Roll
                  </button>
                )}
              </div>
            )}

            {/* Take an action — Companion Act spellcast roll */}
            {handleCompanionActRoll && (
              <div className="pt-1 border-t border-dh-border/50">
                <button
                  type="button"
                  onClick={handleCompanionActRoll}
                  className="w-full text-[11px] font-semibold px-2 py-1 rounded border border-violet-700/60 bg-violet-900/30 text-violet-300 hover:bg-violet-800/50 hover:border-violet-500 transition-colors"
                >
                  Take an action
                </button>
              </div>
            )}

            {/* Experiences */}
            {Array.isArray(companion.experiences) && companion.experiences.length > 0 && (
              <div className="space-y-0.5">
                {companion.experiences.map((exp, i) => (
                  <div key={exp.id ?? i} className="flex items-center gap-1 text-[11px]">
                    <span className="text-dh-muted shrink-0 tabular-nums">{exp.score != null ? `+${exp.score}` : ''}</span>
                    <span className="text-dh truncate">{exp.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      </AnchoredFloatingPanel>
    );
  }

  const hpMax = element.hp_max;
  const stressMax = element.stress_max;
  const gmEncounterAdvPin = isAdv && adversaryEncounterCard != null;
  const playerEncounterAdvPin = isAdv && !gmEncounterAdvPin && adversaryTargetAid != null;
  const encounterStyleAdvPin = gmEncounterAdvPin || playerEncounterAdvPin;

  return (
    <AnchoredFloatingPanel anchorX={anchorX} anchorY={anchorY} onEscape={onClose}>
    <div
      className={`bg-dh-raised border border-dh-strong rounded-lg shadow-2xl p-3 min-w-[180px] ${
        gmEncounterAdvPin
          ? 'max-w-[min(24rem,94vw)] max-h-[min(80vh,640px)] overflow-y-auto overflow-x-hidden'
          : encounterStyleAdvPin
            ? 'max-w-[min(22rem,94vw)] max-h-[min(72vh,560px)] overflow-y-auto overflow-x-hidden'
            : 'max-w-[240px]'
      }`}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {element.imageUrl && (
            <button
              type="button"
              onClick={() => onOpenImageLightbox?.(element.imageUrl)}
              className="shrink-0 rounded-full overflow-hidden border border-dh-strong hover:border-white transition-colors focus:outline-none focus:ring-1 focus:ring-white"
              style={{ width: 36, height: 36 }}
              title="View image"
            >
              <img src={element.imageUrl} alt={element.name || ''} className="w-full h-full object-cover" draggable={false} />
            </button>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm truncate">{element.name}</div>
            {isAdv && (
              <div className="text-xs text-dh-muted capitalize">{element.role || ''} {element.tier ? `T${element.tier}` : ''}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <TokenTrayActionButton
            elementType={element.elementType}
            isOnMap={isOnMap}
            onRemoveFromMap={onRemoveFromMap}
            onPlaceOnMap={onPlaceOnMap}
          />
          {isAdv && onDeleteFromTable && (
            <button
              type="button"
              onClick={onDeleteFromTable}
              className="p-1 rounded text-dh-muted hover:text-red-400 transition-colors"
              title="Delete from table"
            ><Trash2 size={13} /></button>
          )}
          <button onClick={onClose} className="p-1 rounded text-dh-muted hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {gmEncounterAdvPin ? (
        <>
          {adversaryEncounterCard}
          {adversaryTargetAid}
        </>
      ) : playerEncounterAdvPin ? (
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
              <ConditionsEditor
                instanceId={element.instanceId}
                value={element.conditions ?? ''}
                onCommit={(v) => updateActiveElement(element.instanceId, { conditions: v })}
                placeholder="Add condition…"
                suggestions={conditionsHistory}
                extraSuggestions={extraConditionSuggestions}
                onAddSuggestion={onAddConditionsHistoryEntry}
                onRemoveSuggestion={onRemoveConditionsHistoryEntry}
                className="w-full flex flex-wrap items-center gap-1 px-1.5 py-0.5 rounded bg-dh-hover border border-dh-strong text-dh text-xs focus-within:border-sky-500"
              />
            </div>
          )}
          {/* Read-only conditions for player on enemy */}
          {isPlayer && isAdv && normalizeConditionsToList(element.conditions).length > 0 && (
            <div>
              <div className="text-xs text-dh-muted mb-0.5">Conditions</div>
              <ConditionsEditor value={element.conditions ?? ''} readOnly />
            </div>
          )}
        </>
      )}
    </div>
    </AnchoredFloatingPanel>
  );
}

// ─── SpotlightBeam ───────────────────────────────────────────────────────────

function SpotlightBeam({ side, active, dimGlow, count, clickable, onClick, label, tooltip }) {
  const pointingLeft = side === 'right';
  const opacity = active ? SPOTLIGHT_ACTIVE_BEAM_OPACITY : spotlightInactiveBeamOpacity(count);
  const glowPx = active ? 14 : Math.min(14, 3 + count * 3);
  const gold = `rgba(253, 224, 71, ${opacity})`;
  const coneStyle = {
    width: SPOTLIGHT_BEAM_WIDTH_PX,
    height: SPOTLIGHT_BEAM_HEIGHT_PX,
    background: pointingLeft
      ? (active
        ? `linear-gradient(to left, transparent 0%, ${gold} 28%, ${gold} 100%)`
        : `linear-gradient(to left, transparent, ${gold})`)
      : (active
        ? `linear-gradient(to right, transparent 0%, ${gold} 28%, ${gold} 100%)`
        : `linear-gradient(to right, transparent, ${gold})`),
    clipPath: pointingLeft
      ? 'polygon(0 28%, 100% 0, 100% 100%, 0 72%)'
      : 'polygon(0 0, 100% 28%, 100% 72%, 0 100%)',
    filter: count > 0 || active
      ? `drop-shadow(0 0 ${glowPx}px rgba(253, 224, 71, ${active ? 0.95 : Math.min(0.85, opacity + 0.15)}))`
      : undefined,
  };
  const inner = (
    <>
      <div
        className={`pointer-events-none ${dimGlow && !active ? 'dh-spotlight-beam-dim-glow' : ''}`}
        style={coneStyle}
        aria-hidden
      />
      {active && (
        <span
          className={`absolute inset-0 flex flex-col justify-center leading-[1.05] font-extrabold text-[8px] text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.85)] pointer-events-none ${
            pointingLeft ? 'items-end pr-0.5 text-right' : 'items-start pl-0.5 text-left'
          }`}
          style={{ transform: pointingLeft ? 'translateX(-2px)' : 'translateX(2px)' }}
          aria-hidden
        >
          <span>Spot</span>
          <span>light</span>
        </span>
      )}
      {!active && count > 0 && (
        <span
          className={`absolute inset-0 flex items-center text-[8px] leading-none font-bold tabular-nums text-amber-50 drop-shadow-[0_0_2px_rgba(0,0,0,0.85)] pointer-events-none ${
            pointingLeft ? 'justify-end pr-0.5' : 'justify-start pl-0.5'
          }`}
          style={{ transform: pointingLeft ? 'translateX(-2px)' : 'translateX(2px)' }}
        >
          {count}
        </span>
      )}
    </>
  );
  const commonClass = `relative shrink-0 flex items-center justify-center ${clickable ? 'cursor-pointer hover:brightness-125' : ''}`;
  const commonStyle = { width: SPOTLIGHT_BEAM_WIDTH_PX, height: SPOTLIGHT_BEAM_HEIGHT_PX };
  const ariaLabel = tooltip || label || (active ? 'Spotlight (active)' : 'Give spotlight');
  const beam = clickable ? (
    <button
      type="button"
      className={commonClass}
      style={commonStyle}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {inner}
    </button>
  ) : (
    <div className={commonClass} style={commonStyle} aria-hidden={!active && !tooltip}>
      {inner}
    </div>
  );
  if (!tooltip) return beam;
  return (
    <Tooltip label={tooltip} placement={pointingLeft ? 'bottom-right' : 'right'} className="relative inline-flex">
      {beam}
    </Tooltip>
  );
}

function GmSpotlightToken({ tokenSizePx }) {
  return (
    <div className="flex flex-col items-center leading-none pointer-events-none">
      <div
        className="relative rounded-full flex items-center justify-center border-2 border-black bg-slate-700"
        style={{ width: tokenSizePx, height: tokenSizePx, minWidth: tokenSizePx, minHeight: tokenSizePx }}
        title="GM"
      >
        <Crown size={Math.max(12, Math.round(tokenSizePx * 0.45))} className="text-slate-200" />
      </div>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-dh-muted">GM</span>
    </div>
  );
}

// ─── TrayColumn ──────────────────────────────────────────────────────────────

function TrayColumn({
  tokens,
  side,
  isHighlighted,
  trayRef,
  tokenSizePx,
  dragRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onProxyHoverEnter,
  onProxyHoverLeave,
  pinnedInstanceId,
  allyColorsByInstanceId = null,
  showSpotlight = false,
  spotlight = null,
  spotlightClickable = false,
  onAssignCharacterSpotlight,
  highestCatchUpKeySet = null,
  onToggleAdversaryVisibility,
}) {
  if (tokens.length === 0) return null;

  const borderClass = side === 'left' ? 'border-r border-dh-border' : 'border-l border-dh-border';

  return (
    <div
      ref={trayRef}
      className={`flex flex-col items-center gap-2 py-3 px-1.5 shrink-0 pointer-events-auto
        ${showSpotlight && side === 'left' ? 'overflow-visible' : 'overflow-y-auto'}
        transition-colors duration-150 ${borderClass}
        ${isHighlighted ? 'bg-amber-900/30' : 'bg-dh-surface/60'}`}
      style={{ width: tokenSizePx + 16, minHeight: 0 }}
    >
      {tokens.map(({ element, instanceNum, isMyCharacter, isProxy, isOtherMapShelf }, i) => {
        const showBeam = showSpotlight && side === 'left' && element.elementType === 'character';
        const active = showBeam && isSpotlightHolder(spotlight, element.instanceId);
        const count = showBeam ? spotlightCatchUpCount(spotlight, element.instanceId) : 0;
        const dimGlow = showBeam && !active && count > 0 && highestCatchUpKeySet?.has(element.instanceId);
        const trayName = element.elementType === 'boardToken'
          ? (element.label || element.name)
          : element.name;
        const showTrayName = side === 'left'
          ? (element.elementType === 'character' || element.elementType === 'boardToken')
          : element.elementType === 'adversary' && tokens[i + 1]?.element?.id !== element.id;
        return (
          <div key={element.instanceId} className="flex flex-col items-center max-w-full">
            <div className="relative flex items-center justify-center">
              <TrayToken
                element={element}
                instanceNum={instanceNum}
                isMyCharacter={isMyCharacter}
                isProxy={isProxy}
                isOtherMapShelf={isOtherMapShelf}
                isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                isPinned={pinnedInstanceId === element.instanceId}
                tokenSizePx={tokenSizePx}
                allyColorClasses={allyColorsByInstanceId?.get(element.instanceId) ?? null}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onProxyHoverEnter={onProxyHoverEnter}
                onProxyHoverLeave={onProxyHoverLeave}
                onToggleVisibility={onToggleAdversaryVisibility}
              />
              {showBeam && (
                <div
                  className="absolute top-1/2 left-full z-30 -translate-y-1/2"
                  style={{ marginLeft: -SPOTLIGHT_BEAM_OVERLAP_PX }}
                >
                  <SpotlightBeam
                    side="left"
                    active={active}
                    dimGlow={dimGlow}
                    count={count}
                    clickable={spotlightClickable}
                    label={active ? `${element.name || 'Character'} holds the spotlight` : `Give spotlight to ${element.name || 'character'}`}
                    tooltip={spotlightCharacterTooltip(count, element.name, { active })}
                    onClick={() => onAssignCharacterSpotlight?.(element.instanceId)}
                  />
                </div>
              )}
            </div>
            {showTrayName && (
              <span
                className="block mt-0.5 px-0.5 text-[8px] leading-tight font-semibold text-center text-dh-muted whitespace-normal break-keep"
                style={{ maxWidth: tokenSizePx }}
                title={trayName || undefined}
              >
                {trayName || '—'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * "Place all on map" / "Return all to tray" bulk-action icon pair, docked at the top of a
 * tray. Icon direction mirrors `TokenTrayActionButton` — pointing away from the tray (toward
 * the map) for "place all", toward the tray for "return all" — using double chevrons so the
 * bulk action is visually distinct from the single-token `ArrowLeftToLine`/`ArrowRightToLine`
 * buttons. Each button disables itself when it would have no effect.
 */
function TrayBulkActionsHeader({ trayDirection, onPlaceAll, canPlaceAll, onReturnAll, canReturnAll }) {
  const PlaceIcon = trayDirection === 'right' ? ChevronsLeft : ChevronsRight;
  const ReturnIcon = trayDirection === 'right' ? ChevronsRight : ChevronsLeft;
  return (
    <div className="flex items-center justify-center gap-1 p-1 border-b border-dh-border shrink-0">
      <Tooltip label="Place all on map" className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onPlaceAll}
          disabled={!canPlaceAll}
          aria-label="Place all on map"
          className="w-full flex items-center justify-center py-1 rounded text-dh-muted hover:text-emerald-400 hover:bg-dh-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <PlaceIcon size={14} />
        </button>
      </Tooltip>
      <Tooltip label="Return all to tray" className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onReturnAll}
          disabled={!canReturnAll}
          aria-label="Return all to tray"
          className="w-full flex items-center justify-center py-1 rounded text-dh-muted hover:text-amber-400 hover:bg-dh-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <ReturnIcon size={14} />
        </button>
      </Tooltip>
    </div>
  );
}

/**
 * "Reveal all" / "Hide all" adversary visibility pair, docked under the GM token
 * and above the first adversary tray token. Disabled when the click would not
 * change any adversary's player-visibility state.
 */
function TrayVisibilityActionsHeader({ onRevealAll, canRevealAll, onHideAll, canHideAll }) {
  return (
    <div className="flex items-center justify-center gap-1 p-1 border-b border-dh-border shrink-0">
      <Tooltip label="Reveal all adversaries" className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onRevealAll}
          disabled={!canRevealAll}
          aria-label="Reveal all adversaries"
          className="w-full flex items-center justify-center py-1 rounded text-dh-muted hover:text-sky-400 hover:bg-dh-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <Eye size={14} />
        </button>
      </Tooltip>
      <Tooltip label="Hide all adversaries" className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onHideAll}
          disabled={!canHideAll}
          aria-label="Hide all adversaries"
          className="w-full flex items-center justify-center py-1 rounded text-dh-muted hover:text-amber-400 hover:bg-dh-hover transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <EyeOff size={14} />
        </button>
      </Tooltip>
    </div>
  );
}

const ZOOM_FIT_CONTROL_ITEMS = [
  {
    kind: 'actors',
    ariaLabel: 'Zoom to Actors',
    tooltip: 'Fit everyone on the map at the closest zoom',
    labeledText: 'Actors',
    Icon: Focus,
    labeledClassName: 'text-violet-200/95 border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35',
    iconClassName: 'text-dh-muted hover:text-dh',
  },
  {
    kind: 'party',
    ariaLabel: 'Zoom to Party',
    tooltip: 'Fit the party on the map at the closest zoom',
    labeledText: 'Party',
    Icon: Users,
    labeledClassName: 'text-sky-200/95 border-sky-500/35 bg-sky-950/25 hover:bg-sky-900/35',
    iconClassName: 'text-sky-400 hover:text-sky-300',
  },
  {
    kind: 'adversaries',
    ariaLabel: 'Zoom to Adversaries',
    tooltip: 'Fit adversaries on the map at the closest zoom',
    labeledText: 'Adversaries',
    Icon: Swords,
    labeledClassName: 'text-amber-200/95 border-amber-500/35 bg-amber-950/25 hover:bg-amber-900/35',
    iconClassName: 'text-amber-400 hover:text-amber-300',
  },
];

/** Width for the ZOOM TO column (icon + label in a row). */
const MAP_STRIP_ZOOM_COL_WIDTH_PX = 112;

/** Underlined group label spanning the button column beneath (Zoom to / Maps & Cameras / Scene). */
function MapStripGroupLabel({ children }) {
  return (
    <div className="mb-0.5 w-full border-b border-dh-muted/55 pb-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-dh-muted leading-none whitespace-nowrap">
      {children}
    </div>
  );
}

/**
 * Compact map-strip button: icon left, label right.
 * `grow` — fill leftover height in a stretched pair column.
 * `width` — fixed px, `'fit'` for content-sized (SCENE), or `'fill'` to stretch to the parent column.
 */
function MapStripActionButton({
  onClick,
  disabled = false,
  ariaLabel,
  ariaPressed,
  className,
  iconSize,
  Icon,
  label,
  /** Optional stacked lines (icon left, multi-line text right). Takes precedence over `label`. */
  labelLines = null,
  tooltip,
  tooltipPlacement = 'bottom',
  grow = false,
  width = MAP_STRIP_ZOOM_COL_WIDTH_PX,
  /** Prep checklist hover target: `build` | `invite` | `play` */
  dataPrepTarget = null,
}) {
  const fit = width === 'fit';
  const fill = width === 'fill';
  const stacked = Array.isArray(labelLines) && labelLines.length > 0;
  return (
    <Tooltip
      label={tooltip}
      placement={tooltipPlacement}
      className={
        grow
          ? 'relative flex min-h-0 min-w-0 flex-1 flex-col'
          : 'relative block w-full min-w-0'
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        data-prep-target={dataPrepTarget || undefined}
        className={`w-full min-w-0 flex flex-row items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] leading-tight border disabled:opacity-40 disabled:pointer-events-none box-border ${
          grow ? 'flex-1' : ''
        } ${className}`}
        style={fit || fill ? undefined : { width, maxWidth: width }}
      >
        <Icon size={iconSize} strokeWidth={1.25} className="shrink-0" aria-hidden />
        <span
          className={`min-w-0 text-left font-medium leading-tight ${
            fit ? 'whitespace-nowrap' : stacked ? 'flex-1' : 'flex-1 truncate'
          }`}
        >
          {stacked
            ? labelLines.map((line, i) => (
                <span key={`${i}-${line}`} className="block">
                  {line}
                </span>
              ))
            : label}
        </span>
      </button>
    </Tooltip>
  );
}

/**
 * Zoom-to-fit trio (Actors / Party / Adversaries).
 * Labeled variant: vertical stack with icon-left / text-right under an optional group label.
 * Icon variant: compact horizontal icon-only row (floating map overlay).
 */
function ZoomToFitControls({
  variant = 'labeled',
  iconSize,
  onZoomToFit,
  hasPlacedByKind,
  extraDisabled = false,
  tooltipPlacement = 'left',
  groupLabel = null,
}) {
  if (variant === 'icon') {
    return (
      <div className="flex flex-row items-stretch gap-1">
        {ZOOM_FIT_CONTROL_ITEMS.map((item) => {
          const disabled = extraDisabled || !hasPlacedByKind[item.kind];
          return (
            <Tooltip key={item.kind} label={item.tooltip}>
              <button
                type="button"
                aria-label={item.ariaLabel}
                onClick={() => onZoomToFit(item.kind)}
                disabled={disabled}
                className={`pointer-events-auto shrink-0 p-1.5 rounded border border-dh-strong bg-dh-raised/90 shadow-md hover:bg-dh-hover disabled:opacity-40 disabled:pointer-events-none ${item.iconClassName}`}
              >
                <item.Icon size={iconSize} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  const buttons = (
    <div className="flex h-full min-h-0 flex-col items-stretch gap-0.5">
      {ZOOM_FIT_CONTROL_ITEMS.map((item) => (
        <MapStripActionButton
          key={item.kind}
          onClick={() => onZoomToFit(item.kind)}
          disabled={extraDisabled || !hasPlacedByKind[item.kind]}
          ariaLabel={item.ariaLabel}
          className={item.labeledClassName}
          iconSize={iconSize}
          Icon={item.Icon}
          label={item.labeledText}
          tooltip={item.tooltip}
          tooltipPlacement={tooltipPlacement}
          width={MAP_STRIP_ZOOM_COL_WIDTH_PX}
        />
      ))}
    </div>
  );

  if (groupLabel) {
    return (
      <div
        className="flex h-full min-h-0 flex-col items-stretch self-stretch"
        style={{ width: MAP_STRIP_ZOOM_COL_WIDTH_PX }}
      >
        <MapStripGroupLabel>{groupLabel}</MapStripGroupLabel>
        {buttons}
      </div>
    );
  }
  return buttons;
}

// ─── Shared map-object primitives (MapImageObject + DrawShapeObject) ────────

/** Shared four-corner resize grip styling. */
const MAP_OBJECT_CORNER_GRIP_STYLE = {
  width: 8,
  height: 8,
  background: 'rgba(56,189,248,0.9)',
  border: '1.5px solid white',
  borderRadius: 2,
  touchAction: 'none',
};
const mapObjectCornerWrapStyle = (corner) => ({
  position: 'absolute',
  ...(corner === 'NW' || corner === 'SW' ? { left: -10 } : { right: -10 }),
  ...(corner === 'NW' || corner === 'NE' ? { top: -10 } : { bottom: -10 }),
  width: 20,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: corner === 'NW' ? 'nw-resize' : corner === 'NE' ? 'ne-resize' : corner === 'SW' ? 'sw-resize' : 'se-resize',
  touchAction: 'none',
  zIndex: 2,
});

/**
 * Small pill (shown next to Delete when a map object is selected) for reassigning which layer
 * (Map, or a specific camera view on the current map) the object is visible on.
 */
function MapObjectLayerControl({ viewId, layerOptions, onChangeViewId }) {
  if (!layerOptions?.length) return null;
  return (
    <select
      value={viewId ?? ''}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChangeViewId(e.target.value || null)}
      className="rounded border border-dh-strong bg-dh-raised px-1 py-0.5 text-[10px] text-dh-muted hover:text-dh"
      title="Layer: Map (always visible) or a specific camera view"
    >
      <option value="">Map</option>
      {layerOptions.map((v) => (
        <option key={v.id} value={v.id}>{v.name || 'View'}</option>
      ))}
    </select>
  );
}

/**
 * Placeable, resizable image element rendered between the draw-overlay layer and the token layer.
 * Drag the body to move (direct-drag, like tokens); drag any of the four corner grips (when
 * selected and modifiable) to resize (aspect-ratio locked, opposite corner anchored). Double-click
 * opens the image in a lightbox. A floating toolbar (shown when selected) provides Layer + Delete.
 * Read-only to non-creator players (`canModify=false`): renders normally but ignores drag/resize/
 * delete/eraser-click. While the Eraser tool is active, a plain click deletes the object instead of
 * toggling selection.
 */
function MapImageObject({
  element,
  pxPerFt,
  mapZoom,
  isSelected,
  onSelect,
  onDeselect,
  canModify = true,
  isEraserActive = false,
  layerOptions,
  onUpdateMapImageObject,
  onRemoveMapImageObject,
  onOpenImageLightbox,
}) {
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  // Tracks timestamp of last pointer-down for manual double-click detection.
  // The <img> is pointer-events-none so native dblclick never fires; we synthesize it here.
  const lastPointerDownTimeRef = useRef(0);

  // Local optimistic position during body drag
  const [localPos, setLocalPos] = useState(null); // { xFt, yFt }
  // Local optimistic position+size during corner resize (center moves as opposite corner is anchored)
  const [localResize, setLocalResize] = useState(null); // { xFt, yFt, widthFt, heightFt }

  const onPointerDownBody = useCallback((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Prevent browser from treating rapid clicks as a text/element selection gesture.
    e.preventDefault();

    // Manual double-click: two pointer-downs within 400ms without a drag between them → open lightbox.
    const now = performance.now();
    const dt = now - lastPointerDownTimeRef.current;
    lastPointerDownTimeRef.current = now;
    if (dt < 400 && dt > 0 && onOpenImageLightbox) {
      lastPointerDownTimeRef.current = 0; // reset so triple-tap doesn't re-trigger
      onOpenImageLightbox(element.imageUrl);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXFt: element.tokenX ?? 0,
      startYFt: element.tokenY ?? 0,
      moved: false,
    };
  }, [element.tokenX, element.tokenY, element.imageUrl, onOpenImageLightbox]);

  const onPointerMoveBody = useCallback((e) => {
    if (!dragRef.current) return;
    if (
      Math.abs(e.clientX - dragRef.current.startClientX) > DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - dragRef.current.startClientY) > DRAG_THRESHOLD_PX
    ) {
      dragRef.current.moved = true;
    }
    if (!canModify) return;
    const dx = (e.clientX - dragRef.current.startClientX) / (pxPerFt * mapZoom);
    const dy = (e.clientY - dragRef.current.startClientY) / (pxPerFt * mapZoom);
    setLocalPos({ xFt: dragRef.current.startXFt + dx, yFt: dragRef.current.startYFt + dy });
  }, [pxPerFt, mapZoom, canModify]);

  const onPointerUpBody = useCallback((e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (d.moved) {
      // A real drag completed — clear the double-click timer so the next tap starts fresh.
      lastPointerDownTimeRef.current = 0;
      if (canModify && localPos) {
        onUpdateMapImageObject?.(element.instanceId, { tokenX: localPos.xFt, tokenY: localPos.yFt });
      }
      setLocalPos(null);
      return;
    }
    setLocalPos(null);
    // Click (no drag): Eraser tool deletes; otherwise toggle selection.
    if (isEraserActive && canModify) {
      onRemoveMapImageObject?.(element.instanceId);
      return;
    }
    if (isSelected) onDeselect?.(); else onSelect?.();
  }, [localPos, element.instanceId, onUpdateMapImageObject, canModify, isEraserActive, onRemoveMapImageObject, isSelected, onSelect, onDeselect]);

  // Corner resize — supports NW/NE/SW/SE with opposite-corner anchoring (aspect-ratio locked).
  const onPointerDownCorner = useCallback((e, corner) => {
    if (e.button !== 0 || !canModify) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ratio = element.imageNaturalHeight && element.imageNaturalWidth
      ? element.imageNaturalHeight / element.imageNaturalWidth
      : 1;
    const cx = element.tokenX ?? 0;
    const cy = element.tokenY ?? 0;
    const w = element.widthFt ?? 20;
    const h = element.heightFt ?? w * ratio;
    const { anchorX, anchorY } = computeCornerAnchor({ corner, cx, cy, widthFt: w, heightFt: h });
    resizeRef.current = { corner, startClientX: e.clientX, startClientY: e.clientY, startWidthFt: w, startHeightFt: h, ratio, anchorX, anchorY };
  }, [canModify, element.tokenX, element.tokenY, element.widthFt, element.heightFt, element.imageNaturalWidth, element.imageNaturalHeight]);

  const onPointerMoveCorner = useCallback((e) => {
    if (!resizeRef.current) return;
    const { corner, startClientX, startClientY, startWidthFt, startHeightFt, ratio, anchorX, anchorY } = resizeRef.current;
    const dxFt = (e.clientX - startClientX) / (pxPerFt * mapZoom);
    const dyFt = (e.clientY - startClientY) / (pxPerFt * mapZoom);
    setLocalResize(computeCornerResize({ mode: 'aspectLocked', corner, dxFt, dyFt, anchorX, anchorY, startWidthFt, startHeightFt, ratio, minSizeFt: 2 }));
  }, [pxPerFt, mapZoom]);

  const onPointerUpCorner = useCallback((e) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (localResize) {
      onUpdateMapImageObject?.(element.instanceId, {
        tokenX: localResize.xFt,
        tokenY: localResize.yFt,
        widthFt: localResize.widthFt,
        heightFt: localResize.heightFt,
      });
    }
    setLocalResize(null);
  }, [localResize, element.instanceId, onUpdateMapImageObject]);

  const displayXFt = localResize ? localResize.xFt : (localPos ? localPos.xFt : (element.tokenX ?? 0));
  const displayYFt = localResize ? localResize.yFt : (localPos ? localPos.yFt : (element.tokenY ?? 0));
  const displayWidthFt = localResize ? localResize.widthFt : (element.widthFt ?? 20);
  const displayHeightFt = localResize ? localResize.heightFt : (element.heightFt ?? 20);

  const displayWidthPx = displayWidthFt * pxPerFt;
  const displayHeightPx = displayHeightFt * pxPerFt;
  const displayLeftPx = displayXFt * pxPerFt - displayWidthPx / 2;
  const displayTopPx = displayYFt * pxPerFt - displayHeightPx / 2;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: displayLeftPx,
          top: displayTopPx,
          width: displayWidthPx,
          height: displayHeightPx,
          cursor: !canModify ? 'default' : isEraserActive ? 'crosshair' : isSelected ? 'grab' : 'pointer',
          touchAction: 'none',
          userSelect: 'none',
          // z=22 sits above the scribble canvas (z=21) so pointer events reach the image body
          zIndex: 22,
        }}
        onPointerDown={onPointerDownBody}
        onPointerMove={onPointerMoveBody}
        onPointerUp={onPointerUpBody}
      >
        <img
          src={element.imageUrl}
          alt=""
          draggable={false}
          className={`w-full h-full object-contain pointer-events-none select-none ${isSelected ? 'ring-2 ring-sky-400' : ''}`}
          style={{ display: 'block' }}
        />
        {isSelected && canModify && (
          <>
            {/* Four corner resize grips — each anchors the opposite corner */}
            {['NW', 'NE', 'SW', 'SE'].map((corner) => (
              <div
                key={corner}
                style={mapObjectCornerWrapStyle(corner)}
                onPointerDown={(e) => onPointerDownCorner(e, corner)}
                onPointerMove={onPointerMoveCorner}
                onPointerUp={onPointerUpCorner}
              >
                <div style={MAP_OBJECT_CORNER_GRIP_STYLE} />
              </div>
            ))}
            {/* Layer + Delete toolbar — top-center */}
            <div
              style={{
                position: 'absolute',
                top: -28,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
              className="flex items-center gap-1"
            >
              <MapObjectLayerControl
                viewId={element.viewId ?? null}
                layerOptions={layerOptions}
                onChangeViewId={(viewId) => onUpdateMapImageObject?.(element.instanceId, { viewId })}
              />
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onRemoveMapImageObject?.(element.instanceId); }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-dh-raised border border-dh-strong text-red-400 hover:text-red-300 hover:bg-red-950/40 text-xs shadow-md transition-colors"
                title="Remove image from map"
              >
                <Trash2 size={11} />
                Remove
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/**
 * Placeable, resizable vector shape (`drawShape`: rect/oval/brush) rendered alongside `MapImageObject`
 * at the same z-index. Shares the same direct-drag body interaction, corner-resize primitives (`free`
 * for rect/oval, `uniform` for brush — scales `pointsFt`/`radiusFt` together), Eraser-click-to-delete,
 * layer control, and creator-or-GM permission gating as `MapImageObject` (see map-object-transform.js).
 */
function DrawShapeObject({
  element,
  pxPerFt,
  mapZoom,
  isSelected,
  onSelect,
  onDeselect,
  canModify = true,
  isEraserActive = false,
  layerOptions,
  onUpdateMapImageObject,
  onRemoveMapImageObject,
}) {
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const [localPos, setLocalPos] = useState(null); // { xFt, yFt }
  const [localResize, setLocalResize] = useState(null); // { xFt, yFt, widthFt, heightFt, scaleFactor? }

  const onPointerDownBody = useCallback((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startXFt: element.tokenX ?? 0,
      startYFt: element.tokenY ?? 0,
      moved: false,
    };
  }, [element.tokenX, element.tokenY]);

  const onPointerMoveBody = useCallback((e) => {
    if (!dragRef.current) return;
    if (
      Math.abs(e.clientX - dragRef.current.startClientX) > DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - dragRef.current.startClientY) > DRAG_THRESHOLD_PX
    ) {
      dragRef.current.moved = true;
    }
    if (!canModify) return;
    const dx = (e.clientX - dragRef.current.startClientX) / (pxPerFt * mapZoom);
    const dy = (e.clientY - dragRef.current.startClientY) / (pxPerFt * mapZoom);
    setLocalPos({ xFt: dragRef.current.startXFt + dx, yFt: dragRef.current.startYFt + dy });
  }, [pxPerFt, mapZoom, canModify]);

  const onPointerUpBody = useCallback((e) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (d.moved) {
      if (canModify && localPos) {
        onUpdateMapImageObject?.(element.instanceId, { tokenX: localPos.xFt, tokenY: localPos.yFt });
      }
      setLocalPos(null);
      return;
    }
    setLocalPos(null);
    if (isEraserActive && canModify) {
      onRemoveMapImageObject?.(element.instanceId);
      return;
    }
    if (isSelected) onDeselect?.(); else onSelect?.();
  }, [localPos, element.instanceId, onUpdateMapImageObject, canModify, isEraserActive, onRemoveMapImageObject, isSelected, onSelect, onDeselect]);

  const onPointerDownCorner = useCallback((e, corner) => {
    if (e.button !== 0 || !canModify) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const cx = element.tokenX ?? 0;
    const cy = element.tokenY ?? 0;
    const w = element.widthFt ?? 4;
    const h = element.heightFt ?? 4;
    const { anchorX, anchorY } = computeCornerAnchor({ corner, cx, cy, widthFt: w, heightFt: h });
    resizeRef.current = { corner, startClientX: e.clientX, startClientY: e.clientY, startWidthFt: w, startHeightFt: h, ratio: w ? h / w : 1, anchorX, anchorY };
  }, [canModify, element.tokenX, element.tokenY, element.widthFt, element.heightFt]);

  const onPointerMoveCorner = useCallback((e) => {
    if (!resizeRef.current) return;
    const { corner, startClientX, startClientY, startWidthFt, startHeightFt, ratio, anchorX, anchorY } = resizeRef.current;
    const dxFt = (e.clientX - startClientX) / (pxPerFt * mapZoom);
    const dyFt = (e.clientY - startClientY) / (pxPerFt * mapZoom);
    const mode = element.shapeTool === 'brush' ? 'uniform' : 'free';
    const next = computeCornerResize({ mode, corner, dxFt, dyFt, anchorX, anchorY, startWidthFt, startHeightFt, ratio, minSizeFt: 1 });
    setLocalResize(element.shapeTool === 'brush' ? { ...next, scaleFactor: next.widthFt / startWidthFt } : next);
  }, [pxPerFt, mapZoom, element.shapeTool]);

  const onPointerUpCorner = useCallback((e) => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (localResize) {
      if (element.shapeTool === 'brush' && localResize.scaleFactor != null) {
        const scaled = scaleBrushStroke(element.pointsFt, element.radiusFt ?? 1, localResize.scaleFactor);
        onUpdateMapImageObject?.(element.instanceId, {
          tokenX: localResize.xFt,
          tokenY: localResize.yFt,
          widthFt: localResize.widthFt,
          heightFt: localResize.heightFt,
          pointsFt: scaled.pointsFt,
          radiusFt: scaled.radiusFt,
        });
      } else {
        onUpdateMapImageObject?.(element.instanceId, {
          tokenX: localResize.xFt,
          tokenY: localResize.yFt,
          widthFt: localResize.widthFt,
          heightFt: localResize.heightFt,
        });
      }
    }
    setLocalResize(null);
  }, [localResize, element, onUpdateMapImageObject]);

  const displayXFt = localResize ? localResize.xFt : (localPos ? localPos.xFt : (element.tokenX ?? 0));
  const displayYFt = localResize ? localResize.yFt : (localPos ? localPos.yFt : (element.tokenY ?? 0));
  const displayWidthFt = localResize ? localResize.widthFt : (element.widthFt ?? 4);
  const displayHeightFt = localResize ? localResize.heightFt : (element.heightFt ?? 4);

  const displayWidthPx = displayWidthFt * pxPerFt;
  const displayHeightPx = displayHeightFt * pxPerFt;
  const displayLeftPx = displayXFt * pxPerFt - displayWidthPx / 2;
  const displayTopPx = displayYFt * pxPerFt - displayHeightPx / 2;

  const rgba = element.rgba || 'rgba(0,0,0,1)';
  const isBrush = element.shapeTool === 'brush';
  const liveScaleFactor = localResize?.scaleFactor ?? 1;
  const displayPointsFt = isBrush
    ? (liveScaleFactor === 1 ? (element.pointsFt || []) : scaleBrushStroke(element.pointsFt, element.radiusFt ?? 1, liveScaleFactor).pointsFt)
    : null;
  const displayRadiusFt = isBrush ? (element.radiusFt ?? 1) * liveScaleFactor : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: displayLeftPx,
        top: displayTopPx,
        width: displayWidthPx,
        height: displayHeightPx,
        cursor: !canModify ? 'default' : isEraserActive ? 'crosshair' : isSelected ? 'grab' : 'pointer',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 22,
      }}
      onPointerDown={onPointerDownBody}
      onPointerMove={onPointerMoveBody}
      onPointerUp={onPointerUpBody}
    >
      {isBrush ? (
        <svg
          width={displayWidthPx}
          height={displayHeightPx}
          className={isSelected ? 'ring-2 ring-sky-400' : ''}
          style={{ display: 'block', overflow: 'visible' }}
        >
          <path
            d={(displayPointsFt || []).reduce(
              (acc, p, i) =>
                `${acc}${i === 0 ? 'M' : 'L'} ${p.x * pxPerFt + displayWidthPx / 2},${p.y * pxPerFt + displayHeightPx / 2} `,
              '',
            )}
            stroke={rgba}
            strokeWidth={Math.max(1, 2 * displayRadiusFt * pxPerFt)}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      ) : (
        <div
          className={isSelected ? 'ring-2 ring-sky-400' : ''}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: element.shapeTool === 'oval' ? '50%' : 0,
            backgroundColor: element.filled ? rgba : 'transparent',
            border: element.filled ? undefined : `${Math.max(1, 0.15 * pxPerFt)}px solid ${rgba}`,
            boxSizing: 'border-box',
          }}
        />
      )}
      {isSelected && canModify && (
        <>
          {['NW', 'NE', 'SW', 'SE'].map((corner) => (
            <div
              key={corner}
              style={mapObjectCornerWrapStyle(corner)}
              onPointerDown={(e) => onPointerDownCorner(e, corner)}
              onPointerMove={onPointerMoveCorner}
              onPointerUp={onPointerUpCorner}
            >
              <div style={MAP_OBJECT_CORNER_GRIP_STYLE} />
            </div>
          ))}
          <div
            style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
            className="flex items-center gap-1"
          >
            <MapObjectLayerControl
              viewId={element.viewId ?? null}
              layerOptions={layerOptions}
              onChangeViewId={(viewId) => onUpdateMapImageObject?.(element.instanceId, { viewId })}
            />
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemoveMapImageObject?.(element.instanceId); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-dh-raised border border-dh-strong text-red-400 hover:text-red-300 hover:bg-red-950/40 text-xs shadow-md transition-colors"
              title="Remove shape from map"
            >
              <Trash2 size={11} />
              Remove
            </button>
          </div>
        </>
      )}
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
  /** Uploads file then adds a `mapImage` element (GM: postTableOp; player: postMapImageObject). */
  onAddMapImageObject,
  /** GM only: adds a `drawShape` (rect/oval/brush) vector element — no file upload. */
  onAddMapDrawShape,
  /** Updates an existing `mapImage`/`drawShape` element (instanceId, updates) — shared by both types. */
  onUpdateMapImageObject,
  /** Removes a `mapImage`/`drawShape` element (instanceId) — shared by both types. */
  onRemoveMapImageObject,
  /** Opens a lightbox with the given image URL (threaded from GMTableView). */
  onOpenImageLightbox,
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
  /** GM: lock active camera against accidental pan/zoom */
  onSetViewLocked,
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
   * Called with `{ xFt, yFt, mapId, viewId, viewportFt }` whenever the viewport in map-feet
   * changes (pan/zoom/resize). `viewportFt` is the visible camera rect (top-left + size).
   * Lets callers store the latest center for paste/drop placement, and GM Moves for
   * in-camera vs off-camera adversary grouping.
   */
  onViewportCenterChange,
  /**
   * When set, clicking a placed character token opens this panel instead of the compact `TokenDetailPanel`.
   * Uses `GameTableCharacterListCard` (same as the Characters sidebar); sheet open is wired via `sheetTriggerProps` on that card.
   */
  renderPinnedCharacterPanel,
  /** GM adversary pin — Encounter sidebar card + attack/feature actions (built in GMTableView). */
  renderAdversaryEncounterCard,
  /** Adversary pin — party target aid + offense (built in GMTableView). */
  renderAdversaryTargetAid,
  /** GM-only. Called with `instanceId` when the GM deletes an adversary from the table via the map token panel. */
  onRemoveAdversaryFromTable,
  /** Called when a roll is initiated from the companion token panel (attack button). Same signature as CharacterHoverCard's onRoll. */
  onRoll,
  /** Shared per-table conditions suggestion history (`table_state.conditionsHistory`). */
  conditionsHistory = [],
  extraConditionSuggestions,
  onAddConditionsHistoryEntry,
  onRemoveConditionsHistoryEntry,
  /** Live table: hide reserved adversaries. `null` (scene editor) shows every instance. */
  adversaryPartyScaleCount = null,
  /** Game Table: show GM token + per-character spotlight beams in the trays. */
  showSpotlight = false,
  spotlight = null,
  onSpotlightChange,
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
  const handlersRef = useRef({
    handlePointerDown: null,
    handlePointerMove: null,
    handlePointerUp: null,
    handleTrayProxyHoverEnter: null,
    handleTrayProxyHoverLeave: null,
    handleToggleAdversaryVisibility: null,
    handleRevealAdversary: null,
  });
  const stableOnPointerDown = useCallback((e, element, fromTray) => {
    handlersRef.current.handlePointerDown?.(e, element, fromTray);
  }, []);
  const stableOnPointerMove = useCallback((e) => {
    handlersRef.current.handlePointerMove?.(e);
  }, []);
  const stableOnPointerUp = useCallback((e) => {
    handlersRef.current.handlePointerUp?.(e);
  }, []);
  const stableOnProxyHoverEnter = useCallback((element) => {
    handlersRef.current.handleTrayProxyHoverEnter?.(element);
  }, []);
  const stableOnProxyHoverLeave = useCallback((element) => {
    handlersRef.current.handleTrayProxyHoverLeave?.(element);
  }, []);
  const stableOnToggleAdversaryVisibility = useCallback((element) => {
    handlersRef.current.handleToggleAdversaryVisibility?.(element);
  }, []);
  const stableOnRevealAdversary = useCallback((element) => {
    handlersRef.current.handleRevealAdversary?.(element);
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
  const [bullseyeFt, setBullseyeFt] = useState(null); // { x, y, altitude?, excludeInstanceId? } in feet, null when off-map
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
  // The ring+crosshair overlay is hidden while freely hovering over empty map space until the
  // cursor has been at rest for BULLSEYE_IDLE_DELAY_MS. It shows immediately when snapped to a
  // token (bullseyeFt.excludeInstanceId set) so this state only matters for the free-hover case.
  const BULLSEYE_IDLE_DELAY_MS = 1500;
  const [bullseyeIdleVisible, setBullseyeIdleVisible] = useState(false);
  const bullseyeIdleTimerRef = useRef(null);
  const clearBullseyeIdleTimer = useCallback(() => {
    if (bullseyeIdleTimerRef.current != null) {
      clearTimeout(bullseyeIdleTimerRef.current);
      bullseyeIdleTimerRef.current = null;
    }
  }, []);
  const armBullseyeIdleTimer = useCallback(() => {
    if (bullseyeIdleTimerRef.current != null) clearTimeout(bullseyeIdleTimerRef.current);
    bullseyeIdleTimerRef.current = setTimeout(() => {
      bullseyeIdleTimerRef.current = null;
      setBullseyeIdleVisible(true);
    }, BULLSEYE_IDLE_DELAY_MS);
  }, []);
  useEffect(() => () => clearBullseyeIdleTimer(), [clearBullseyeIdleTimer]);
  const { openImport, enabled: unifiedImportEnabled, openMapImageQuickPick, canMapImagePaste } = useUnifiedImport();
  // Frozen bullseye position during drag (feet coords of dragged token's origin)
  const frozenBullseyeRef = useRef(null);
  /** Last token the bullseye snapped to — used to keep hover when the pointer moves onto the altitude control. */
  const lastHoveredTokenIdRef = useRef(null);
  // Second bullseye that follows the dragged token during drag (only when frozen bullseye is set)
  const [followBullseyeFt, setFollowBullseyeFt] = useState(null);
  /** AI map editor: show selected generation on the table map before Save (data URL or hosted URL). */
  const [mapAiGenPreviewUrl, setMapAiGenPreviewUrl] = useState(null);
  /** Shared with MapConfigToolbar "Generate with AI" and Theatre of the Mind overlay. */
  const [aiMapOpen, setAiMapOpen] = useState(false);
  /** GM: pencil on a map strip tile → name / artist / artist URL dialog. */
  const [mapDetailsEdit, setMapDetailsEdit] = useState(null);
  const mapAiGenPreviewUrlRef = useRef(null);
  mapAiGenPreviewUrlRef.current = mapAiGenPreviewUrl;
  const gmCameraLockedRef = useRef(false);
  /** Zoom to + Maps & Cameras column pair. */
  const mapStripZoomCamerasRef = useRef(null);

  // Track scroll area size for pxPerFt and display zoom bounds
  useLayoutEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    const apply = () => {
      // Prefer clientWidth/Height (same as persist encode) — contentRect can disagree and
      // caused hydrate→persist visibleNorm drift on reload.
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
    };
    apply();
    const ro = new ResizeObserver(() => {
      apply();
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

  const activeMapRow = useMemo(
    () => maps.find((m) => m.id === activeMapIdResolved) ?? maps[0] ?? null,
    [maps, activeMapIdResolved],
  );

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

  /** Opens the quick-pick menu with the current viewport center pre-filled for initial placement.
   *  Placed here so all deps (viewZoom, viewPanLeft, viewPanTop, pxPerFt, activeMapIdResolved) are initialized. */
  const openMapImageQuickPickWithCenter = useCallback((file) => {
    const centerXFt = containerWidth > 0 && pxPerFt > 0 && viewZoom > 0
      ? (containerWidth / 2 + viewPanLeft) / (viewZoom * pxPerFt)
      : null;
    const centerYFt = containerHeight > 0 && pxPerFt > 0 && viewZoom > 0
      ? (containerHeight / 2 + viewPanTop) / (viewZoom * pxPerFt)
      : null;
    openMapImageQuickPick(file, {
      mapId: activeMapIdResolved,
      centerXFt,
      centerYFt,
      // Lands the image on the GM's current camera-view layer (matches the draw-tool layer rule).
      viewId: !isPlayer && gmActiveViewId ? gmActiveViewId : null,
    });
  }, [openMapImageQuickPick, containerWidth, containerHeight, viewPanLeft, viewPanTop, viewZoom, pxPerFt, activeMapIdResolved, isPlayer, gmActiveViewId]);

  // Emit current viewport center to parent whenever pan/zoom/container changes so the parent can
  // cache it for paste/drop image placement (which goes through the global listener and doesn't
  // have direct access to BattleMap's internal pan/zoom state).
  useEffect(() => {
    if (!onViewportCenterChange || !containerWidth || !containerHeight || !pxPerFt || !viewZoom) return;
    const viewportFt = computeCameraViewportFt({
      viewPanLeft,
      viewPanTop,
      viewZoom,
      pxPerFt,
      containerWidth,
      containerHeight,
      mapId: activeMapIdResolved,
    });
    onViewportCenterChange({
      xFt: (containerWidth / 2 + viewPanLeft) / (viewZoom * pxPerFt),
      yFt: (containerHeight / 2 + viewPanTop) / (viewZoom * pxPerFt),
      mapId: activeMapIdResolved,
      viewId: !isPlayer && gmActiveViewId ? gmActiveViewId : null,
      viewportFt,
    });
  }, [onViewportCenterChange, containerWidth, containerHeight, viewPanLeft, viewPanTop, viewZoom, pxPerFt, activeMapIdResolved, isPlayer, gmActiveViewId]);

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
  /** Viewport size used for the last successful GM hydrate — persist skips while layout still disagrees. */
  const lastHydratedViewportRef = useRef(null);
  const mapViewPersistTimerRef = useRef(null);
  /** Latest `onMapViewSync` — debounced persist must not call a stale closure (wrong camera `viewId`). */
  const onMapViewSyncRef = useRef(onMapViewSync);
  onMapViewSyncRef.current = onMapViewSync;
  const playerFreeMapPersistTimerRef = useRef(null);
  const playerFreeMapHydratedKeyRef = useRef('');
  const playerRemoteViewStateCacheRef = useRef(new Map());
  const playerRemoteViewSwitchPendingRef = useRef(false);
  const playerRemoteViewKeyRef = useRef('');
  const [drawTool, setDrawTool] = useState('hand');
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
  /** Brush points (feet, relative to draw canvas) collected while dragging with `drawTool === 'brush'`,
   *  used to build a vector `drawShape` element on pointer-up instead of committing raster pixels. */
  const brushStrokeFtRef = useRef(null);
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

  const activeGmMapView = !isPlayer ? mapViews.find(v => v.id === gmActiveViewId) ?? null : null;
  const gmCameraLocked = !!activeGmMapView?.locked;
  gmCameraLockedRef.current = gmCameraLocked;


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
          const hyd = lastHydratedViewportRef.current;
          // Skip persist while hydrate viewport disagrees with live client size (layout still settling).
          if (
            hyd &&
            (Math.abs((hyd.viewportW ?? 0) - vw) > 1 || Math.abs((hyd.viewportH ?? 0) - vh) > 1)
          ) {
            return;
          }
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

  // Viewport size changes after first paint (toolbars/banners) must re-hydrate from portable
  // mapViewVisibleNorm before any persist — otherwise encode uses a smaller vw/vh than decode
  // and each reload zooms in (and drifts up).
  useLayoutEffect(() => {
    gmViewHydratedRef.current = false;
  }, [containerWidth, containerHeight]);

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
    const wrap = scrollWrapperRef.current;
    const viewportW = wrap?.clientWidth > 0 ? wrap.clientWidth : containerWidth;
    const viewportH = wrap?.clientHeight > 0 ? wrap.clientHeight : containerHeight;
    if (viewportW <= 0 || viewportH <= 0) return;
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
      viewportW,
      viewportH,
    });
    if (!d) {
      gmViewHydratedRef.current = true;
      setMapLetterboxClipPx(null);
      return;
    }
    gmViewHydratedRef.current = true;
    lastHydratedViewportRef.current = { viewportW, viewportH };
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

  const showMapCornerZoomControls =
    canControlMapView &&
    !(
      (!isPlayer && maps.length > 0 && onSetActiveView && onMapFreeExplore) ||
      (isPlayer && tableId && showPlayerMapViewStrip)
    );
  const showMapArtistCredit = !!activeMapRow?.artist?.trim();

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

  const parentByInstanceId = useMemo(() => {
    const m = new Map();
    for (const el of activeElements) {
      if (el.instanceId) m.set(el.instanceId, el);
    }
    return m;
  }, [activeElements]);

  const centerMapOnPlacedActor = useCallback(
    (element) => {
      if (!canControlMapView) return;
      if (gmCameraLockedRef.current) return;
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
      const footprint = getTokenFootprintFt(resolveTokenSizeSource(element, parentByInstanceId));
      const innerCx = (element.tokenX + footprint.halfWidth) * pxPerFt;
      const innerCy = (element.tokenY + footprint.halfLength) * pxPerFt;
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
    [canControlMapView, onMapViewSync, pxPerFt, schedulePersistView, schedulePersistPlayerViewport, isPlayer, activeMapIdResolved, parentByInstanceId],
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

  const applyZoomToFit = useCallback((kind) => {
    if (!canControlMapView) return;
    if (mapAiGenPreviewUrlRef.current) return;
    const types = ZOOM_FIT_KIND_TYPES[kind];
    if (!types) return;
    const wrap = scrollContainerRef.current;
    if (!wrap) return;
    const vw = wrap.clientWidth;
    const vh = wrap.clientHeight;
    if (vw <= 0 || vh <= 0) return;
    const bounds = collectPlacedTokenInnerBounds(activeElements, {
      pxPerFt,
      tokenSizePx,
      types,
      activeMapId: activeMapIdResolved,
      tokenMapId: (el) => effectiveTokenMapId(el.mapId),
    });
    if (!bounds) return;
    const result = computeZoomAndPanToFitInnerBounds({
      ...bounds,
      fillFraction: ZOOM_FIT_FILL_FRACTION,
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
      if (gmCameraLockedRef.current) return;
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
  const adversaries = useMemo(() => activeElements.filter((el) => {
    if (el.elementType !== 'adversary') return false;
    if (isPlayer && !isAdversaryVisibleToPlayers(el)) return false;
    if (adversaryPartyScaleCount == null) return true;
    return isAdversaryPresentForParty(el, adversaryPartyScaleCount);
  }), [activeElements, adversaryPartyScaleCount, isPlayer]);
  const boardTokens = useMemo(
    () => activeElements.filter((el) => el.elementType === 'boardToken'),
    [activeElements],
  );

  // Rotating ally colors: assign one blue/green-family palette entry per character + companion,
  // in activeElements order (stable while elements are only appended). Palette entries are
  // module-level constants, so `.get()` results keep referential identity across recomputes and
  // the PlacedToken/TrayToken memo comparators stay effective.
  const allyColorsByInstanceId = useMemo(() => {
    const map = new Map();
    let i = 0;
    for (const el of activeElements) {
      if (el.elementType === 'character' || el.elementType === 'boardToken') {
        map.set(el.instanceId, ALLY_TOKEN_PALETTE[i % ALLY_TOKEN_PALETTE.length]);
        i += 1;
      }
    }
    return map;
  }, [activeElements]);
  /** Layer filter shared by `mapImage` and `drawShape`: Map-layer objects (`viewId == null`) always
   *  show; a view-scoped object only shows while that specific view is the active layer. */
  const onMapObjectLayer = useCallback(
    (el) => el.viewId == null || el.viewId === activeViewIdResolved,
    [activeViewIdResolved],
  );
  const mapImages = useMemo(
    () =>
      activeElements.filter(
        (el) =>
          el.elementType === 'mapImage' &&
          effectiveTokenMapId(el.mapId) === activeMapIdResolved &&
          onMapObjectLayer(el),
      ),
    [activeElements, activeMapIdResolved, onMapObjectLayer],
  );
  const mapDrawShapes = useMemo(
    () =>
      activeElements.filter(
        (el) =>
          el.elementType === 'drawShape' &&
          effectiveTokenMapId(el.mapId) === activeMapIdResolved &&
          onMapObjectLayer(el),
      ),
    [activeElements, activeMapIdResolved, onMapObjectLayer],
  );
  /** Layer control options for the current map — passed to both object types' Layer pill. */
  const mapViewsForCurrentMap = useMemo(
    () => mapViews.filter((v) => v.mapId === activeMapIdResolved),
    [mapViews, activeMapIdResolved],
  );
  const [selectedMapObjectId, setSelectedMapObjectId] = useState(null);
  /** Creator-or-GM permission rule shared by `mapImage` and `drawShape` (see map-object-transform.js). */
  const canModifyMapObjectFn = useCallback(
    (el) => canModifyMapObject(el, { isPlayer, userUid: user?.uid }),
    [isPlayer, user?.uid],
  );

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

  // Tray: all board tokens (e.g. Beastbound companions) — unplaced first, then dim proxies for
  // those on the active map, then dim proxies for those on other maps (mirrors charTrayTokens /
  // buildCharacterTrayTokenEntries, so a placed companion shows grayed-out in the tray exactly
  // like a placed character does instead of disappearing from it entirely).
  const boardTrayTokens = useMemo(
    () =>
      buildBoardTrayTokenEntries(
        boardTokens,
        activeMapIdResolved,
        (el) => isMyCharacter(parentByInstanceId.get(el.parentInstanceId) || {}),
      ).map((entry) => ({
        ...entry,
        element: withResolvedCompanionStress(
          withResolvedTokenImage(entry.element, parentByInstanceId),
          parentByInstanceId,
        ),
      })),
    [boardTokens, parentByInstanceId, isMyCharacter, activeMapIdResolved],
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
          element: withResolvedCompanionStress(
            withResolvedTokenImage(el, parentByInstanceId),
            parentByInstanceId,
          ),
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

  /**
   * "Place on map" (tray → map): drops a token at a random open spot within the GM/player's
   * current camera view on the active map, avoiding overlap with already-placed tokens when
   * an open spot is available (see `pickRandomPlaceOnMapSpot`).
   */
  const handlePlaceOnMap = useCallback(
    (element) => {
      const footprint = getTokenFootprintFt(resolveTokenSizeSource(element, parentByInstanceId));
      const viewportFt =
        pxPerFt > 0 && viewZoom > 0
          ? {
              x: viewPanLeft / (viewZoom * pxPerFt),
              y: viewPanTop / (viewZoom * pxPerFt),
              width: containerWidth > 0 ? containerWidth / (viewZoom * pxPerFt) : mapWidthFt,
              height: containerHeight > 0 ? containerHeight / (viewZoom * pxPerFt) : mapHeightFt,
            }
          : { x: 0, y: 0, width: mapWidthFt, height: mapHeightFt };
      const otherTokens = allMapTokens
        .filter(({ element: e }) => e.instanceId !== element.instanceId)
        .map(({ element: e }) => ({
          x: e.tokenX,
          y: e.tokenY,
          footprint: getTokenFootprintFt(resolveTokenSizeSource(e, parentByInstanceId)),
        }));
      const { x, y } = pickRandomPlaceOnMapSpot({
        mapWidthFt,
        mapHeightFt,
        viewportFt,
        footprint,
        otherTokens,
      });
      updateActiveElement(element.instanceId, { tokenX: x, tokenY: y, mapId: activeMapIdResolved });
    },
    [
      parentByInstanceId,
      pxPerFt,
      viewZoom,
      viewPanLeft,
      viewPanTop,
      containerWidth,
      containerHeight,
      mapWidthFt,
      mapHeightFt,
      allMapTokens,
      updateActiveElement,
      activeMapIdResolved,
    ],
  );

  /**
   * Bulk "place all on map" (tray header button) — places every provided (currently
   * unplaced) element at a random open spot on the current camera view, avoiding overlap
   * with already-placed tokens AND with elements placed earlier in this same batch (so a
   * "place all" doesn't stack several tokens on top of each other).
   */
  const handlePlaceAllOnMap = useCallback(
    (elements) => {
      if (!elements?.length) return;
      const viewportFt =
        pxPerFt > 0 && viewZoom > 0
          ? {
              x: viewPanLeft / (viewZoom * pxPerFt),
              y: viewPanTop / (viewZoom * pxPerFt),
              width: containerWidth > 0 ? containerWidth / (viewZoom * pxPerFt) : mapWidthFt,
              height: containerHeight > 0 ? containerHeight / (viewZoom * pxPerFt) : mapHeightFt,
            }
          : { x: 0, y: 0, width: mapWidthFt, height: mapHeightFt };
      const otherTokens = allMapTokens.map(({ element: e }) => ({
        x: e.tokenX,
        y: e.tokenY,
        footprint: getTokenFootprintFt(resolveTokenSizeSource(e, parentByInstanceId)),
      }));
      const items = elements.map((element) => ({
        footprint: getTokenFootprintFt(resolveTokenSizeSource(element, parentByInstanceId)),
      }));
      const spots = pickRandomPlaceOnMapSpots({ mapWidthFt, mapHeightFt, viewportFt, items, otherTokens });
      elements.forEach((element, i) => {
        updateActiveElement(element.instanceId, { tokenX: spots[i].x, tokenY: spots[i].y, mapId: activeMapIdResolved });
      });
    },
    [
      pxPerFt,
      viewZoom,
      viewPanLeft,
      viewPanTop,
      containerWidth,
      containerHeight,
      mapWidthFt,
      mapHeightFt,
      allMapTokens,
      parentByInstanceId,
      updateActiveElement,
      activeMapIdResolved,
    ],
  );

  /** Bulk "return all to tray" (tray header button) — clears position/map for every provided element. */
  const handleReturnAllToTray = useCallback(
    (elements) => {
      if (!elements?.length) return;
      for (const element of elements) {
        updateActiveElement(element.instanceId, TRAY_UNPLACE_UPDATES);
      }
    },
    [updateActiveElement],
  );

  const handleToggleAdversaryVisibility = useCallback((element) => {
    if (isPlayer || element?.elementType !== 'adversary') return;
    updateActiveElement(element.instanceId, {
      visibleToPlayers: !isAdversaryVisibleToPlayers(element),
    });
  }, [isPlayer, updateActiveElement]);

  const handleRevealAdversary = useCallback((element) => {
    if (isPlayer || element?.elementType !== 'adversary') return;
    if (isAdversaryVisibleToPlayers(element)) return;
    updateActiveElement(element.instanceId, { visibleToPlayers: true });
  }, [isPlayer, updateActiveElement]);

  const handleRevealAllAdversaries = useCallback(() => {
    if (isPlayer) return;
    for (const el of adversaries) {
      if (!isAdversaryVisibleToPlayers(el)) {
        updateActiveElement(el.instanceId, { visibleToPlayers: true });
      }
    }
  }, [isPlayer, adversaries, updateActiveElement]);

  const handleHideAllAdversaries = useCallback(() => {
    if (isPlayer) return;
    for (const el of adversaries) {
      if (isAdversaryVisibleToPlayers(el)) {
        updateActiveElement(el.instanceId, { visibleToPlayers: false });
      }
    }
  }, [isPlayer, adversaries, updateActiveElement]);

  const canRevealAllAdversaries = canRevealAnyAdversaries(adversaries);
  const canHideAllAdversaries = canHideAnyAdversaries(adversaries);

  // Left tray (characters + companion board tokens) bulk-action eligibility — mirrors the
  // per-token `canMoveToken` permission check used by the pinned detail panel (players may
  // only bulk-move their own characters/companions).
  const leftTrayMovableElements = useMemo(
    () => [...characters, ...boardTokens].filter((el) => canDrag(el)),
    [characters, boardTokens, canDrag],
  );
  const leftTrayUnplacedElements = useMemo(
    () => leftTrayMovableElements.filter((el) => el.tokenX == null),
    [leftTrayMovableElements],
  );
  const leftTrayPlacedOnActiveMapElements = useMemo(
    () =>
      leftTrayMovableElements.filter(
        (el) => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved,
      ),
    [leftTrayMovableElements, activeMapIdResolved],
  );

  // Right tray (adversaries) is GM-only, so every adversary is bulk-movable.
  const rightTrayUnplacedElements = useMemo(
    () => adversaries.filter((el) => el.tokenX == null),
    [adversaries],
  );
  const rightTrayPlacedOnActiveMapElements = useMemo(
    () => adversaries.filter((el) => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved),
    [adversaries, activeMapIdResolved],
  );

  const hasPlacedByKind = useMemo(() => {
    const opts = {
      pxPerFt: 1,
      tokenSizePx: 1,
      activeMapId: activeMapIdResolved,
      tokenMapId: (el) => effectiveTokenMapId(el.mapId),
    };
    return {
      actors: collectPlacedTokenInnerBounds(activeElements, { ...opts, types: ZOOM_FIT_KIND_TYPES.actors }) != null,
      party: collectPlacedTokenInnerBounds(activeElements, { ...opts, types: ZOOM_FIT_KIND_TYPES.party }) != null,
      adversaries: collectPlacedTokenInnerBounds(activeElements, { ...opts, types: ZOOM_FIT_KIND_TYPES.adversaries }) != null,
    };
  }, [activeElements, activeMapIdResolved]);

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
        setDrawTool('hand');
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
        const { w: bw, h: bh } = drawSizeRef.current;
        const startFt = drawPixelToFt(p.x, p.y, mapWidthFt, mapHeightFt, { w: bw, h: bh });
        brushStrokeFtRef.current = { pointsFt: [startFt], radiusFt: drawBrushRadiusClampedFt };
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
      const { w: rw, h: rh } = drawSizeRef.current;
      const rad = Math.max(1, (drawBrushRadiusClampedFt / mapWidthFt) * rw);
      if (last) {
        strokeDrawSegment(ctx, last.x, last.y, p.x, p.y, rad, drawTool, brushRgba);
      }
      drawLastPxRef.current = { x: p.x, y: p.y };
      if (drawTool === 'brush' && brushStrokeFtRef.current) {
        brushStrokeFtRef.current.pointsFt.push(drawPixelToFt(p.x, p.y, mapWidthFt, mapHeightFt, { w: rw, h: rh }));
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
          // Discard the dashed live-preview pixels — the stroke now lives as a separate `drawShape` element.
          ctx.putImageData(shape.snapshot, 0, 0);
        } catch {
          return;
        }
        const x0 = Math.min(shape.startX, cur.x);
        const x1 = Math.max(shape.startX, cur.x);
        const y0 = Math.min(shape.startY, cur.y);
        const y1 = Math.max(shape.startY, cur.y);
        if (x1 - x0 >= 1 && y1 - y0 >= 1 && onAddMapDrawShape) {
          const f0 = drawPixelToFt(x0, y0, mapWidthFt, mapHeightFt, { w, h });
          const f1 = drawPixelToFt(x1, y1, mapWidthFt, mapHeightFt, { w, h });
          const cxFt = (f0.x + f1.x) / 2;
          const cyFt = (f0.y + f1.y) / 2;
          onAddMapDrawShape({
            instanceId: crypto.randomUUID(),
            elementType: 'drawShape',
            mapId: activeMapIdResolved,
            viewId: drawEditContext?.kind === 'view' ? drawEditContext.id : null,
            createdByUid: user?.uid,
            tokenX: cxFt,
            tokenY: cyFt,
            widthFt: Math.max(Math.abs(f1.x - f0.x), 0.5),
            heightFt: Math.max(Math.abs(f1.y - f0.y), 0.5),
            shapeTool: shape.tool,
            rgba: brushRgba,
            filled: shape.filled,
          });
        }
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
      if (drawTool === 'brush') {
        // Build a vector `drawShape` from the collected stroke points, then discard the raster
        // preview by reloading the persisted background (the stroke is no longer flattened pixels).
        const stroke = brushStrokeFtRef.current;
        brushStrokeFtRef.current = null;
        if (stroke?.pointsFt?.length && onAddMapDrawShape) {
          const xs = stroke.pointsFt.map((p) => p.x);
          const ys = stroke.pointsFt.map((p) => p.y);
          const r = stroke.radiusFt;
          const minX = Math.min(...xs) - r;
          const maxX = Math.max(...xs) + r;
          const minY = Math.min(...ys) - r;
          const maxY = Math.max(...ys) + r;
          const cxFt = (minX + maxX) / 2;
          const cyFt = (minY + maxY) / 2;
          onAddMapDrawShape({
            instanceId: crypto.randomUUID(),
            elementType: 'drawShape',
            mapId: activeMapIdResolved,
            viewId: drawEditContext?.kind === 'view' ? drawEditContext.id : null,
            createdByUid: user?.uid,
            tokenX: cxFt,
            tokenY: cyFt,
            widthFt: Math.max(maxX - minX, r * 2, 1),
            heightFt: Math.max(maxY - minY, r * 2, 1),
            shapeTool: 'brush',
            rgba: brushRgba,
            pointsFt: stroke.pointsFt.map((p) => ({ x: p.x - cxFt, y: p.y - cyFt })),
            radiusFt: r,
          });
        }
        if (c) {
          void loadDrawDataUrlOntoCanvas(editableDrawSourceUrl, c, drawSizeRef.current);
        }
      } else if (c) {
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
      mapHeightFt,
      isPlayer,
      flushScribbleTailToPeers,
      onAddMapDrawShape,
      activeMapIdResolved,
      drawEditContext,
      editableDrawSourceUrl,
      loadDrawDataUrlOntoCanvas,
      user?.uid,
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
      drawBrushActiveRef.current = false;
      drawLastPxRef.current = null;
      if (drawTool === 'brush') {
        const stroke = brushStrokeFtRef.current;
        brushStrokeFtRef.current = null;
        if (stroke?.pointsFt?.length && onAddMapDrawShape) {
          const xs = stroke.pointsFt.map((p) => p.x);
          const ys = stroke.pointsFt.map((p) => p.y);
          const r = stroke.radiusFt;
          const minX = Math.min(...xs) - r;
          const maxX = Math.max(...xs) + r;
          const minY = Math.min(...ys) - r;
          const maxY = Math.max(...ys) + r;
          const cxFt = (minX + maxX) / 2;
          const cyFt = (minY + maxY) / 2;
          onAddMapDrawShape({
            instanceId: crypto.randomUUID(),
            elementType: 'drawShape',
            mapId: activeMapIdResolved,
            viewId: drawEditContext?.kind === 'view' ? drawEditContext.id : null,
            createdByUid: user?.uid,
            tokenX: cxFt,
            tokenY: cyFt,
            widthFt: Math.max(maxX - minX, r * 2, 1),
            heightFt: Math.max(maxY - minY, r * 2, 1),
            shapeTool: 'brush',
            rgba: brushRgba,
            pointsFt: stroke.pointsFt.map((p) => ({ x: p.x - cxFt, y: p.y - cyFt })),
            radiusFt: r,
          });
        }
        if (drawPaintRef.current) {
          void loadDrawDataUrlOntoCanvas(editableDrawSourceUrl, drawPaintRef.current, drawSizeRef.current);
        }
      } else if (drawTool === 'eraser' && drawPaintRef.current) {
        const png = drawPaintRef.current.toDataURL('image/png');
        void commitOverlayPng(png);
      }
    }

    setMapDrawCaptureActive(false);
  }, [
    flushScribbleTailToPeers,
    drawTool,
    commitOverlayPng,
    onAddMapDrawShape,
    activeMapIdResolved,
    drawEditContext,
    user?.uid,
    brushRgba,
    editableDrawSourceUrl,
    loadDrawDataUrlOntoCanvas,
  ]);

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
      if (gmCameraLockedRef.current) return;

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
    for (const { element } of allMapTokens) {
      if (element.tokenX == null) continue;
      const footprint = getTokenFootprintFt(resolveTokenSizeSource(element, parentByInstanceId));
      const halfWidthPx = footprint.halfWidth * pxPerFt;
      const halfHeightPx = footprint.halfLength * pxPerFt;
      const cx = element.tokenX * pxPerFt + halfWidthPx;
      const cy = element.tokenY * pxPerFt + halfHeightPx;
      if (Math.abs(mapX - cx) <= halfWidthPx && Math.abs(mapY - cy) <= halfHeightPx) {
        return element;
      }
    }
    return null;
  }, [allMapTokens, pxPerFt, viewZoom, viewPanLeft, viewPanTop, parentByInstanceId]);

  // Handle pointer move over the map canvas area (not trays)
  const handleMapPointerMove = useCallback((e) => {
    if (panRightDragRef.current) return;
    const hitToken = findTokenAtClient(e.clientX, e.clientY);
    setHoveringTokenBlocksDraw(!!hitToken);
    let overToken = hitToken;
    if (!overToken && lastHoveredTokenIdRef.current) {
      const prev = allMapTokens.find(({ element }) => element.instanceId === lastHoveredTokenIdRef.current)?.element;
      if (prev?.tokenX != null) {
        const container = scrollContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const mapX = (e.clientX - rect.left + viewPanLeft) / viewZoom;
          const mapY = (e.clientY - rect.top + viewPanTop) / viewZoom;
          const footprint = getTokenFootprintFt(resolveTokenSizeSource(prev, parentByInstanceId));
          if (isPointInExpandedHoverZone({
            pointX: mapX,
            pointY: mapY,
            tokenLeftPx: prev.tokenX * pxPerFt,
            tokenTopPx: prev.tokenY * pxPerFt,
            tokenWidthPx: footprint.halfWidth * 2 * pxPerFt,
            tokenHeightPx: footprint.halfLength * 2 * pxPerFt,
            expandLeftPx: ALTITUDE_CONTROL_WIDTH_PX + ALTITUDE_CONTROL_GAP_PX,
            stemOffsetPx: altitudeStemOffsetPx(prev.altitude ?? 0, pxPerFt),
          })) {
            overToken = prev;
          }
        }
      }
    }
    lastHoveredTokenIdRef.current = overToken?.instanceId ?? null;
    // During an active drag, the bullseye is frozen at the drag origin — don't update
    if (frozenBullseyeRef.current) {
      scheduleBullseyeFt(frozenBullseyeRef.current);
      return;
    }
    // Snap to token center if hovering over a placed token (reuse the lookup above — same point).
    if (overToken) {
      // Cancel any pending idle timer — snapped tokens show immediately via excludeInstanceId.
      clearBullseyeIdleTimer();
      const footprint = getTokenFootprintFt(resolveTokenSizeSource(overToken, parentByInstanceId));
      scheduleBullseyeFt({
        x: overToken.tokenX + footprint.halfWidth,
        y: overToken.tokenY + footprint.halfLength,
        altitude: overToken.altitude ?? 0,
        excludeInstanceId: overToken.instanceId,
      });
    } else {
      const ft = clientToFt(e.clientX, e.clientY);
      if (ft) {
        scheduleBullseyeFt({ ...ft, altitude: 0 });
        // Reset visibility and restart the 1.5s rest timer on every move over empty space.
        setBullseyeIdleVisible(false);
        armBullseyeIdleTimer();
      }
    }
  }, [findTokenAtClient, clientToFt, scheduleBullseyeFt, parentByInstanceId, clearBullseyeIdleTimer, armBullseyeIdleTimer, allMapTokens, viewPanLeft, viewPanTop, viewZoom, pxPerFt]);

  const handleMapPointerLeave = useCallback(() => {
    setHoveringTokenBlocksDraw(false);
    lastHoveredTokenIdRef.current = null;
    if (!frozenBullseyeRef.current) scheduleBullseyeFt(null);
    clearBullseyeIdleTimer();
    setBullseyeIdleVisible(false);
  }, [scheduleBullseyeFt, clearBullseyeIdleTimer]);

  /** Active-map tray proxies: snap bullseye / range highlights as if hovering the placed token. */
  const handleTrayProxyHoverEnter = useCallback((element) => {
    if (frozenBullseyeRef.current) return;
    const snap = bullseyeFtForPlacedTokenHover(
      element,
      getTokenFootprintFt(resolveTokenSizeSource(element, parentByInstanceId)),
    );
    if (!snap) return;
    clearBullseyeIdleTimer();
    lastHoveredTokenIdRef.current = element.instanceId;
    scheduleBullseyeFt(snap);
  }, [parentByInstanceId, clearBullseyeIdleTimer, scheduleBullseyeFt]);

  const handleTrayProxyHoverLeave = useCallback((element) => {
    if (frozenBullseyeRef.current) return;
    if (lastHoveredTokenIdRef.current !== element?.instanceId) return;
    lastHoveredTokenIdRef.current = null;
    scheduleBullseyeFt(null);
    clearBullseyeIdleTimer();
    setBullseyeIdleVisible(false);
  }, [scheduleBullseyeFt, clearBullseyeIdleTimer]);

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

  // Primary bullseye SVG gate: show immediately when snapped to a token, otherwise only after
  // the free-hover idle delay. Token range-band highlights use the same gate (plus follow-drag).
  const primaryBullseyeVisible = !!(
    bullseyeFt && (bullseyeFt.excludeInstanceId != null || bullseyeIdleVisible)
  );
  const rangeBullseyeVisible = !!(followBullseyeFt || primaryBullseyeVisible);

  // Compute range band index (0–4) for each placed token based on distance to bullseye.
  // During drag from map, use the follow bullseye (moving) so highlights reflect the token being moved.
  const tokenRangeBands = useMemo(() => {
    if (!rangeBullseyeVisible) return {};
    const center = followBullseyeFt ?? bullseyeFt;
    if (!center) return {};
    const result = {};
    for (const { element } of allMapTokens) {
      if (element.tokenX == null) continue;
      if (element.instanceId === center.excludeInstanceId) continue;
      const footprint = getTokenFootprintFt(resolveTokenSizeSource(element, parentByInstanceId));
      const dx = (element.tokenX + footprint.halfWidth) - center.x;
      const dy = (element.tokenY + footprint.halfLength) - center.y;
      const centerDist = Math.sqrt(dx * dx + dy * dy);
      // Point-to-token nearest-edge distance: subtract the token's own directional ellipse
      // radius toward the point (no averaging — the point side has zero radius; shared math with map-range).
      const reach = centerDist < 1e-9
        ? (footprint.halfWidth + footprint.halfLength) / 2
        : ellipseRadiusAtAngle(footprint.halfWidth, footprint.halfLength, Math.atan2(dy, dx));
      const dist = Math.max(0, centerDist - reach);
      const finalDist = combinePlanarDistanceWithAltitude(dist, center.altitude ?? 0, element.altitude ?? 0);
      const bandIdx = getRangeBandIndexForDistanceFt(finalDist);
      result[element.instanceId] = {
        bandIdx, // -1 means Out of Range
        altitudeDeltaFt: (element.altitude ?? 0) - (center.altitude ?? 0),
      };
    }
    return result;
  }, [rangeBullseyeVisible, bullseyeFt, followBullseyeFt, allMapTokens, parentByInstanceId]);

  // Dragged token's range band relative to the static (left-behind) bullseye, for ghost highlight
  const draggedTokenRangeBandFromStatic = useMemo(() => {
    if (!bullseyeFt || !followBullseyeFt) return null;
    const footprint = getTokenFootprintFt(resolveTokenSizeSource(dragRef.current?.element, parentByInstanceId));
    const dx = followBullseyeFt.x - bullseyeFt.x;
    const dy = followBullseyeFt.y - bullseyeFt.y;
    const centerDist = Math.sqrt(dx * dx + dy * dy);
    const reach = centerDist < 1e-9
      ? (footprint.halfWidth + footprint.halfLength) / 2
      : ellipseRadiusAtAngle(footprint.halfWidth, footprint.halfLength, Math.atan2(dy, dx));
    const dist = Math.max(0, centerDist - reach);
    const finalDist = combinePlanarDistanceWithAltitude(dist, bullseyeFt.altitude ?? 0, followBullseyeFt.altitude ?? 0);
    const bandIdx = getRangeBandIndexForDistanceFt(finalDist);
    return bandIdx >= 0 ? RANGE_BANDS[bandIdx] : null;
  }, [bullseyeFt, followBullseyeFt, parentByInstanceId]);

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

    const renderPx = computeTokenRenderPx(tokenSizePx, resolveTokenSizeSource(element, parentByInstanceId));
    const tokenSizeW = renderPx.widthPx;
    const tokenSizeH = renderPx.heightPx;

    // Compute where on the token the user grabbed, so the ghost stays aligned
    // and the drop lands exactly where the ghost was. grabOffsetX/Y are real
    // (post-zoom) screen pixels, so scale the unzoomed base size by viewZoom.
    const { viewZoom: initialViewZoom } = viewStateRef.current;
    let grabOffsetX = (tokenSizeW * initialViewZoom) / 2;
    let grabOffsetY = (tokenSizeH * initialViewZoom) / 2;
    if (!fromTray && element.tokenX != null) {
      const container = scrollContainerRef.current;
      if (container) {
        const { viewZoom: vz, viewPanLeft: vpl, viewPanTop: vpt } = viewStateRef.current;
        const rect = container.getBoundingClientRect();
        const tokenClientX = element.tokenX * pxPerFt * vz - vpl + rect.left;
        const tokenClientY = element.tokenY * pxPerFt * vz - vpt + rect.top;
        // Clamp against the token's real (post-zoom) on-screen size, since grabOffsetX/Y are
        // real screen pixels (tokenSizeW/H is the unzoomed base size).
        grabOffsetX = Math.max(0, Math.min(tokenSizeW * vz, e.clientX - tokenClientX));
        grabOffsetY = Math.max(0, Math.min(tokenSizeH * vz, e.clientY - tokenClientY));
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
      tokenSizeW,
      tokenSizeH,
      grabOffsetX,
      grabOffsetY,
      prevTokenFt:
        element.tokenX != null && element.tokenY != null
          ? { tokenX: element.tokenX, tokenY: element.tokenY, altitude: element.altitude ?? 0 }
          : null,
    };
  }, [canDrag, instanceNumbers, isMyCharacter, isPlayer, tokenSizePx, pxPerFt, parentByInstanceId]);

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
        const footprint = getTokenFootprintFt(resolveTokenSizeSource(el, parentByInstanceId));
        frozenBullseyeRef.current = {
          x: el.tokenX + footprint.halfWidth,
          y: el.tokenY + footprint.halfLength,
          altitude: el.altitude ?? 0,
          excludeInstanceId: el.instanceId,
        };
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
        tokenSizeW: ds.tokenSizeW,
        tokenSizeH: ds.tokenSizeH,
        grabOffsetX: ds.grabOffsetX,
        grabOffsetY: ds.grabOffsetY,
        fromTray: ds.fromTray,
      });
      setHighlightLeftTray(pointInRect(e.clientX, e.clientY, leftTrayRef.current));
      setHighlightRightTray(!isPlayer && pointInRect(e.clientX, e.clientY, rightTrayRef.current));
      // Update follow bullseye at ghost center when we have a frozen origin (drag from map)
      if (frozenBullseyeRef.current) {
        const { viewZoom: vz } = viewStateRef.current;
        const { x: ghostCenterX, y: ghostCenterY } = computeDragGhostCenterClientPx({
          clientX: e.clientX,
          clientY: e.clientY,
          grabOffsetX: ds.grabOffsetX,
          grabOffsetY: ds.grabOffsetY,
          tokenSizeWpx: ds.tokenSizeW,
          tokenSizeHpx: ds.tokenSizeH,
          viewZoom: vz,
        });
        let ft = clientToFt(ghostCenterX, ghostCenterY);
        if (ft) {
          ft = {
            x: Math.max(0, Math.min(mapWidthFt, ft.x)),
            y: Math.max(0, Math.min(mapHeightFt, ft.y)),
            altitude: ds.element.altitude ?? 0,
            excludeInstanceId: ds.element.instanceId,
          };
        }
        setFollowBullseyeFt(ft);
      }
    }
  }, [isPlayer, clientToFt, mapWidthFt, mapHeightFt, parentByInstanceId]);

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
        updateActiveElement(ds.instanceId, TRAY_UNPLACE_UPDATES);
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
        const postMove = activeElements.map((el) =>
          el.instanceId === ds.instanceId ? { ...el, ...TRAY_UNPLACE_UPDATES } : el
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
      // Subtract grab offset so the token's top-left lands where the ghost was, not where the
      // raw cursor was.
      const { x: mapX, y: mapY } = computeDragDropTopLeftLocalPx({
        clientX: e.clientX,
        clientY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        viewPanLeft: vpl,
        viewPanTop: vpt,
        viewZoom: vz,
        grabOffsetX: ds.grabOffsetX ?? ds.tokenSizeW / 2,
        grabOffsetY: ds.grabOffsetY ?? ds.tokenSizeH / 2,
      });
      const ftX = mapX / pxPerFt;
      const ftY = mapY / pxPerFt;

      if (ftX >= 0 && ftX <= mapWidthFt && ftY >= 0 && ftY <= mapHeightFt) {
        const dropFootprint = getTokenFootprintFt(resolveTokenSizeSource(ds.element, parentByInstanceId));
        const clampedX = Math.max(0, Math.min(mapWidthFt - dropFootprint.halfWidth * 2, ftX));
        const clampedY = Math.max(0, Math.min(mapHeightFt - dropFootprint.halfLength * 2, ftY));
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
        updateActiveElement(ds.instanceId, TRAY_UNPLACE_UPDATES);
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
        onTokenDragEnd?.({
          instanceId: ds.instanceId,
          previousTokenFt: ds.prevTokenFt,
          nextTokenFt: null,
          fromTray: false,
        });
      }
    }
  }, [isPlayer, pxPerFt, mapWidthFt, mapHeightFt, updateActiveElement, pinnedToken, activeElements, onTokenDragEnd, canControlMapView, centerMapOnPlacedActor, activeMapIdResolved, navigateShelfToCharacterMap, parentByInstanceId]);

  /** Keep the stable proxy callbacks (declared earlier) pointed at the latest handler closures. */
  handlersRef.current = {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleTrayProxyHoverEnter,
    handleTrayProxyHoverLeave,
    handleToggleAdversaryVisibility,
    handleRevealAdversary,
  };

  const renderTokenAltitudeHud = (element, tokenSizeWpx, tokenSizeHpx, zIndex, { isMyCharacter = false, allyColorClasses = null } = {}) => {
    const bandInfo = tokenRangeBands[element.instanceId];
    const bandIdx = bandInfo?.bandIdx;
    const altitudeDeltaFt = bandInfo?.altitudeDeltaFt ?? 0;
    return (
      <TokenAltitudeControl
        element={element}
        tokenSizeWpx={tokenSizeWpx}
        tokenSizeHpx={tokenSizeHpx}
        pxPerFt={pxPerFt}
        viewZoom={viewZoom}
        zIndex={zIndex}
        altitudeDeltaFt={altitudeDeltaFt}
        showDelta={bandIdx != null && bandIdx >= 0 && altitudeDeltaFt !== 0}
        hoverFocused={bullseyeFt?.excludeInstanceId === element.instanceId}
        positionDragActive={!!dragGhost}
        canAdjust={canDrag(element)}
        isMyCharacter={isMyCharacter}
        allyColorClasses={allyColorClasses}
        onChangeAltitude={(ft) => updateActiveElement(element.instanceId, { altitude: ft })}
      />
    );
  };

  // Dismiss detail panel and selected map image when clicking outside
  const handleMapClick = useCallback((e) => {
    if (e.button !== 0) return;
    // Only dismiss if clicking directly on the map/scroll container (not a token)
    if (e.target === scrollContainerRef.current || e.target === e.currentTarget) {
      setPinnedToken(null);
      setSelectedMapObjectId(null);
    }
  }, []);

  const handleRightPanPointerDown = useCallback(
    (e) => {
      if (!canControlMapView) return;
      if (mapAiGenPreviewUrlRef.current) return;
      if (gmCameraLocked) return;
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
    [canControlMapView, canPanMap, gmCameraLocked],
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

  const spotlightCatchUpKeySet = useMemo(() => {
    if (!showSpotlight) return null;
    return new Set(highestCatchUpKeys(spotlight, characters.map((c) => c.instanceId)));
  }, [showSpotlight, spotlight, characters]);

  const handleAssignCharacterSpotlight = useCallback((instanceId) => {
    if (isPlayer || !onSpotlightChange) return;
    onSpotlightChange(assignSpotlightHolder(spotlight, 'character', instanceId));
  }, [isPlayer, onSpotlightChange, spotlight]);

  const handleAssignGmSpotlight = useCallback(() => {
    if (isPlayer || !onSpotlightChange) return;
    onSpotlightChange(assignSpotlightHolder(spotlight, 'gm'));
  }, [isPlayer, onSpotlightChange, spotlight]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const showLeftTray =
    characters.length > 0 ||
    boardTrayTokens.length > 0 ||
    (!isPlayer && pendingBannerCount > 0);
  const showRightAdversaryTray = !isPlayer && adversaries.length > 0;
  const showRightTray = showRightAdversaryTray || showSpotlight;
  const showDiceTrayControls =
    onClearDice ||
    onToggleDiceVisibility ||
    (typeof onCancelAllBanners === 'function' && pendingBannerCount > 0);

  const hasMapArt = mapConfigHasImage(mapConfig);
  const displayMapImageUrl = mapAiGenPreviewUrl ?? mapConfig?.mapImageUrl ?? null;
  const playerEmptyMapHint =
    isPlayer &&
    getPlayerTotMEmptyMapHint({
      tableStateReady,
      mapConfigHasImage: hasMapArt,
    });

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar — GM only */}
      {!isPlayer && (
        <MapConfigToolbar
          mapConfig={mapConfig}
          onMapConfigChange={handleMapConfigChange}
          isUploading={false}
          onFileSelect={(f) => unifiedImportEnabled && openImport([f])}
          onOpenQuickPick={canMapImagePaste ? () => openMapImageQuickPickWithCenter(null) : undefined}
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
        <div className="flex items-start gap-2 px-3 py-1.5 bg-dh-surface border-b border-dh-border text-xs shrink-0 min-w-0">
          <div ref={mapStripZoomCamerasRef} className="flex shrink-0 items-stretch gap-2 self-start">
          {canControlMapView ? (
            <ZoomToFitControls
              groupLabel="Zoom to"
              iconSize={Math.max(12, trayTokenSizePx - 8)}
              onZoomToFit={applyZoomToFit}
              hasPlacedByKind={hasPlacedByKind}
              extraDisabled={mapAiPreviewActive}
              tooltipPlacement="bottom"
            />
          ) : null}
          <div className="flex w-max shrink-0 flex-col items-stretch self-stretch box-border">
            <MapStripGroupLabel>Maps & Cameras</MapStripGroupLabel>
            {/* w-0 min-w-full: column width comes from the label; buttons fill it without expanding it */}
            <div className="flex w-0 min-w-full min-h-0 flex-1 flex-col items-stretch gap-0.5">
              <MapStripActionButton
                onClick={() => void handleSplitCamera()}
                disabled={!gmCanCreateCameraView}
                ariaLabel="Add Camera"
                className="text-violet-300/90 border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35"
                iconSize={Math.max(12, trayTokenSizePx - 8)}
                Icon={Camera}
                labelLines={['Add', 'Camera']}
                tooltip={
                  gmCanCreateCameraView
                    ? 'Add camera at the current zoom and pan'
                    : 'Cameras'
                }
                tooltipPlacement="bottom"
                grow
                width="fill"
              />
              {onAddMap ? (
                <MapStripActionButton
                  onClick={onAddMap}
                  ariaLabel="Add Map"
                  className="text-violet-300/90 border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35"
                  iconSize={Math.max(12, trayTokenSizePx - 8)}
                  Icon={MapIcon}
                  labelLines={['Add', 'Map']}
                  tooltip="Add map"
                  tooltipPlacement="bottom"
                  grow
                  width="fill"
                />
              ) : null}
            </div>
          </div>
          </div>
          <div
            className="flex flex-1 min-w-0 items-stretch gap-2 overflow-x-auto pb-0.5 -mb-0.5 self-start"
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
                  adversaryPartyScaleCount={adversaryPartyScaleCount}
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
                          <Tooltip label="Edit map">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMapDetailsEdit({
                                  id: map.id,
                                  name: map.name ?? '',
                                  artist: map.artist ?? '',
                                  artistUrl: map.artistUrl ?? '',
                                });
                              }}
                              className="rounded p-0.5 text-dh-muted hover:bg-dh-hover/80 hover:text-dh"
                              aria-label="Edit map"
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
                      adversaryPartyScaleCount={adversaryPartyScaleCount}
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
                      adversaryPartyScaleCount={adversaryPartyScaleCount}
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
                        adversaryPartyScaleCount={adversaryPartyScaleCount}
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
              <ZoomToFitControls
                groupLabel="Zoom to"
                iconSize={Math.max(12, trayTokenSizePx - 8)}
                onZoomToFit={applyZoomToFit}
                hasPlacedByKind={hasPlacedByKind}
                extraDisabled={mapAiPreviewActive}
              />
            ) : null}
          </div>
        )}
      {/* Map area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left tray — character tokens shelf */}
        {showLeftTray && (
          <div
            ref={leftTrayRef}
            className={`relative z-20 flex flex-col shrink-0 border-r border-dh-border overflow-visible ${highlightLeftTray ? 'bg-amber-900/30' : 'bg-dh-surface/60'}`}
            style={{ width: CHARACTER_TRAY_WIDTH_PX, minWidth: CHARACTER_TRAY_WIDTH_PX, maxWidth: CHARACTER_TRAY_WIDTH_PX, minHeight: 0 }}
          >
            {charTrayTokensMerged.length > 0 && (
              <TrayBulkActionsHeader
                trayDirection="left"
                onPlaceAll={() => handlePlaceAllOnMap(leftTrayUnplacedElements)}
                canPlaceAll={leftTrayUnplacedElements.length > 0}
                onReturnAll={() => handleReturnAllToTray(leftTrayPlacedOnActiveMapElements)}
                canReturnAll={leftTrayPlacedOnActiveMapElements.length > 0}
              />
            )}
            <div
              className={`flex-1 min-h-0 overflow-y-auto ${showSpotlight ? 'pointer-events-none' : ''}`}
              style={showSpotlight ? { width: CHARACTER_TRAY_WIDTH_PX + SPOTLIGHT_BEAM_WIDTH_PX } : undefined}
            >
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
                onProxyHoverEnter={stableOnProxyHoverEnter}
                onProxyHoverLeave={stableOnProxyHoverLeave}
                pinnedInstanceId={pinnedToken?.element.instanceId}
                allyColorsByInstanceId={allyColorsByInstanceId}
                showSpotlight={showSpotlight}
                spotlight={spotlight}
                spotlightClickable={!isPlayer && typeof onSpotlightChange === 'function'}
                onAssignCharacterSpotlight={handleAssignCharacterSpotlight}
                highestCatchUpKeySet={spotlightCatchUpKeySet}
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
                      {canMapImagePaste && (
                        <Tooltip label="Place an image on the map">
                          <button
                            type="button"
                            onClick={() => openMapImageQuickPickWithCenter(null)}
                            className="inline-flex items-center justify-center rounded border border-dh-strong bg-dh-raised/70 p-1.5 text-sky-400 hover:text-sky-300 hover:border-sky-800/60"
                            aria-label="Place image on map"
                          >
                            <ImageIcon size={15} aria-hidden />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip label="Hand: click and drag existing tokens, images, or shapes. Does not draw.">
                        <button
                          type="button"
                          onClick={() => setDrawTool('hand')}
                          className={`inline-flex items-center justify-center rounded border p-1.5 ${
                            drawTool === 'hand'
                              ? 'border-lime-500/60 bg-lime-950/35 text-lime-100'
                              : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                          }`}
                          aria-label="Hand: move existing map objects"
                        >
                          <Hand size={15} aria-hidden />
                        </button>
                      </Tooltip>
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
                      disabled={drawTool === 'hand'}
                      className={`inline-flex items-center justify-center rounded border p-1.5 disabled:opacity-40 disabled:pointer-events-none ${
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
                    className={`inline-flex items-center gap-1.5 ${(drawTool === 'eraser' || drawTool === 'hand') && !isPlayer ? 'text-dh-muted/50' : 'text-dh-muted'}`}
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
                      disabled={(drawTool === 'eraser' || drawTool === 'hand') && !isPlayer}
                    />
                    <span className="inline-block min-w-[5ch] text-end tabular-nums text-dh">
                      {Math.round(drawOpacity * 100)}%
                    </span>
                  </label>
                  <label className={`inline-flex items-center gap-1.5 ${drawTool === 'hand' && !isPlayer ? 'text-dh-muted/50' : 'text-dh-muted'}`}>
                    <span className="whitespace-nowrap">Radius</span>
                    <input
                      type="range"
                      min={MAP_DRAW_BRUSH_RADIUS_FT_MIN}
                      max={drawBrushRadiusMaxFt}
                      step={0.5}
                      value={drawBrushRadiusClampedFt}
                      onPointerDown={() => setBrushPreviewControlsActive(true)}
                      onChange={(e) => setDrawBrushRadiusFt(Number(e.target.value))}
                      className="relative top-0.5 h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-dh-hover accent-cyan-500 disabled:opacity-40"
                      disabled={drawTool === 'rect' || drawTool === 'oval' || (drawTool === 'hand' && !isPlayer)}
                      title={`${MAP_DRAW_BRUSH_RADIUS_FT_MIN}′–${Math.round(drawBrushRadiusMaxFt * 10) / 10}′ (max 20% of visible map height)`}
                    />
                    <span className="tabular-nums text-dh">{drawBrushRadiusClampedFt.toFixed(1)}′</span>
                  </label>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {!isPlayer && onSetViewLocked && activeGmMapView ? (
                    <Tooltip
                      label={
                        gmCameraLocked
                          ? 'Camera locked — click to unlock pan/zoom'
                          : 'Lock this camera to prevent accidental pan/zoom'
                      }
                    >
                      <button
                        type="button"
                        onClick={() => onSetViewLocked(activeGmMapView.id, !gmCameraLocked)}
                        aria-pressed={gmCameraLocked}
                        aria-label={gmCameraLocked ? 'Unlock camera' : 'Lock camera'}
                        className={`inline-flex items-center justify-center rounded border p-1.5 ${
                          gmCameraLocked
                            ? 'border-amber-500/60 bg-amber-900/40 text-amber-200 hover:bg-amber-800/50'
                            : 'border-dh-strong bg-dh-raised/70 text-dh-muted hover:text-dh'
                        }`}
                      >
                        {gmCameraLocked ? (
                          <Lock size={15} aria-hidden />
                        ) : (
                          <LockOpen size={15} aria-hidden />
                        )}
                      </button>
                    </Tooltip>
                  ) : null}
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
                  : canControlMapView && !mapAiPreviewActive && !gmCameraLocked && (canPanMap || rightPanDragging)
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
            onContextMenu={canControlMapView && canPanMap && !gmCameraLocked ? (ev) => { ev.preventDefault(); } : undefined}
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

              {/* Range band bullseye overlay (above tokens z-30+ so range rings are legible over them) */}
              {/* Visibility gated by primaryBullseyeVisible (same gate as token range highlights). */}
              {primaryBullseyeVisible && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 55 }}
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
                  style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 56 }}
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

              {/* Placed mapImage + drawShape objects — above the draw/scribble canvases (z<=21), below tokens (z=30+) */}
              {mapImages.map((el) => (
                <MapImageObject
                  key={el.instanceId}
                  element={el}
                  pxPerFt={pxPerFt}
                  mapZoom={mapZoom}
                  isSelected={selectedMapObjectId === el.instanceId}
                  onSelect={() => setSelectedMapObjectId(el.instanceId)}
                  onDeselect={() => setSelectedMapObjectId(null)}
                  canModify={canModifyMapObjectFn(el)}
                  isEraserActive={!isPlayer && drawTool === 'eraser'}
                  layerOptions={mapViewsForCurrentMap}
                  onUpdateMapImageObject={onUpdateMapImageObject}
                  onRemoveMapImageObject={onRemoveMapImageObject}
                  onOpenImageLightbox={onOpenImageLightbox}
                />
              ))}
              {mapDrawShapes.map((el) => (
                <DrawShapeObject
                  key={el.instanceId}
                  element={el}
                  pxPerFt={pxPerFt}
                  mapZoom={mapZoom}
                  isSelected={selectedMapObjectId === el.instanceId}
                  onSelect={() => setSelectedMapObjectId(el.instanceId)}
                  onDeselect={() => setSelectedMapObjectId(null)}
                  canModify={canModifyMapObjectFn(el)}
                  isEraserActive={!isPlayer && drawTool === 'eraser'}
                  layerOptions={mapViewsForCurrentMap}
                  onUpdateMapImageObject={onUpdateMapImageObject}
                  onRemoveMapImageObject={onRemoveMapImageObject}
                />
              ))}

              {/* Placed character tokens — rising z-index so overlaps pick the topmost; padded hit target for edges */}
              {charMapTokens.map(({ element, isMyCharacter: myChar }, stackIdx) => {
                const bandInfo = tokenRangeBands[element.instanceId];
                const bandIdx = bandInfo?.bandIdx;
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                const renderPx = computeTokenRenderPx(tokenSizePx, element);
                const zIndex = element.instanceId === bullseyeFt?.excludeInstanceId ? SNAPPED_TOKEN_Z_INDEX : TOKEN_BASE_Z_INDEX + stackIdx;
                return (
                  <Fragment key={element.instanceId}>
                    <PlacedToken
                      element={element}
                      isMyCharacter={myChar}
                      isPlayer={isPlayer}
                      isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                      isPinned={pinnedToken?.element.instanceId === element.instanceId}
                      rangeBand={rangeBand}
                      zIndex={zIndex}
                      pxPerFt={pxPerFt}
                      tokenSizeWpx={renderPx.widthPx}
                      tokenSizeHpx={renderPx.heightPx}
                      allyColorClasses={allyColorsByInstanceId.get(element.instanceId) ?? null}
                      onPointerDown={stableOnPointerDown}
                      onPointerMove={stableOnPointerMove}
                      onPointerUp={stableOnPointerUp}
                    />
                    {renderTokenAltitudeHud(element, renderPx.widthPx, renderPx.heightPx, zIndex, {
                      isMyCharacter: myChar,
                      allyColorClasses: allyColorsByInstanceId.get(element.instanceId) ?? null,
                    })}
                  </Fragment>
                );
              })}

              {/* Placed companion / board tokens — above characters, below adversaries */}
              {boardMapTokens.map(({ element, isMyCharacter: myChar }, stackIdx) => {
                const bandInfo = tokenRangeBands[element.instanceId];
                const bandIdx = bandInfo?.bandIdx;
                const rangeBand = bandIdx != null && bandIdx >= 0 ? RANGE_BANDS[bandIdx] : null;
                const renderPx = computeTokenRenderPx(tokenSizePx, resolveTokenSizeSource(element, parentByInstanceId));
                const zIndex = element.instanceId === bullseyeFt?.excludeInstanceId ? SNAPPED_TOKEN_Z_INDEX : TOKEN_BASE_Z_INDEX + charMapTokens.length + stackIdx;
                return (
                  <Fragment key={element.instanceId}>
                    <PlacedToken
                      element={element}
                      isMyCharacter={myChar}
                      isPlayer={isPlayer}
                      isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                      isPinned={pinnedToken?.element.instanceId === element.instanceId}
                      rangeBand={rangeBand}
                      zIndex={zIndex}
                      pxPerFt={pxPerFt}
                      tokenSizeWpx={renderPx.widthPx}
                      tokenSizeHpx={renderPx.heightPx}
                      allyColorClasses={allyColorsByInstanceId.get(element.instanceId) ?? null}
                      onPointerDown={stableOnPointerDown}
                      onPointerMove={stableOnPointerMove}
                      onPointerUp={stableOnPointerUp}
                    />
                    {renderTokenAltitudeHud(element, renderPx.widthPx, renderPx.heightPx, zIndex, {
                      isMyCharacter: myChar,
                      allyColorClasses: allyColorsByInstanceId.get(element.instanceId) ?? null,
                    })}
                  </Fragment>
                );
              })}

              {/* Placed adversary tokens — after characters so adversaries stay above; later instances stack higher */}
              {advMapTokens.map(({ element, instanceNum }, advIdx) => {
                const bandInfo = tokenRangeBands[element.instanceId];
                const bandIdx = bandInfo?.bandIdx;
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                const renderPx = computeTokenRenderPx(tokenSizePx, element);
                const zIndex = element.instanceId === bullseyeFt?.excludeInstanceId ? SNAPPED_TOKEN_Z_INDEX : TOKEN_BASE_Z_INDEX + charMapTokens.length + boardMapTokens.length + advIdx;
                return (
                  <Fragment key={element.instanceId}>
                    <PlacedToken
                      element={element}
                      isMyCharacter={false}
                      isPlayer={isPlayer}
                      isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                      isPinned={pinnedToken?.element.instanceId === element.instanceId}
                      instanceNum={instanceNum}
                      rangeBand={rangeBand}
                      zIndex={zIndex}
                      pxPerFt={pxPerFt}
                      tokenSizeWpx={renderPx.widthPx}
                      tokenSizeHpx={renderPx.heightPx}
                      onPointerDown={stableOnPointerDown}
                      onPointerMove={stableOnPointerMove}
                      onPointerUp={stableOnPointerUp}
                      onRevealHidden={!isPlayer && !isAdversaryVisibleToPlayers(element) ? stableOnRevealAdversary : undefined}
                    />
                    {renderTokenAltitudeHud(element, renderPx.widthPx, renderPx.heightPx, zIndex)}
                  </Fragment>
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
          {playerEmptyMapHint ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-4 overflow-y-auto py-8"
              role="status"
            >
              <div className="text-dh-muted text-sm text-center max-w-3xl w-full space-y-2">
                <MapIcon size={32} className="mx-auto mb-1 opacity-50" aria-hidden />
                <p className="leading-snug">No map loaded</p>
              </div>
            </div>
          ) : null}
          {(showMapCornerZoomControls || showMapArtistCredit) && (
            <div className="pointer-events-none absolute right-2 bottom-2 z-20 flex flex-col items-end gap-1.5">
              {showMapCornerZoomControls && isPlayer && onAddMapImageObject && (
                <Tooltip label="Place an image on the map">
                  <button
                    type="button"
                    aria-label="Place image on map"
                    onClick={() => openMapImageQuickPickWithCenter(null)}
                    className="pointer-events-auto shrink-0 p-1.5 rounded border border-dh-strong bg-dh-raised/90 shadow-md hover:bg-dh-hover text-sky-400 hover:text-sky-300"
                  >
                    <ImageIcon size={14} />
                  </button>
                </Tooltip>
              )}
              {showMapCornerZoomControls ? (
                <ZoomToFitControls
                  variant="icon"
                  iconSize={14}
                  onZoomToFit={applyZoomToFit}
                  hasPlacedByKind={hasPlacedByKind}
                  extraDisabled={mapAiPreviewActive}
                />
              ) : null}
              {showMapArtistCredit ? <MapArtistCredit map={activeMapRow} /> : null}
            </div>
          )}
          </div>
        </div>

        {/* Right tray — GM spotlight token (everyone) + adversaries (GM only) */}
        {showRightTray && (
          <div
            ref={rightTrayRef}
            className={`relative z-20 flex flex-col shrink-0 border-l border-dh-border overflow-visible ${highlightRightTray ? 'bg-amber-900/30' : 'bg-dh-surface/60'}`}
            style={{ width: trayTokenSizePx + 16, minWidth: trayTokenSizePx + 16, maxWidth: trayTokenSizePx + 16, minHeight: 0 }}
          >
            {showRightAdversaryTray && advTrayTokens.length > 0 && (
              <TrayBulkActionsHeader
                trayDirection="right"
                onPlaceAll={() => handlePlaceAllOnMap(rightTrayUnplacedElements)}
                canPlaceAll={rightTrayUnplacedElements.length > 0}
                onReturnAll={() => handleReturnAllToTray(rightTrayPlacedOnActiveMapElements)}
                canReturnAll={rightTrayPlacedOnActiveMapElements.length > 0}
              />
            )}
            {showSpotlight && (
              <div className="relative flex items-center justify-center px-1.5 pt-2 pb-1.5 shrink-0">
                <div
                  className="absolute top-1/2 right-full z-30 -translate-y-1/2"
                  style={{ marginRight: -SPOTLIGHT_BEAM_OVERLAP_PX }}
                >
                  <SpotlightBeam
                    side="right"
                    active={isGmHolder(spotlight)}
                    dimGlow={false}
                    count={0}
                    clickable={!isPlayer && typeof onSpotlightChange === 'function'}
                    label={isGmHolder(spotlight) ? 'GM holds the spotlight — click to clear' : 'Give spotlight to the GM'}
                    onClick={handleAssignGmSpotlight}
                  />
                </div>
                <GmSpotlightToken tokenSizePx={trayTokenSizePx} />
              </div>
            )}
            {showRightAdversaryTray && (
              <TrayVisibilityActionsHeader
                onRevealAll={handleRevealAllAdversaries}
                canRevealAll={canRevealAllAdversaries}
                onHideAll={handleHideAllAdversaries}
                canHideAll={canHideAllAdversaries}
              />
            )}
            {showRightAdversaryTray && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <TrayColumn
                  tokens={advTrayTokens}
                  side="right"
                  isHighlighted={highlightRightTray}
                  trayRef={null}
                  tokenSizePx={trayTokenSizePx}
                  dragRef={dragRef}
                  onPointerDown={stableOnPointerDown}
                  onPointerMove={stableOnPointerMove}
                  onPointerUp={stableOnPointerUp}
                  onProxyHoverEnter={stableOnProxyHoverEnter}
                  onProxyHoverLeave={stableOnProxyHoverLeave}
                  pinnedInstanceId={pinnedToken?.element.instanceId}
                  onToggleAdversaryVisibility={stableOnToggleAdversaryVisibility}
                />
              </div>
            )}
          </div>
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
              left: dragGhost.clientX - (dragGhost.grabOffsetX ?? dragGhost.tokenSizeW / 2),
              top: dragGhost.clientY - (dragGhost.grabOffsetY ?? dragGhost.tokenSizeH / 2),
            }}
          >
            <TokenCircle
              element={dragGhost.element}
              sizeW={Math.round((dragGhost.tokenSizeW ?? tokenSizePx) * viewZoom)}
              sizeH={Math.round((dragGhost.tokenSizeH ?? tokenSizePx) * viewZoom)}
              instanceNum={dragGhost.instanceNum}
              isMyCharacter={dragGhost.isMyChar}
              isPlayer={isPlayer}
              isGhost
              rangeBand={draggedTokenRangeBandFromStatic}
              rangeBandGlowScale={3}
              allyColorClasses={allyColorsByInstanceId.get(dragGhost.element.instanceId) ?? null}
            />
          </div>
        )}
      </div>

      {/* Click-to-pin detail panel */}
      {pinnedToken && (() => {
        const elRaw = activeElements.find(e => e.instanceId === pinnedToken.element.instanceId);
        if (!elRaw) return null;
        const el = withResolvedTokenImage(elRaw, parentByInstanceId);
        const myChar =
          el.elementType === 'boardToken'
            ? isMyCharacter(parentByInstanceId.get(el.parentInstanceId) || {})
            : isMyCharacter(el);
        const canMoveToken = !isPlayer || myChar;
        if (el.elementType === 'character' && typeof renderPinnedCharacterPanel === 'function') {
          return renderPinnedCharacterPanel({
            element: el,
            anchorX: pinnedToken.anchorX,
            anchorY: pinnedToken.anchorY,
            onClose: () => setPinnedToken(null),
            updateActiveElement,
            onRemoveFromMap: canMoveToken
              ? () => {
                  updateActiveElement(el.instanceId, TRAY_UNPLACE_UPDATES);
                  setPinnedToken(null);
                }
              : undefined,
            onPlaceOnMap: canMoveToken
              ? () => {
                  handlePlaceOnMap(el);
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
            onRemoveFromMap={canMoveToken ? () => {
              updateActiveElement(el.instanceId, TRAY_UNPLACE_UPDATES);
              setPinnedToken(null);
            } : undefined}
            onPlaceOnMap={canMoveToken ? () => {
              handlePlaceOnMap(el);
              setPinnedToken(null);
            } : undefined}
            onDeleteFromTable={el.elementType === 'adversary' && !isPlayer && onRemoveAdversaryFromTable ? () => {
              if (window.confirm(`Remove ${el.name || 'Unnamed'} from the table?`)) {
                onRemoveAdversaryFromTable(el.instanceId);
                setPinnedToken(null);
              }
            } : undefined}
            onClose={() => setPinnedToken(null)}
            anchorX={pinnedToken.anchorX}
            anchorY={pinnedToken.anchorY}
            tableId={tableId}
            onOpenImageLightbox={onOpenImageLightbox}
            onRoll={onRoll}
            parentCharacterEl={el.elementType === 'boardToken' ? parentByInstanceId.get(el.parentInstanceId) : undefined}
            adversaryEncounterCard={
              el.elementType === 'adversary' && typeof renderAdversaryEncounterCard === 'function'
                ? renderAdversaryEncounterCard(el)
                : null
            }
            adversaryTargetAid={
              el.elementType === 'adversary' && typeof renderAdversaryTargetAid === 'function'
                ? renderAdversaryTargetAid(el)
                : null
            }
            adversaryPinInstanceNum={advPinInstanceNum}
            conditionsHistory={conditionsHistory}
            extraConditionSuggestions={extraConditionSuggestions}
            onAddConditionsHistoryEntry={onAddConditionsHistoryEntry}
            onRemoveConditionsHistoryEntry={onRemoveConditionsHistoryEntry}
          />
        );
      })()}

      {onRenameMap ? (
        <MapDetailsDialog
          open={!!mapDetailsEdit}
          initialName={mapDetailsEdit?.name ?? ''}
          initialArtist={mapDetailsEdit?.artist ?? ''}
          initialArtistUrl={mapDetailsEdit?.artistUrl ?? ''}
          onClose={() => setMapDetailsEdit(null)}
          onSave={({ name, artist, artistUrl }) => {
            if (!mapDetailsEdit?.id) return;
            onRenameMap(mapDetailsEdit.id, name, { artist, artistUrl });
          }}
        />
      ) : null}

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
