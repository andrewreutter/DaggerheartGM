import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import {
  clampMapZoom,
  clampPanScroll,
  computeMapZoomBounds,
  computePanToCenterInnerPointPx,
  computeZoomAndPanToFitInnerBounds,
  normalizeWheelDeltaPixels,
  scrollAfterZoomTowardPoint,
} from '../lib/battle-map-zoom.js';
import { decodeMapViewState, encodeMapViewState } from '../lib/map-view-sync.js';
import {
  shouldApplyRemotePlayerMapView,
  personalCameraTargetsUnsharedMap,
  freeMapExploreTargetsUnsharedMap,
} from '../lib/map-view-player-sync.js';
import { Upload, X, Map as MapIcon, ArrowLeftToLine, Pencil, Eraser, Eye, EyeOff, Trash2, CircleX, Focus, Camera, Radio, Plus } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { HOPE_TRACK_FILL } from './CharacterStatBlockGraphic.jsx';
import { ConditionsTextInput } from './ConditionsTextInput.jsx';
import {
  getAuthToken,
  fetchPersonalCameras,
  postPersonalCamera,
  patchPersonalCamera,
  patchPersonalCameraName,
  deletePersonalCamera,
  postMapPing,
} from '../lib/api.js';
import Fireworks from 'fireworks-js';
import { effectiveTokenMapId, DEFAULT_LEGACY_MAP_ID } from '../lib/map-table-state.js';
import { isAdversaryDefeated } from '../lib/helpers.js';
import {
  findPendingManualTrackBanner,
  mergeManualTrackDisplay,
  getPendingManualTrackAckDeltas,
  getLifeSupportPendingHealSlots,
} from '../lib/manual-track-action-loop.js';
import { getRangeBandIndexForDistanceFt } from '../lib/map-range.js';

const MIN_PX_PER_FT = 33 / 5; // 6.6 px/ft — 5' token ≥ 33px touch target
const DRAG_THRESHOLD_PX = 8;
/** Approx. time for fireworks-js rocket to reach target (no API hook); tuned for default trace speed. */
const MAP_PING_FIREWORK_LAND_MS = 800;
const MAP_PING_LABEL_FADE_MS = 5000;
/** User-editable map span along the chosen edge (W/H); clamped for UI + `getMapDimensions`. */
const MAP_SIZE_FT_MIN = 1;
const MAP_SIZE_FT_MAX = 3000;

function mapConfigHasImage(mc) {
  const u = mc?.mapImageUrl;
  return typeof u === 'string' && u.trim().length > 0;
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

function getMapDimensions(mapConfig) {
  const { mapSizeFt = 100, mapDimension = 'width', mapImageNaturalWidth, mapImageNaturalHeight } = mapConfig ?? {};
  const sizeFt = Math.max(MAP_SIZE_FT_MIN, Math.min(MAP_SIZE_FT_MAX, Number(mapSizeFt) || 100));
  if (mapImageNaturalWidth > 0 && mapImageNaturalHeight > 0) {
    const aspect = mapImageNaturalWidth / mapImageNaturalHeight;
    return mapDimension === 'width'
      ? { mapWidthFt: sizeFt, mapHeightFt: Math.round((sizeFt / aspect) * 10) / 10 }
      : { mapHeightFt: sizeFt, mapWidthFt: Math.round(sizeFt * aspect * 10) / 10 };
  }
  return { mapWidthFt: sizeFt, mapHeightFt: sizeFt };
}

async function uploadMapImageFile(file) {
  const token = await getAuthToken();
  const fd = new FormData();
  fd.append('file', file);
  const resp = await fetch('/api/room/my/map-image', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!resp.ok) throw new Error(await resp.text().catch(() => resp.statusText));
  return (await resp.json()).url;
}

async function processImageFile(file) {
  const [url, [naturalWidth, naturalHeight]] = await Promise.all([
    uploadMapImageFile(file),
    new Promise(resolve => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(src); resolve([img.naturalWidth, img.naturalHeight]); };
      img.onerror = () => { URL.revokeObjectURL(src); resolve([null, null]); };
      img.src = src;
    }),
  ]);
  return { url, naturalWidth, naturalHeight };
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
  return { renderedWidthPx, renderedHeightPx, mapZoom, scrollLeft, scrollTop };
}

