import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  clampMapZoom,
  clampPanScroll,
  computeMapZoomBounds,
  scrollAfterZoomTowardPoint,
} from '../lib/battle-map-zoom.js';
import { Upload, X, Map, ArrowLeftToLine, Pencil, Eraser, Eye, EyeOff, Trash2, CircleX } from 'lucide-react';
import { Tooltip } from './Tooltip.jsx';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { HOPE_TRACK_FILL } from './CharacterStatBlockGraphic.jsx';
import { ConditionsTextInput } from './ConditionsTextInput.jsx';
import { getAuthToken } from '../lib/api.js';
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
  const sizeFt = Math.max(1, Math.min(500, Number(mapSizeFt) || 100));
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

function pointInRect(clientX, clientY, el) {
  if (!el) return false;
  return isInsideRect(clientX, clientY, el.getBoundingClientRect());
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
    const v = Math.max(1, Math.min(500, parseInt(sizeInput, 10) || 100));
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

        {mapImageUrl && !isUploading ? (
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
          min={1}
          max={500}
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

// ─── BattleMap ───────────────────────────────────────────────────────────────

export function BattleMap({
  gmUid,
  user,
  isPlayer = false,
  activeElements = [],
  updateActiveElement,
  mapConfig,
  onMapConfigChange,
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
}) {
  const scrollWrapperRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const leftTrayRef = useRef(null);
  const rightTrayRef = useRef(null);
  const dragRef = useRef(null);
  const fileInputRef = useRef(null);

  /** Start at 0 so zoom bounds + renderedWidth match the flex layout before hydrating from localStorage (avoids stale 600×400 vs real wrapper size). */
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [dragGhost, setDragGhost] = useState(null); // { element, clientX, clientY, instanceNum, isMyCharacter }
  const [highlightLeftTray, setHighlightLeftTray] = useState(false);
  const [highlightRightTray, setHighlightRightTray] = useState(false);
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

  // Paste map image
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayer, mapConfig]);

  const handleImageFile = useCallback(async (file) => {
    setIsUploading(true);
    try {
      const { url, naturalWidth, naturalHeight } = await processImageFile(file);
      if (url) {
        onMapConfigChange({ mapImageUrl: url, mapImageNaturalWidth: naturalWidth, mapImageNaturalHeight: naturalHeight }, true);
      }
    } catch (err) {
      console.error('[BattleMap] image processing failed:', err);
    } finally {
      setIsUploading(false);
    }
  }, [onMapConfigChange]);

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

  const [mapZoom, setMapZoom] = useState(1);
  const mapZoomRef = useRef(1);
  mapZoomRef.current = mapZoom;
  const wheelZoomScrollRef = useRef(null);

  useLayoutEffect(() => {
    setMapZoom((z) => clampMapZoom(z, minZoom, maxZoom));
  }, [minZoom, maxZoom]);

  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const panParams = {
      mapZoom,
      renderedWidthPx,
      renderedHeightPx,
      viewportW: vw,
      viewportH: vh,
    };

    const wheel = wheelZoomScrollRef.current;
    if (wheel) {
      wheelZoomScrollRef.current = null;
      const c = clampPanScroll(wheel.scrollLeft, wheel.scrollTop, panParams);
      el.scrollLeft = c.scrollLeft;
      el.scrollTop = c.scrollTop;
      return;
    }

    const clamped = clampPanScroll(el.scrollLeft, el.scrollTop, panParams);
    if (clamped.scrollLeft !== el.scrollLeft || clamped.scrollTop !== el.scrollTop) {
      el.scrollLeft = clamped.scrollLeft;
      el.scrollTop = clamped.scrollTop;
    }
  }, [mapZoom, containerWidth, containerHeight, renderedWidthPx, renderedHeightPx]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const wheel = (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      const oldZ = mapZoomRef.current;
      const factor = Math.exp(-e.deltaY * 0.002);
      const newZ = clampMapZoom(oldZ * factor, minZoom, maxZoom);
      if (newZ === oldZ) return;
      const rect = el.getBoundingClientRect();
      const viewportX = e.clientX - rect.left;
      const viewportY = e.clientY - rect.top;
      const { scrollLeft, scrollTop } = scrollAfterZoomTowardPoint({
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        viewportX,
        viewportY,
        oldZoom: oldZ,
        newZoom: newZ,
        innerWidthPx: renderedWidthPx,
        innerHeightPx: renderedHeightPx,
        viewportW: rect.width,
        viewportH: rect.height,
      });
      wheelZoomScrollRef.current = { scrollLeft, scrollTop };
      mapZoomRef.current = newZ;
      setMapZoom(newZ);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [minZoom, maxZoom, renderedWidthPx, renderedHeightPx]);

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

  // Tray: all characters — in-tray first, then dim proxies for those on map
  const charTrayTokens = useMemo(() => {
    const inTray = characters.filter(el => el.tokenX == null).map(el => ({ element: el, instanceNum: null, isMyCharacter: isMyCharacter(el), isProxy: false }));
    const onMap = characters.filter(el => el.tokenX != null).map(el => ({ element: el, instanceNum: null, isMyCharacter: isMyCharacter(el), isProxy: true }));
    return [...inTray, ...onMap];
  }, [characters, isMyCharacter]);

  // Players don't see adversary tray. All adversaries — in-tray first, then dim proxies for those on map.
  const advTrayTokens = useMemo(() => {
    if (isPlayer) return [];
    const inTray = adversaries.filter(el => el.tokenX == null).map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false, isProxy: false }));
    const onMap = adversaries.filter(el => el.tokenX != null).map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false, isProxy: true }));
    return [...inTray, ...onMap];
  }, [isPlayer, adversaries, instanceNumbers]);

  // Map tokens (placed)
  const charMapTokens = useMemo(() =>
    characters
      .filter(el => el.tokenX != null)
      .map(el => ({ element: el, instanceNum: null, isMyCharacter: isMyCharacter(el) })),
    [characters, isMyCharacter]);

  const advMapTokens = useMemo(() =>
    adversaries
      .filter(el => el.tokenX != null)
      .map(el => ({ element: el, instanceNum: instanceNumbers[el.instanceId], isMyCharacter: false })),
    [adversaries, instanceNumbers]);

  // All placed tokens for snap detection and range band computation
  const allMapTokens = useMemo(() => [
    ...charMapTokens,
    ...advMapTokens,
  ], [charMapTokens, advMapTokens]);

  // Convert client coordinates to map feet, accounting for scroll and display zoom
  const clientToFt = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const mapX = (clientX - rect.left + container.scrollLeft) / mapZoom;
    const mapY = (clientY - rect.top + container.scrollTop) / mapZoom;
    return { x: mapX / pxPerFt, y: mapY / pxPerFt };
  }, [pxPerFt, mapZoom]);

  // Find a placed token whose bounding box contains the given client point
  const findTokenAtClient = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const mapX = (clientX - rect.left + container.scrollLeft) / mapZoom;
    const mapY = (clientY - rect.top + container.scrollTop) / mapZoom;
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
  }, [allMapTokens, pxPerFt, tokenSizePx, mapZoom]);

  // Handle pointer move over the map canvas area (not trays)
  const handleMapPointerMove = useCallback((e) => {
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
        const tokenClientX = element.tokenX * pxPerFt * mapZoom - container.scrollLeft + rect.left;
        const tokenClientY = element.tokenY * pxPerFt * mapZoom - container.scrollTop + rect.top;
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
  }, [canDrag, instanceNumbers, isMyCharacter, trayTokenSizePx, tokenSizePx, pxPerFt, mapZoom]);

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
        updateActiveElement(ds.instanceId, { tokenX: null, tokenY: null });
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
        const postMove = activeElements.map((el) =>
          el.instanceId === ds.instanceId ? { ...el, tokenX: null, tokenY: null } : el
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
        (e.clientX - rect.left + container.scrollLeft) / mapZoom - (ds.grabOffsetX ?? ds.tokenSize / 2);
      const mapY =
        (e.clientY - rect.top + container.scrollTop) / mapZoom - (ds.grabOffsetY ?? ds.tokenSize / 2);
      const ftX = mapX / pxPerFt;
      const ftY = mapY / pxPerFt;

      if (ftX >= 0 && ftX <= mapWidthFt && ftY >= 0 && ftY <= mapHeightFt) {
        const clampedX = Math.max(0, Math.min(mapWidthFt - 5, ftX));
        const clampedY = Math.max(0, Math.min(mapHeightFt - 5, ftY));
        updateActiveElement(ds.instanceId, { tokenX: clampedX, tokenY: clampedY });
        const postMove = activeElements.map((el) =>
          el.instanceId === ds.instanceId ? { ...el, tokenX: clampedX, tokenY: clampedY } : el
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
        updateActiveElement(ds.instanceId, { tokenX: null, tokenY: null });
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
        onTokenDragEnd?.({
          instanceId: ds.instanceId,
          previousTokenFt: ds.prevTokenFt,
          nextTokenFt: null,
          fromTray: false,
        });
      }
    }
  }, [isPlayer, pxPerFt, mapWidthFt, mapHeightFt, mapZoom, updateActiveElement, pinnedToken, activeElements, onTokenDragEnd]);

  // Dismiss detail panel when clicking outside
  const handleMapClick = useCallback((e) => {
    // Only dismiss if clicking directly on the map/scroll container (not a token)
    if (e.target === scrollContainerRef.current || e.target === e.currentTarget) {
      setPinnedToken(null);
    }
  }, []);

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
      // Rescale all placed tokens proportionally
      const scaledElements = activeElements
        .filter(el => el.tokenX != null)
        .map(el => ({ instanceId: el.instanceId, tokenX: el.tokenX * scale, tokenY: el.tokenY * scale }));
      scaledElements.forEach(({ instanceId, tokenX, tokenY }) => updateActiveElement(instanceId, { tokenX, tokenY }));
    }
    onMapConfigChange(patch, resetTokenPositions);
  }, [activeElements, updateActiveElement, onMapConfigChange]);

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

        {/* Scroll container wrapper (we measure its width) */}
        <div ref={scrollWrapperRef} className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {/* Scrollable map container */}
          <div
            ref={scrollContainerRef}
            className="w-full h-full overflow-auto"
            onClick={handleMapClick}
          >
            {/* Outer establishes scroll size; inner is game px with CSS scale (display-only zoom). */}
            <div
              className="relative shrink-0"
              style={{
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
                      <Map size={32} className="mx-auto mb-2 opacity-50" />
                      <div>Upload a map image or drag tokens here</div>
                    </div>
                  )}
                  {isPlayer && charMapTokens.length === 0 && advMapTokens.length === 0 && (
                    <div className="text-dh-muted text-sm text-center pointer-events-none">
                      <Map size={32} className="mx-auto mb-2 opacity-50" />
                      <div>No map loaded</div>
                    </div>
                  )}
                </div>
              )}

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
    </div>
  );
}