function MapViewThumbInterior({ mapRow, viewState }) {
  const hasArt = mapConfigHasImage({ mapImageUrl: mapRow?.mapImageUrl });
  const { renderedWidthPx, renderedHeightPx, mapZoom, scrollLeft, scrollTop } = useMemo(
    () => computeThumbViewRender(mapRow, viewState, THUMB_STRIP_W_PX, THUMB_STRIP_H_PX),
    [mapRow, viewState],
  );

  if (!hasArt) {
    return (
      <div
        className="flex w-full items-center justify-center bg-dh-canvas/40 text-dh-muted"
        style={{ width: THUMB_STRIP_W_PX, height: THUMB_STRIP_H_PX }}
      >
        <MapIcon size={18} strokeWidth={1.5} aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-dh-canvas/40" style={{ width: THUMB_STRIP_W_PX, height: THUMB_STRIP_H_PX }}>
      <div className="absolute left-0 top-0 overflow-hidden" style={{ width: THUMB_STRIP_W_PX, height: THUMB_STRIP_H_PX }}>
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
              className="absolute inset-0 h-full w-full select-none object-fill pointer-events-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Thumbnail tile for the maps + saved views strip (map switch or apply saved zoom/pan). */
function MapViewStripTile({
  mapRow,
  viewState,
  label,
  isActive,
  onClick,
  variant = 'map',
  actions,
  interactive = true,
  showCameraBadge = false,
  /** Hide the caption under the thumb (e.g. player full-map tile — map name only for GM). */
  hideCaption = false,
  /** Optional `title` on the thumb control (defaults to `label`). */
  tooltipTitle,
}) {
  const titleAttr = tooltipTitle !== undefined ? tooltipTitle : label;
  const thumbClass = `group relative overflow-hidden rounded-md border text-left transition-colors ${
    variant === 'map' && isActive
      ? 'border-amber-500/55 bg-amber-950/35 ring-1 ring-amber-500/40'
      : interactive
        ? 'border-dh-strong bg-dh-canvas/25 hover:bg-dh-hover/70'
        : 'border-dh-border/50 bg-dh-canvas/25 cursor-default'
  } ${variant === 'camera' ? 'border-violet-500/30' : ''}`;

  const thumbInner = (
    <div className="relative">
      <MapViewThumbInterior mapRow={mapRow} viewState={viewState} />
      {showCameraBadge ? (
        <div className="absolute bottom-0.5 right-0.5 rounded border border-dh-border/80 bg-dh-raised/95 p-0.5 shadow-sm">
          <Camera size={10} className="text-violet-300/90" aria-hidden />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex w-[4.75rem] shrink-0 flex-col gap-0.5">
      {interactive ? (
        <button
          type="button"
          role={variant === 'map' ? 'tab' : undefined}
          aria-selected={variant === 'map' ? isActive : undefined}
          onClick={onClick}
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
      {!hideCaption || actions ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          {!hideCaption ? (
            <span
              className={`truncate text-center text-[10px] leading-tight ${
                variant === 'map' && isActive ? 'font-medium text-dh' : 'text-dh-muted'
              }`}
              title={label}
            >
              {label}
            </span>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

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

function MapConfigToolbar({ mapConfig, onMapConfigChange, isUploading, onFileSelect, tableName = '', tableStateReady = false, onTableNameChange, onDeleteTable }) {
  const { mapDimension = 'width', mapSizeFt = 100, mapImageUrl } = mapConfig ?? {};
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
          <span className="text-[10px] text-dh-muted/45 select-none whitespace-nowrap">Paste or</span>
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

        {mapImageUrl && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded bg-dh-hover hover:bg-red-900 text-dh-muted hover:text-red-300 transition-colors"
            title="Remove map image"
            onClick={() => onMapConfigChange({ mapImageUrl: null, mapImageNaturalWidth: null, mapImageNaturalHeight: null }, true)}
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

function TokenCircle({ element, size, instanceNum, isMyCharacter, isPlayer, isDragging, isGhost, isPinned, isProxy, rangeBand, rangeBandGlowScale }) {
  const isChar = element.elementType === 'character';
  const isAdv = element.elementType === 'adversary';

  const label = tokenAbbrev(element.name);
  const instLabel = isAdv && instanceNum != null ? `#${instanceNum}` : null;

  // Build dot groups for border ring indicator
  const dotGroups = [];
  if (isChar) {
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

  // Range-band decoration: solid ring + intense outer glow (scale widens ring and blur, e.g. 3 for drag ghost)
  const glowScale = rangeBandGlowScale ?? 1;
  const glowStyle = rangeBand
    ? { boxShadow: `0 0 0 ${3 * glowScale}px ${rangeBand.tokenRing}, 0 0 ${18 * glowScale}px ${6 * glowScale}px ${rangeBand.tokenGlow}` }
    : {};

  const advDefeated = isAdv && isAdversaryDefeated(element);
  const bgClass = isChar
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
        ${isProxy ? 'opacity-20' : ''}
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
      title={element.name}
    >
      <TokenDotRing size={size} groups={dotGroups} />
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
}) {
  const isChar = element.elementType === 'character';
  const isAdv = element.elementType === 'adversary';
  const canEdit = !isPlayer || isMyCharacter;
  const canEditAdv = !isPlayer; // only GM edits adversaries
  const pendingManual = findPendingManualTrackBanner(pendingBanners ?? [], element.instanceId);
  const displayEl = mergeManualTrackDisplay(element, pendingManual);
  const manualAck = getPendingManualTrackAckDeltas(element, pendingManual);
  const lsHeal = getLifeSupportPendingHealSlots(pendingBanners, lifeSupportSelections, element.instanceId);
  const applyResource = queueManualTrackEdit
    ? (upd) => queueManualTrackEdit(element, upd)
    : (upd) => updateActiveElement(element.instanceId, upd);

  // Clamp position to viewport
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ left: anchorX + 12, top: anchorY - 20 });
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { left, top } = pos;
    // Flip to left if panel would overflow right
    if (left + rect.width > vw - 8) left = anchorX - rect.width - 12;
    // Clamp vertical
    top = Math.max(8, Math.min(vh - rect.height - 8, top));
    // Clamp left
    left = Math.max(8, left);
    setPos({ left, top });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const hpMax = isChar ? element.maxHp : element.hp_max;
  const stressMax = isChar ? element.maxStress : element.stress_max;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-dh-raised border border-dh-strong rounded-lg shadow-2xl p-3 min-w-[180px] max-w-[240px]"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{element.name}</div>
          {isChar && element.playerName && (
            <div className="text-xs text-dh-muted truncate">{element.playerName}</div>
          )}
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

      {/* HP — filled = damage taken (matches sidebar & token dots) */}
      {hpMax > 0 && (
        <div className="mb-1.5">
          <div className="text-xs text-dh-muted mb-0.5">HP {element.currentHp ?? hpMax}/{hpMax}</div>
          <CheckboxTrack
            total={hpMax}
            filled={Math.max(0, hpMax - (element.currentHp ?? hpMax))}
            pendingFilled={manualAck.hpDamageAdd}
            pendingClearFilled={manualAck.hpHealSlots + lsHeal}
            fillColor="bg-red-500"
            onSetFilled={canEdit || canEditAdv
              ? (dmg) => applyResource({ currentHp: hpMax - dmg })
              : undefined}
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
            pendingFilled={(pendingResourceCosts[element.instanceId]?.stress ?? 0) + manualAck.stressAdd}
            pendingClearFilled={manualAck.stressClear}
            fillColor="bg-yellow-600"
            onSetFilled={canEdit || canEditAdv
              ? (v) => applyResource({ currentStress: v })
              : undefined}
          />
        </div>
      )}

      {/* Hope (characters only) — server baseline + dashed pending (rolls + manual GM-ack queue) */}
      {isChar && (element.maxHope ?? 6) > 0 && (() => {
        const maxH = element.maxHope ?? 6;
        const hopePending = pendingResourceCosts[element.instanceId]?.hope ?? 0;
        const remaining = element.hope ?? maxH;
        return (
          <div className="mb-1.5">
            <div className="text-xs text-dh-muted mb-0.5">Hope {remaining}/{maxH}</div>
            <CheckboxTrack
              total={maxH}
              filled={Math.max(0, remaining - hopePending)}
              pendingFilled={hopePending + manualAck.hopeGain}
              pendingClearFilled={manualAck.hopeSpend}
              fillColor={HOPE_TRACK_FILL}
              label="Hope"
              verbs={['Gain', 'Spend']}
              pulseOnDecreaseOnly
              onSetFilled={canEdit ? (v) => applyResource({ hope: v }) : undefined}
            />
          </div>
        );
      })()}

      {/* Armor (Daggerstack characters) */}
      {isChar && (element.maxArmor ?? 0) > 0 && (
        <div className="mb-1.5">
          <div className="text-xs text-dh-muted mb-0.5">Armor {displayEl.currentArmor ?? element.maxArmor ?? 0}/{element.maxArmor ?? 0}</div>
          <CheckboxTrack
            total={element.maxArmor ?? 0}
            filled={displayEl.currentArmor ?? element.maxArmor ?? 0}
            fillColor="bg-cyan-600"
            onSetFilled={canEdit ? (v) => {
              const upd = { currentArmor: v };
              if (element.reinforcedActive && v < (element.currentArmor ?? element.maxArmor ?? 0)) upd.reinforcedActive = false;
              applyResource(upd);
            } : undefined}
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
    </div>
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
      {tokens.map(({ element, instanceNum, isMyCharacter, isProxy }) => (
        <div
          key={element.instanceId}
          style={{ touchAction: 'none' }}
          onPointerDown={e => onPointerDown(e, element, true)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <TokenCircle
            element={element}
            size={tokenSizePx}
            instanceNum={instanceNum}
            isMyCharacter={isMyCharacter}
            isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
            isPinned={pinnedInstanceId === element.instanceId}
            isProxy={isProxy}
          />
        </div>
      ))}
    </div>
  );
}

// ─── MapViewControls (pan/zoom — no native map scrolling) ─────────────────────

function MapViewControls({
  minZoom,
  maxZoom,
  mapZoom,
  onZoomChange,
  panLeft,
  panTop,
  maxPanLeft,
  maxPanTop,
  onPanLeftChange,
  onPanTopChange,
  onZoomToActors,
  zoomToActorsDisabled,
}) {
  const xMax = Math.max(0, maxPanLeft);
  const yMax = Math.max(0, maxPanTop);
  const zRange = maxZoom > minZoom;
  const xStep = xMax > 0 ? Math.min(0.25, Math.max(0.01, xMax / 200)) : 1;
  const yStep = yMax > 0 ? Math.min(0.25, Math.max(0.01, yMax / 200)) : 1;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-1.5 shrink-0 text-[11px] border-b border-dh-border bg-dh-surface/80">
      <label className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium w-4 shrink-0 text-dh-muted">X</span>
        <input
          type="range"
          aria-label="Pan horizontal"
          min={0}
          max={xMax > 0 ? xMax : 1}
          step={xStep}
          value={xMax > 0 ? Math.min(panLeft, xMax) : 0}
          disabled={xMax <= 0}
          onChange={(e) => onPanLeftChange(Number(e.target.value))}
          className="w-20 sm:w-28 disabled:opacity-40 accent-sky-600"
        />
      </label>
      <label className="flex items-center gap-1.5 min-w-0">
        <span className="font-medium w-4 shrink-0 text-dh-muted">Y</span>
        <input
          type="range"
          aria-label="Pan vertical"
          min={0}
          max={yMax > 0 ? yMax : 1}
          step={yStep}
          value={yMax > 0 ? Math.min(panTop, yMax) : 0}
          disabled={yMax <= 0}
          onChange={(e) => onPanTopChange(Number(e.target.value))}
          className="w-20 sm:w-28 disabled:opacity-40 accent-sky-600"
        />
      </label>
      <label className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial">
        <span className="font-medium shrink-0 text-dh-muted">Zoom</span>
        <input
          type="range"
          aria-label="Map zoom"
          min={minZoom}
          max={maxZoom}
          step={zRange ? Math.max(0.0001, (maxZoom - minZoom) / 500) : minZoom}
          value={mapZoom}
          disabled={!zRange}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="min-w-[5rem] flex-1 sm:w-32 disabled:opacity-40 accent-amber-600/90"
        />
        <span className="tabular-nums w-12 shrink-0 text-right text-dh-muted">{mapZoom.toFixed(2)}×</span>
      </label>
      {onZoomToActors && (
        <Tooltip label="Zoom to actors — fit everyone on the map at the closest zoom">
          <button
            type="button"
            aria-label="Zoom to actors"
            onClick={onZoomToActors}
            disabled={zoomToActorsDisabled}
            className="shrink-0 p-1 rounded border border-dh-strong bg-dh-raised/80 hover:bg-dh-hover text-dh-muted hover:text-dh disabled:opacity-40 disabled:pointer-events-none"
          >
            <Focus size={14} />
          </button>
        </Tooltip>
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
  /** Game Table: queue manual HP/stress/hope/armor edits for GM ack */
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
}) {
  const scrollWrapperRef = useRef(null);
  const scrollContainerRef = useRef(null);
  /** GM right-drag map pan: { pointerId, startX, startY, startPanLeft, startPanTop } */
  const panRightDragRef = useRef(null);
  const leftTrayRef = useRef(null);
  const rightTrayRef = useRef(null);
  const dragRef = useRef(null);
  const mapPingTapRef = useRef(null);
  const mapPingPointerUpRef = useRef(null);
  /** In-map anchor for measuring where to place the portaled fireworks layer (above DiceRoller z-15). */
  const fireworksAnchorRef = useRef(null);
  const fireworksPortalMountRef = useRef(null);
  const fireworksInstanceRef = useRef(null);
  const mapPingSeenIdsRef = useRef(new Set());
  const fileInputRef = useRef(null);

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
  const [isUploading, setIsUploading] = useState(false);
  const [bullseyeFt, setBullseyeFt] = useState(null); // { x, y } in feet, null when off-map
  // Frozen bullseye position during drag (feet coords of dragged token's origin)
  const frozenBullseyeRef = useRef(null);
  // Second bullseye that follows the dragged token during drag (only when frozen bullseye is set)
  const [followBullseyeFt, setFollowBullseyeFt] = useState(null);

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

  const handleImageFile = useCallback(async (file) => {
    setIsUploading(true);
    try {
      const { url, naturalWidth, naturalHeight } = await processImageFile(file);
      if (!url) return;
      const img = {
        mapImageUrl: url,
        mapImageNaturalWidth: naturalWidth,
        mapImageNaturalHeight: naturalHeight,
      };
      if (mapConfigHasImage(mapConfig) && typeof onAddMapWithImage === 'function') {
        onAddMapWithImage(img);
      } else {
        onMapConfigChange(img, true);
      }
    } catch (err) {
      console.error('[BattleMap] image processing failed:', err);
    } finally {
      setIsUploading(false);
    }
  }, [mapConfig, onMapConfigChange, onAddMapWithImage]);

  // Paste map image (after handleImageFile)
  useEffect(() => {
    if (isPlayer) return;
    const handler = async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(i => i.type.startsWith('image/'));
      if (!imgItem) return;
      const file = imgItem.getAsFile();
      if (file) await handleImageFile(file);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [isPlayer, handleImageFile]);

  // Derived map dimensions
  const { mapWidthFt, mapHeightFt } = useMemo(() => getMapDimensions(mapConfig), [mapConfig]);
  const pxPerFt = useMemo(
    () => Math.max(containerWidth / mapWidthFt, MIN_PX_PER_FT),
    [containerWidth, mapWidthFt],
  );
  const renderedWidthPx = Math.round(mapWidthFt * pxPerFt);
  const renderedHeightPx = Math.round(mapHeightFt * pxPerFt);
  const tokenSizePx = Math.max(33, Math.round(5 * pxPerFt));
  const trayTokenSizePx = CHARACTER_TRAY_WIDTH_PX - 16; // 36; fixed size for tray tokens

  const activeViewIdResolved = useMemo(() => {
    if (isPlayer && playerFreeMapExplore) return null;
    if (!isPlayer && gmActiveViewId === null) return null;
    if (!isPlayer) return gmActiveViewId ?? mapViews[0]?.id ?? null;
    return playerSelectedViewId ?? mapViews[0]?.id ?? null;
  }, [isPlayer, playerFreeMapExplore, gmActiveViewId, playerSelectedViewId, mapViews]);

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
    mapZoom,
    mapPanLeft,
    mapPanTop,
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
  /** Player-only: when set, the player is framing a personal camera (pan/zoom allowed); otherwise they follow the GM view. */
  const [playerActivePersonalCameraId, setPlayerActivePersonalCameraId] = useState(null);
  const playerActivePersonalCameraIdRef = useRef(null);
  playerActivePersonalCameraIdRef.current = playerActivePersonalCameraId;
  const playerCameraPersistTimerRef = useRef(null);
  const playerFreeMapPersistTimerRef = useRef(null);
  const playerFreeMapHydratedKeyRef = useRef('');
  /** Per-user saved cameras (private API; not in SSE). */
  const [personalCameras, setPersonalCameras] = useState([]);
  const [cameraHint, setCameraHint] = useState('');
  const cameraHintTimerRef = useRef(null);
  const mapAllowsPlayerCameras = maps.find(m => m.id === activeMapIdResolved)?.shareWithPlayers !== false;
  const canControlMapView =
    (!isPlayer && !!onMapViewSync) ||
    (isPlayer &&
      mapAllowsPlayerCameras &&
      (!!playerActivePersonalCameraId || playerFreeMapExplore));

  const mapViewSig = useMemo(
    () => `${mapConfig?.mapViewZoomRatio ?? ''}|${JSON.stringify(mapConfig?.mapViewPanNorm ?? null)}`,
    [mapConfig?.mapViewZoomRatio, mapConfig?.mapViewPanNorm],
  );

  const schedulePersistView = useCallback(() => {
    if (!onMapViewSync) return;
    if (mapViewPersistTimerRef.current) clearTimeout(mapViewPersistTimerRef.current);
    mapViewPersistTimerRef.current = setTimeout(() => {
      mapViewPersistTimerRef.current = null;
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
      onMapViewSync(encoded.mapViewZoomRatio, encoded.mapViewPanNorm);
    }, 120);
  }, [onMapViewSync]);

  const schedulePersistPlayerCamera = useCallback(() => {
    if (!isPlayer || !tableId) return;
    const camId = playerActivePersonalCameraIdRef.current;
    if (!camId) return;
    if (playerCameraPersistTimerRef.current) clearTimeout(playerCameraPersistTimerRef.current);
    playerCameraPersistTimerRef.current = setTimeout(async () => {
      playerCameraPersistTimerRef.current = null;
      const wrap = scrollWrapperRef.current;
      const vw = wrap?.clientWidth ?? 0;
      const vh = wrap?.clientHeight ?? 0;
      if (vw <= 0 || vh <= 0) return;
      const id = playerActivePersonalCameraIdRef.current;
      if (!id) return;
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
        const { camera } = await patchPersonalCamera(tableId, id, {
          mapViewZoomRatio: encoded.mapViewZoomRatio,
          mapViewPanNorm: encoded.mapViewPanNorm,
        });
        setPersonalCameras((prev) => prev.map((c) => (c.id === camera.id ? { ...c, ...camera } : c)));
      } catch (err) {
        console.error('[BattleMap] patch personal camera failed:', err);
      }
    }, 120);
  }, [isPlayer, tableId]);

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
          }),
        );
      } catch {
        /* ignore */
      }
    }, 120);
  }, [isPlayer, tableId, playerFreeExploreMapId]);

  const schedulePersistPlayerViewport = useCallback(() => {
    if (playerFreeMapExplore) schedulePersistPlayerFreeMap();
    else schedulePersistPlayerCamera();
  }, [playerFreeMapExplore, schedulePersistPlayerFreeMap, schedulePersistPlayerCamera]);

  useEffect(() => {
    gmViewHydratedRef.current = false;
  }, [mapConfig?.mapImageUrl, gmUid, activeMapIdResolved, gmActiveViewId]);

  useEffect(() => {
    if (!isPlayer) return;
    setPlayerActivePersonalCameraId(null);
  }, [isPlayer, mapConfig?.mapImageUrl]);

  useEffect(() => {
    if (!tableId) {
      setPersonalCameras([]);
      return;
    }
    let cancelled = false;
    fetchPersonalCameras(tableId)
      .then((r) => {
        if (!cancelled) setPersonalCameras(r.cameras || []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  useEffect(() => () => {
    if (cameraHintTimerRef.current != null) window.clearTimeout(cameraHintTimerRef.current);
  }, []);

  const applyPersonalCamera = useCallback(
    (camera) => {
      if (!camera) return;
      if (isPlayer) onPlayerExitMapFreeExplore?.();
      if (camera.mapId !== activeMapIdResolved) {
        const viewOnMap = mapViews.find(v => v.mapId === camera.mapId);
        if (onSetActiveMap) {
          onSetActiveMap(camera.mapId);
          if (viewOnMap && onPlayerSelectView) onPlayerSelectView(viewOnMap.id);
        } else if (viewOnMap && onPlayerSelectView) {
          onPlayerSelectView(viewOnMap.id);
        } else {
          const msg =
            maps.length > 1
              ? 'This camera is for another map. Follow the GM until that map is shown, then load it again.'
              : 'This camera does not match the current map.';
          setCameraHint(msg);
          if (cameraHintTimerRef.current != null) window.clearTimeout(cameraHintTimerRef.current);
          cameraHintTimerRef.current = window.setTimeout(() => setCameraHint(''), 7000);
        }
        return;
      }
      const stored = { mapViewZoomRatio: camera.mapViewZoomRatio, mapViewPanNorm: camera.mapViewPanNorm };
      const d = decodeMapViewState(stored, {
        minZoom,
        maxZoom,
        renderedWidthPx,
        renderedHeightPx,
        viewportW: containerWidth,
        viewportH: containerHeight,
      });
      if (!d) return;
      mapZoomRef.current = d.mapZoom;
      setMapZoom(d.mapZoom);
      mapPanLeftRef.current = d.scrollLeft;
      mapPanTopRef.current = d.scrollTop;
      setMapPanLeft(d.scrollLeft);
      setMapPanTop(d.scrollTop);
      if (isPlayer) setPlayerActivePersonalCameraId(camera.id);
    },
    [
      activeMapIdResolved,
      minZoom,
      maxZoom,
      renderedWidthPx,
      renderedHeightPx,
      containerWidth,
      containerHeight,
      onSetActiveMap,
      onPlayerSelectView,
      isPlayer,
      maps,
      mapViews,
      onPlayerExitMapFreeExplore,
    ],
  );

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
      });
      return;
    }
    if (!tableId) return;
    try {
      const { camera } = await postPersonalCamera(tableId, {
        name: trimmed,
        mapId: activeMapIdResolved,
        mapViewZoomRatio: encoded.mapViewZoomRatio,
        mapViewPanNorm: encoded.mapViewPanNorm,
      });
      setPersonalCameras((prev) => [...prev, camera]);
    } catch (err) {
      console.error('[BattleMap] split camera failed:', err);
    }
  }, [tableId, activeMapIdResolved, onAddMapViewOp]);

  const handlePlayerCreateCamera = useCallback(async () => {
    if (!isPlayer || !tableId || !mapAllowsPlayerCameras) return;
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
    const name = window.prompt('Name this camera', 'Camera');
    if (name === null) return;
    const trimmed = (name || 'Camera').trim() || 'Camera';
    try {
      const { camera } = await postPersonalCamera(tableId, {
        name: trimmed,
        mapId: activeMapIdResolved,
        mapViewZoomRatio: encoded.mapViewZoomRatio,
        mapViewPanNorm: encoded.mapViewPanNorm,
      });
      setPersonalCameras((prev) => [...prev, camera]);
      setPlayerActivePersonalCameraId(camera.id);
    } catch (err) {
      console.error('[BattleMap] player create camera failed:', err);
    }
  }, [isPlayer, tableId, mapAllowsPlayerCameras, activeMapIdResolved]);

  const handleRenameCamera = useCallback(async (cam) => {
    if (!tableId || !cam?.id) return;
    const name = window.prompt('View name', cam.name || 'Saved view');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await patchPersonalCameraName(tableId, cam.id, trimmed);
      setPersonalCameras((prev) =>
        prev.map((c) => (c.id === cam.id ? { ...c, name: trimmed } : c)),
      );
    } catch (err) {
      console.error('[BattleMap] rename camera failed:', err);
    }
  }, [tableId]);

  const handleDeleteCamera = useCallback(async (cam) => {
    if (!tableId || !cam?.id) return;
    if (!window.confirm(`Delete saved view “${cam.name || 'Saved view'}”?`)) return;
    try {
      await deletePersonalCamera(tableId, cam.id);
      setPersonalCameras((prev) => prev.filter((c) => c.id !== cam.id));
      setPlayerActivePersonalCameraId((id) => (id === cam.id ? null : id));
    } catch (err) {
      console.error('[BattleMap] delete camera failed:', err);
    }
  }, [tableId]);

  // GM: broadcast portable mapViewZoomRatio/mapViewPanNorm (same encoding as the X/Y/Zoom sliders) whenever the
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
    if (mapConfig?.mapViewZoomRatio == null && mapConfig?.mapViewPanNorm == null) {
      gmViewHydratedRef.current = true;
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
      return;
    }
    gmViewHydratedRef.current = true;
    mapZoomRef.current = d.mapZoom;
    setMapZoom(d.mapZoom);
    mapPanLeftRef.current = d.scrollLeft;
    mapPanTopRef.current = d.scrollTop;
    setMapPanLeft(d.scrollLeft);
    setMapPanTop(d.scrollTop);
  }, [
    onMapViewSync,
    tableStateReady,
    mapConfig?.mapImageUrl,
    mapConfig?.mapViewZoomRatio,
    mapConfig?.mapViewPanNorm,
    minZoom,
    maxZoom,
    renderedWidthPx,
    renderedHeightPx,
    containerWidth,
    containerHeight,
  ]);

  useLayoutEffect(() => {
    if (onMapViewSync || !tableStateReady) return;
    if (!shouldApplyRemotePlayerMapView(isPlayer, playerActivePersonalCameraId, playerFreeMapExplore)) return;
    if (containerWidth <= 0 || containerHeight <= 0) return;
    const d = decodeMapViewState(mapConfig, {
      minZoom,
      maxZoom,
      renderedWidthPx,
      renderedHeightPx,
      viewportW: containerWidth,
      viewportH: containerHeight,
    });
    if (!d) return;
    mapZoomRef.current = d.mapZoom;
    setMapZoom(d.mapZoom);
    mapPanLeftRef.current = d.scrollLeft;
    mapPanTopRef.current = d.scrollTop;
    setMapPanLeft(d.scrollLeft);
    setMapPanTop(d.scrollTop);
  }, [
    onMapViewSync,
    tableStateReady,
    isPlayer,
    playerActivePersonalCameraId,
    playerFreeMapExplore,
    mapViewSig,
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
        const { mapViewZoomRatio, mapViewPanNorm } = JSON.parse(raw);
        d = decodeMapViewState(
          { mapViewZoomRatio, mapViewPanNorm },
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
    playerFreeMapHydratedKeyRef.current = key;
  }, [
    isPlayer,
    playerFreeMapExplore,
    playerFreeExploreMapId,
    tableId,
    mapConfig?.mapImageUrl,
    mapConfig?.mapViewZoomRatio,
    mapConfig?.mapViewPanNorm,
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
    if (playerCameraPersistTimerRef.current) clearTimeout(playerCameraPersistTimerRef.current);
    if (playerFreeMapPersistTimerRef.current) clearTimeout(playerFreeMapPersistTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    setMapZoom((z) => clampMapZoom(z, minZoom, maxZoom));
  }, [minZoom, maxZoom]);

  useLayoutEffect(() => {
    if (containerWidth <= 0 || containerHeight <= 0) return;
    const panParams = {
      mapZoom,
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
      };
    },
    [isPlayer, gmActiveViewId, liveStripView, maps],
  );

  const camerasByMapId = useMemo(() => {
    const out = new Map();
    for (const cam of personalCameras) {
      const list = out.get(cam.mapId) || [];
      list.push(cam);
      out.set(cam.mapId, list);
    }
    return out;
  }, [personalCameras]);

  const orphanCameras = useMemo(
    () => personalCameras.filter((c) => !maps.some((m) => m.id === c.mapId)),
    [personalCameras, maps],
  );

  /** Player strip: one scroll batch per map that has GM views and/or personal cameras. */
  const playerViewBatches = useMemo(() => {
    const out = [];
    for (const m of maps) {
      const gmViews = playerStripViews.filter((v) => v.mapId === m.id);
      const cams =
        m.shareWithPlayers !== false ? (camerasByMapId.get(m.id) || []) : [];
      if (!gmViews.length && !cams.length) continue;
      out.push({ map: m, gmViews, cams });
    }
    return out;
  }, [maps, playerStripViews, camerasByMapId]);

  useEffect(() => {
    if (!isPlayer) return;
    if (personalCameraTargetsUnsharedMap(playerActivePersonalCameraId, personalCameras, maps)) {
      setPlayerActivePersonalCameraId(null);
    }
    if (freeMapExploreTargetsUnsharedMap(playerFreeExploreMapId, playerFreeMapExplore, maps)) {
      onPlayerExitMapFreeExplore?.();
    }
  }, [
    isPlayer,
    maps,
    personalCameras,
    playerActivePersonalCameraId,
    playerFreeMapExplore,
    playerFreeExploreMapId,
    onPlayerExitMapFreeExplore,
  ]);

  const applyZoomFromControl = useCallback(
    (newZ) => {
      if (!canControlMapView) return;
      const z = clampMapZoom(newZ, minZoom, maxZoom);
      const oldZ = mapZoomRef.current;
      if (z === oldZ) return;
      const pan = scrollAfterZoomTowardPoint({
        scrollLeft: mapPanLeftRef.current,
        scrollTop: mapPanTopRef.current,
        viewportX: containerWidth / 2,
        viewportY: containerHeight / 2,
        oldZoom: oldZ,
        newZoom: z,
        innerWidthPx: renderedWidthPx,
        innerHeightPx: renderedHeightPx,
        viewportW: containerWidth,
        viewportH: containerHeight,
      });
      mapZoomRef.current = z;
      mapPanLeftRef.current = pan.scrollLeft;
      mapPanTopRef.current = pan.scrollTop;
      setMapZoom(z);
      setMapPanLeft(pan.scrollLeft);
      setMapPanTop(pan.scrollTop);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    },
    [
      canControlMapView,
      minZoom,
      maxZoom,
      containerWidth,
      containerHeight,
      renderedWidthPx,
      renderedHeightPx,
      onMapViewSync,
      schedulePersistView,
      schedulePersistPlayerViewport,
      isPlayer,
    ],
  );

  const centerMapOnPlacedActor = useCallback(
    (element) => {
      if (!canControlMapView) return;
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

  const applyZoomToFitActors = useCallback(() => {
    if (!canControlMapView) return;
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
      if (el.elementType !== 'character' && el.elementType !== 'adversary') continue;
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
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw <= 0 || vh <= 0) return;

      const { dx, dy } = normalizeWheelDeltaPixels(e, vw, vh);
      const z = mapZoomRef.current;
      const rw = renderedWRef.current;
      const rh = renderedHRef.current;
      const minZ = minZoomRef.current;
      const maxZ = maxZoomRef.current;

      const maxL = Math.max(0, rw * z - vw);
      const maxT = Math.max(0, rh * z - vh);

      const zoomChord = e.metaKey || e.ctrlKey;

      if (zoomChord) {
        if (maxZ <= minZ) return;
        e.preventDefault();
        e.stopPropagation();
        if (dy === 0 || !Number.isFinite(dy)) return;
        const factor = Math.exp(-dy * 0.0015);
        const oldZ = mapZoomRef.current;
        const newZ = clampMapZoom(oldZ * factor, minZ, maxZ);
        if (newZ === oldZ) return;
        const rect = el.getBoundingClientRect();
        const viewportX = e.clientX - rect.left;
        const viewportY = e.clientY - rect.top;
        const pan = scrollAfterZoomTowardPoint({
          scrollLeft: mapPanLeftRef.current,
          scrollTop: mapPanTopRef.current,
          viewportX,
          viewportY,
          oldZoom: oldZ,
          newZoom: newZ,
          innerWidthPx: rw,
          innerHeightPx: rh,
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
        return;
      }

      if (e.shiftKey) {
        if (maxL <= 0) return;
        const horizDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        if (horizDelta === 0 || !Number.isFinite(horizDelta)) return;
        e.preventDefault();
        e.stopPropagation();
        const next = clampPanScroll(
          mapPanLeftRef.current + horizDelta,
          mapPanTopRef.current,
          { mapZoom: z, renderedWidthPx: rw, renderedHeightPx: rh, viewportW: vw, viewportH: vh },
        );
        if (next.scrollLeft === mapPanLeftRef.current && next.scrollTop === mapPanTopRef.current) return;
        mapPanLeftRef.current = next.scrollLeft;
        mapPanTopRef.current = next.scrollTop;
        setMapPanLeft(next.scrollLeft);
        setMapPanTop(next.scrollTop);
        if (onMapViewSync) schedulePersistView();
        if (isPlayer) schedulePersistPlayerViewport();
        return;
      }

      if (maxT <= 0) return;
      if (dy === 0 || !Number.isFinite(dy)) return;
      e.preventDefault();
      e.stopPropagation();
      const next = clampPanScroll(
        mapPanLeftRef.current,
        mapPanTopRef.current + dy,
        { mapZoom: z, renderedWidthPx: rw, renderedHeightPx: rh, viewportW: vw, viewportH: vh },
      );
      if (next.scrollLeft === mapPanLeftRef.current && next.scrollTop === mapPanTopRef.current) return;
      mapPanLeftRef.current = next.scrollLeft;
      mapPanTopRef.current = next.scrollTop;
      setMapPanLeft(next.scrollLeft);
      setMapPanTop(next.scrollTop);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [canControlMapView, onMapViewSync, schedulePersistView, schedulePersistPlayerViewport, containerWidth, containerHeight, isPlayer]);

  const onPanLeftChange = useCallback(
    (v) => {
      if (!canControlMapView) return;
      mapPanLeftRef.current = v;
      setMapPanLeft(v);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    },
    [canControlMapView, onMapViewSync, schedulePersistView, schedulePersistPlayerViewport, isPlayer],
  );

  const onPanTopChange = useCallback(
    (v) => {
      if (!canControlMapView) return;
      mapPanTopRef.current = v;
      setMapPanTop(v);
      if (onMapViewSync) schedulePersistView();
      if (isPlayer) schedulePersistPlayerViewport();
    },
    [canControlMapView, onMapViewSync, schedulePersistView, schedulePersistPlayerViewport, isPlayer],
  );

  // Categorize elements
  const characters = useMemo(() => activeElements.filter(el => el.elementType === 'character'), [activeElements]);
  const adversaries = useMemo(() => activeElements.filter(el => el.elementType === 'adversary'), [activeElements]);

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

  const canDrag = useCallback((el) => {
    const moveLocked =
      (el.moveDisabledSources?.length > 0) || (el.elementType === 'character' && el.retractedActive);
    if (moveLocked) return false;
    if (!isPlayer) return true; // GM can drag anything else
    if (el.elementType === 'adversary') return false; // players can't drag adversaries
    return isMyCharacter(el);
  }, [isPlayer, isMyCharacter]);

  // Tray: all characters — in-tray first, then dim proxies for those on the active map
  const charTrayTokens = useMemo(() => {
    const onActive = (el) => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved;
    const inTray = characters.filter(el => el.tokenX == null).map(el => ({ element: el, instanceNum: null, isMyCharacter: isMyCharacter(el), isProxy: false }));
    const onMap = characters.filter(onActive).map(el => ({ element: el, instanceNum: null, isMyCharacter: isMyCharacter(el), isProxy: true }));
    return [...inTray, ...onMap];
  }, [characters, isMyCharacter, activeMapIdResolved]);

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

  const advMapTokens = useMemo(() =>
    adversaries
      .filter(el => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved)
      .map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false })),
    [adversaries, instanceNumbers, activeMapIdResolved]);

  // All placed tokens for snap detection and range band computation
  const allMapTokens = useMemo(() => [
    ...charMapTokens,
    ...advMapTokens,
  ], [charMapTokens, advMapTokens]);

  const hasPlacedActorsOnMap = useMemo(
    () =>
      activeElements.some(
        el =>
          (el.elementType === 'character' || el.elementType === 'adversary') &&
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
    const rect = container.getBoundingClientRect();
    const mapX = (clientX - rect.left + mapPanLeft) / mapZoom;
    const mapY = (clientY - rect.top + mapPanTop) / mapZoom;
    return { x: mapX / pxPerFt, y: mapY / pxPerFt };
  }, [pxPerFt, mapZoom, mapPanLeft, mapPanTop]);

  // Find a placed token whose bounding box contains the given client point
  const findTokenAtClient = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const mapX = (clientX - rect.left + mapPanLeft) / mapZoom;
    const mapY = (clientY - rect.top + mapPanTop) / mapZoom;
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
  }, [allMapTokens, pxPerFt, tokenSizePx, mapZoom, mapPanLeft, mapPanTop]);

  // Handle pointer move over the map canvas area (not trays)
  const handleMapPointerMove = useCallback((e) => {
    if (panRightDragRef.current) return;
    // During an active drag, the bullseye is frozen at the drag origin — don't update
    if (frozenBullseyeRef.current) {
      setBullseyeFt(frozenBullseyeRef.current);
      return;
    }
    // Snap to token center if hovering over a placed token
    const snapTarget = findTokenAtClient(e.clientX, e.clientY);
    if (snapTarget) {
      setBullseyeFt({ x: snapTarget.tokenX + 2.5, y: snapTarget.tokenY + 2.5, excludeInstanceId: snapTarget.instanceId });
    } else {
      const ft = clientToFt(e.clientX, e.clientY);
      if (ft) setBullseyeFt(ft);
    }
  }, [findTokenAtClient, clientToFt]);

  const handleMapPointerLeave = useCallback(() => {
    if (!frozenBullseyeRef.current) setBullseyeFt(null);
  }, []);

  const handleMapPingPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (!tableId) return;
    if (panRightDragRef.current) return;
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
  }, [tableId, clientToFt, mapWidthFt, mapHeightFt, activeMapIdResolved, isPlayer, appendMapPing]);

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
    if (!canDrag(element)) {
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
        const rect = container.getBoundingClientRect();
        const tokenClientX = element.tokenX * pxPerFt * mapZoom - mapPanLeft + rect.left;
        const tokenClientY = element.tokenY * pxPerFt * mapZoom - mapPanTop + rect.top;
        grabOffsetX = Math.max(0, Math.min(tokenSize, e.clientX - tokenClientX));
        grabOffsetY = Math.max(0, Math.min(tokenSize, e.clientY - tokenClientY));
      }
    }

    dragRef.current = {
      instanceId: element.instanceId,
      element,
      fromTray,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
      pointerId: e.pointerId,
      instanceNum: instanceNumbers[element.instanceId],
      myChar: isMyCharacter(element),
      tokenSize,
      grabOffsetX,
      grabOffsetY,
      prevTokenFt:
        element.tokenX != null && element.tokenY != null
          ? { tokenX: element.tokenX, tokenY: element.tokenY }
          : null,
    };
  }, [canDrag, instanceNumbers, isMyCharacter, trayTokenSizePx, tokenSizePx, pxPerFt, mapZoom, mapPanLeft, mapPanTop]);

  const handlePointerMove = useCallback((e) => {
    const ds = dragRef.current;
    if (!ds) return;
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
      if (canControlMapView && ds.fromTray && ds.element.tokenX != null && ds.element.tokenY != null) {
        centerMapOnPlacedActor(ds.element);
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
      const rect = container.getBoundingClientRect();
      // Subtract grab offset so the token's top-left lands where the ghost was,
      // not where the raw cursor was.
      const mapX =
        (e.clientX - rect.left + mapPanLeft) / mapZoom - (ds.grabOffsetX ?? ds.tokenSize / 2);
      const mapY =
        (e.clientY - rect.top + mapPanTop) / mapZoom - (ds.grabOffsetY ?? ds.tokenSize / 2);
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
  }, [isPlayer, pxPerFt, mapWidthFt, mapHeightFt, mapZoom, mapPanLeft, mapPanTop, updateActiveElement, pinnedToken, activeElements, onTokenDragEnd, canControlMapView, centerMapOnPlacedActor, activeMapIdResolved]);

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
        .filter(el => el.tokenX != null && effectiveTokenMapId(el.mapId) === activeMapIdResolved)
        .map(el => ({ instanceId: el.instanceId, tokenX: el.tokenX * scale, tokenY: el.tokenY * scale }));
      scaledElements.forEach(({ instanceId, tokenX, tokenY }) => updateActiveElement(instanceId, { tokenX, tokenY }));
    }
    onMapConfigChange(patch, resetTokenPositions);
  }, [activeElements, updateActiveElement, onMapConfigChange, activeMapIdResolved]);

  // ─── Render ─────────────────────────────────────────────────────────────

  const showLeftTray =
    characters.length > 0 || (!isPlayer && pendingBannerCount > 0);
  const showRightTray = !isPlayer && adversaries.length > 0;
  const showDiceTrayControls =
    onClearDice ||
    onToggleDiceVisibility ||
    (typeof onCancelAllBanners === 'function' && pendingBannerCount > 0);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar — GM only */}
      {!isPlayer && (
        <MapConfigToolbar
          mapConfig={mapConfig}
          onMapConfigChange={handleMapConfigChange}
          isUploading={isUploading}
          onFileSelect={handleImageFile}
          tableName={tableName}
          tableStateReady={tableStateReady}
          onTableNameChange={onTableNameChange}
          onDeleteTable={onDeleteTable}
        />
      )}
      {!isPlayer && maps.length > 0 && onSetActiveView && onMapFreeExplore && (
        <div className="flex items-start gap-2 px-3 py-1.5 bg-dh-surface border-b border-dh-border text-xs shrink-0 flex-wrap">
          <Tooltip label="Camera views">
            <span className="shrink-0 flex items-center justify-center" role="img" aria-label="Camera views">
              <Camera size={trayTokenSizePx} className="text-dh-muted" strokeWidth={1.25} aria-hidden />
            </span>
          </Tooltip>
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
                  mapRow={map}
                  viewState={
                    gmActiveViewId === null && map.id === activeMapIdResolved && liveStripView
                      ? liveStripView
                      : null
                  }
                  label={map.name || 'Map'}
                  isActive={
                    (gmActiveViewId === null && map.id === activeMapIdResolved) ||
                    views.some((v) => v.id === gmActiveViewId)
                  }
                  onClick={() => {
                    if (onMapFreeExplore) onMapFreeExplore(map.id);
                  }}
                  actions={
                    onSetMapShare || onRenameMap || (onRemoveMap && maps.length > 1) ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {onSetMapShare ? (
                          <Tooltip
                            label={
                              map.shareWithPlayers !== false
                                ? 'Players see the map tile and can pan/zoom and save personal cameras'
                                : 'Players only see broadcast views (no map tile or personal cameras)'
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
                                  ? 'Player map views and cameras on'
                                  : 'Player map views and cameras off'
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
                      mapRow={map}
                      viewState={viewStateForStripTile(view)}
                      label={label}
                      isActive={view.id === gmActiveViewId}
                      onClick={() => onSetActiveView(view.id)}
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
            {tableId && orphanCameras.length > 0 ? (
              <div className="flex shrink-0 items-start gap-1 rounded-md border border-amber-800/35 bg-amber-950/20 p-1">
                {orphanCameras.map((cam) => (
                  <MapViewStripTile
                    key={cam.id}
                    variant="camera"
                    mapRow={{
                      mapSizeFt: 100,
                      mapDimension: 'width',
                      mapImageUrl: null,
                      mapImageNaturalWidth: null,
                      mapImageNaturalHeight: null,
                    }}
                    viewState={{
                      mapViewZoomRatio: cam.mapViewZoomRatio,
                      mapViewPanNorm: cam.mapViewPanNorm,
                    }}
                    label={cam.name || 'View'}
                    isActive={false}
                    showCameraBadge
                    onClick={() => applyPersonalCamera(cam)}
                    actions={
                      <div className="flex items-center justify-center gap-0.5">
                        <Tooltip label="Rename">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRenameCamera(cam);
                            }}
                            className="rounded p-0.5 text-dh-muted hover:bg-dh-hover/80 hover:text-dh"
                            aria-label={`Rename ${cam.name || 'saved view'}`}
                          >
                            <Pencil size={11} aria-hidden />
                          </button>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteCamera(cam);
                            }}
                            className="rounded p-0.5 text-dh-muted hover:bg-red-900/35 hover:text-red-200"
                            aria-label={`Delete ${cam.name || 'saved view'}`}
                          >
                            <Trash2 size={11} aria-hidden />
                          </button>
                        </Tooltip>
                      </div>
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-1 items-end pt-0.5">
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Tooltip label="Save the current zoom and pan as a new view on this map">
                <button
                  type="button"
                  onClick={handleSplitCamera}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-violet-500/35 bg-violet-950/25 hover:bg-violet-900/35 text-dh text-[11px] shrink-0"
                >
                  <Camera size={12} className="text-violet-300/90 shrink-0" aria-hidden />
                  New view
                </button>
              </Tooltip>
              {onAddMap && (
                <button type="button" onClick={onAddMap} className="px-1.5 py-0.5 rounded border border-dh-strong bg-dh-raised/80 hover:bg-dh-hover text-dh text-[11px] shrink-0">
                  + Map
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {isPlayer &&
        tableId &&
        (playerStripViews.length > 0 || personalCameras.length > 0 || mapAllowsPlayerCameras) && (
          <div className="flex items-start gap-2 px-3 py-1.5 bg-dh-surface border-b border-dh-border text-xs shrink-0 flex-wrap">
            <Tooltip label="Camera views">
              <span className="shrink-0 flex items-center justify-center" role="img" aria-label="Camera views">
                <Camera size={trayTokenSizePx} className="text-dh-muted" strokeWidth={1.25} aria-hidden />
              </span>
            </Tooltip>
            {mapAllowsPlayerCameras ? (
              <Tooltip label="Save current zoom and pan as your personal camera">
                <button
                  type="button"
                  onClick={() => void handlePlayerCreateCamera()}
                  className="mt-0.5 shrink-0 rounded-md border border-violet-500/40 bg-violet-950/30 p-1 text-violet-200 hover:bg-violet-900/40"
                  aria-label="Add personal camera"
                >
                  <span className="relative inline-flex items-center justify-center">
                    <Camera size={20} className="text-violet-300/95" aria-hidden />
                    <Plus
                      size={11}
                      strokeWidth={3}
                      className="absolute -bottom-0.5 -right-0.5 rounded-full bg-dh-canvas text-violet-200"
                      aria-hidden
                    />
                  </span>
                </button>
              </Tooltip>
            ) : null}
            <div
              className="flex flex-1 min-w-0 items-stretch gap-2 overflow-x-auto pb-0.5 -mb-0.5"
              aria-label="GM broadcast views and your saved views"
            >
              {playerViewBatches.map(({ map: m, gmViews, cams }, idx) => (
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
                      mapRow={m}
                      viewState={null}
                      label={m.name || 'Map'}
                      hideCaption
                      tooltipTitle="Pan and zoom freely (not a saved view)"
                      isActive={
                        !!(
                          !playerActivePersonalCameraId &&
                          (playerFreeMapExplore && playerFreeExploreMapId === m.id
                            ? true
                            : gmViews.length > 0 &&
                              gmViews.some((v) => v.id === playerSelectedViewId))
                        )
                      }
                      onClick={() => {
                        setPlayerActivePersonalCameraId(null);
                        onPlayerEnterMapFreeExplore?.(m.id);
                      }}
                    />
                    ) : null}
                    {gmViews.map((view) => (
                      <MapViewStripTile
                        key={view.id}
                        variant="map"
                        mapRow={m}
                        viewState={viewStateForStripTile(view)}
                        label={view.name || 'View'}
                        isActive={
                          view.id === playerSelectedViewId &&
                          !playerActivePersonalCameraId &&
                          !playerFreeMapExplore
                        }
                        onClick={() => {
                          setPlayerActivePersonalCameraId(null);
                          onPlayerSelectView?.(view.id);
                        }}
                      />
                    ))}
                    {cams.map((cam) => (
                      <MapViewStripTile
                        key={cam.id}
                        variant="camera"
                        mapRow={m}
                        viewState={{
                          mapViewZoomRatio: cam.mapViewZoomRatio,
                          mapViewPanNorm: cam.mapViewPanNorm,
                        }}
                        label={cam.name || 'View'}
                        isActive={cam.id === playerActivePersonalCameraId}
                        showCameraBadge
                        onClick={() => applyPersonalCamera(cam)}
                      />
                    ))}
                  </div>
                </Fragment>
              ))}
              {orphanCameras.length > 0 ? (
                <>
                  {playerViewBatches.length > 0 ? (
                    <div
                      className="w-px shrink-0 self-stretch min-h-[4.75rem] bg-dh-border/60"
                      aria-hidden
                    />
                  ) : null}
                  <div className="flex shrink-0 items-start gap-1 rounded-md border border-amber-800/35 bg-amber-950/20 p-1">
                    {orphanCameras.map((cam) => (
                      <MapViewStripTile
                        key={cam.id}
                        variant="camera"
                        mapRow={{
                          mapSizeFt: 100,
                          mapDimension: 'width',
                          mapImageUrl: null,
                          mapImageNaturalWidth: null,
                          mapImageNaturalHeight: null,
                        }}
                        viewState={{
                          mapViewZoomRatio: cam.mapViewZoomRatio,
                          mapViewPanNorm: cam.mapViewPanNorm,
                        }}
                        label={cam.name || 'View'}
                        isActive={cam.id === playerActivePersonalCameraId}
                        showCameraBadge
                        onClick={() => applyPersonalCamera(cam)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      {tableId && cameraHint ? (
        <div className="px-3 py-1 bg-dh-surface border-b border-dh-border text-[11px] text-amber-200/90 leading-snug" role="status">
          {cameraHint}
        </div>
      ) : null}

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
                tokens={charTrayTokens}
                side="left"
                isHighlighted={highlightLeftTray}
                trayRef={null}
                tokenSizePx={trayTokenSizePx}
                dragRef={dragRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
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

        {/* Map column: view controls + viewport (we measure viewport via scrollWrapperRef) */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden relative">
          {canControlMapView && (
            <MapViewControls
              minZoom={minZoom}
              maxZoom={maxZoom}
              mapZoom={mapZoom}
              onZoomChange={applyZoomFromControl}
              panLeft={mapPanLeft}
              panTop={mapPanTop}
              maxPanLeft={maxPanLeft}
              maxPanTop={maxPanTop}
              onPanLeftChange={onPanLeftChange}
              onPanTopChange={onPanTopChange}
              onZoomToActors={applyZoomToFitActors}
              zoomToActorsDisabled={!hasPlacedActorsOnMap}
            />
          )}
          <div ref={scrollWrapperRef} className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
          {/* Viewport: pan via translate (no native scrolling) */}
          <div
            ref={scrollContainerRef}
            className={`w-full h-full overflow-hidden relative touch-none ${
              canControlMapView && (canPanMap || rightPanDragging)
                ? (rightPanDragging ? 'cursor-grabbing' : 'cursor-grab')
                : ''
            }`}
            onClick={handleMapClick}
            onPointerDown={handleRightPanPointerDown}
            onPointerMove={handleRightPanPointerMove}
            onPointerUp={handleRightPanPointerUp}
            onPointerCancel={handleRightPanPointerUp}
            onLostPointerCapture={handleRightPanLostCapture}
            onContextMenu={canControlMapView && canPanMap ? (ev) => { ev.preventDefault(); } : undefined}
          >
            <div
              className="relative shrink-0 will-change-transform"
              style={{
                transform: `translate(${-mapPanLeft}px, ${-mapPanTop}px)`,
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
                onPointerDown={handleMapPingPointerDown}
                onPointerMove={handleMapPointerMove}
                onPointerLeave={handleMapPointerLeave}
              >
              {/* Map image or blank white canvas (tokens and drag/drop work either way) */}
              {mapConfig?.mapImageUrl ? (
                <img
                  src={mapConfig.mapImageUrl}
                  alt="Battle map"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 bg-dh-map-blank flex items-center justify-center">
                  {!isPlayer && charTrayTokens.length === 0 && advTrayTokens.length === 0 && charMapTokens.length === 0 && advMapTokens.length === 0 && (
                    <div className="text-dh-muted text-sm text-center pointer-events-none">
                      <MapIcon size={32} className="mx-auto mb-2 opacity-50" />
                      <div>Upload a map image or drag tokens here</div>
                    </div>
                  )}
                  {isPlayer && charMapTokens.length === 0 && advMapTokens.length === 0 && (
                    <div className="text-dh-muted text-sm text-center pointer-events-none">
                      <MapIcon size={32} className="mx-auto mb-2 opacity-50" />
                      <div>No map loaded</div>
                    </div>
                  )}
                </div>
              )}

              {/* Measure rect for portaled fireworks (above DiceRoller z-15); bursts render in document.body */}
              <div
                ref={fireworksAnchorRef}
                className="absolute inset-0 pointer-events-none overflow-hidden"
                style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 7 }}
                aria-hidden
              />

              {/* Range band bullseye overlay */}
              {bullseyeFt && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 5 }}
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
                  style={{ width: renderedWidthPx, height: renderedHeightPx, zIndex: 6 }}
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
                const p = MAP_TOKEN_HIT_PADDING_PX;
                return (
                <div
                  key={element.instanceId}
                  className="absolute"
                  style={{
                    left: element.tokenX * pxPerFt - p,
                    top: element.tokenY * pxPerFt - p,
                    padding: p,
                    width: tokenSizePx + 2 * p,
                    height: tokenSizePx + 2 * p,
                    boxSizing: 'border-box',
                    touchAction: 'none',
                    zIndex: 10 + stackIdx,
                  }}
                  onPointerDown={e => handlePointerDown(e, element, false)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  <TokenCircle
                    element={element}
                    size={tokenSizePx}
                    instanceNum={null}
                    isMyCharacter={myChar}
                    isPlayer={isPlayer}
                    isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                    isPinned={pinnedToken?.element.instanceId === element.instanceId}
                    rangeBand={rangeBand}
                  />
                </div>
                );
              })}

              {/* Placed adversary tokens — after characters so adversaries stay above; later instances stack higher */}
              {advMapTokens.map(({ element, instanceNum }, advIdx) => {
                const bandIdx = tokenRangeBands[element.instanceId];
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                const p = MAP_TOKEN_HIT_PADDING_PX;
                return (
                <div
                  key={element.instanceId}
                  className="absolute"
                  style={{
                    left: element.tokenX * pxPerFt - p,
                    top: element.tokenY * pxPerFt - p,
                    padding: p,
                    width: tokenSizePx + 2 * p,
                    height: tokenSizePx + 2 * p,
                    boxSizing: 'border-box',
                    touchAction: 'none',
                    zIndex: 10 + charMapTokens.length + advIdx,
                  }}
                  onPointerDown={e => handlePointerDown(e, element, false)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                >
                  <TokenCircle
                    element={element}
                    size={tokenSizePx}
                    instanceNum={instanceNum}
                    isMyCharacter={false}
                    isPlayer={isPlayer}
                    isDragging={dragRef.current?.instanceId === element.instanceId && dragRef.current?.isDragging}
                    isPinned={pinnedToken?.element.instanceId === element.instanceId}
                    rangeBand={rangeBand}
                  />
                </div>
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
          </div>
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
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
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
                  : Math.round((dragGhost.tokenSize ?? tokenSizePx) * mapZoom)
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
        const myChar = isMyCharacter(el);
        const canRemove = !isPlayer || myChar;
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
              updateActiveElement(el.instanceId, { tokenX: null, tokenY: null });
              setPinnedToken(null);
            } : undefined}
            onClose={() => setPinnedToken(null)}
            anchorX={pinnedToken.anchorX}
            anchorY={pinnedToken.anchorY}
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
