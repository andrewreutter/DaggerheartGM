import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { Upload, X, Map, ArrowLeftToLine, Pencil } from 'lucide-react';
import { CheckboxTrack } from './DetailCardContent.jsx';
import { getAuthToken } from '../lib/api.js';

const MIN_PX_PER_FT = 33 / 5; // 6.6 px/ft — 5' token ≥ 33px touch target
const DRAG_THRESHOLD_PX = 8;

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

function MapConfigToolbar({ mapConfig, onMapConfigChange, isUploading, onFileSelect }) {
  const { mapDimension = 'width', mapSizeFt = 100, mapImageUrl } = mapConfig ?? {};
  const [sizeInput, setSizeInput] = useState(String(mapSizeFt));
  const fileInputRef = useRef(null);

  // Sync external changes (e.g. from SSE)
  useEffect(() => { setSizeInput(String(mapSizeFt)); }, [mapSizeFt]);

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

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs shrink-0 flex-wrap">
      <label
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors ${
          isUploading
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
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
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-300 transition-colors"
          title="Remove map image"
          onClick={() => onMapConfigChange({ mapImageUrl: null, mapImageNaturalWidth: null, mapImageNaturalHeight: null }, true)}
        >
          <X size={11} /> Remove
        </button>
      )}

      <div className="w-px h-4 bg-slate-700" />

      <span className="text-slate-500">Size:</span>
      <div className="flex items-center gap-1">
        <button
          className={`px-1.5 py-0.5 rounded text-xs transition-colors ${mapDimension === 'width' ? 'bg-sky-700 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
          onClick={() => onMapConfigChange({ mapDimension: 'width' })}
        >W</button>
        <button
          className={`px-1.5 py-0.5 rounded text-xs transition-colors ${mapDimension === 'height' ? 'bg-sky-700 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
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
        className="w-14 px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs text-right focus:outline-none focus:border-sky-500"
      />
      <span className="text-slate-500">ft</span>

      <span className="ml-auto text-slate-600 italic">
        {(() => {
          const { mapWidthFt, mapHeightFt } = getMapDimensions(mapConfig);
          return `${Math.round(mapWidthFt)}' × ${Math.round(mapHeightFt)}'`;
        })()}
      </span>
    </div>
  );
}

// ─── TokenCircle ─────────────────────────────────────────────────────────────

function TokenCircle({ element, size, instanceNum, isMyCharacter, isPlayer, isDragging, isGhost, isPinned, isProxy, rangeBand, rangeBandGlowScale }) {
  const isChar = element.elementType === 'character';
  const isAdv = element.elementType === 'adversary';

  const label = tokenAbbrev(element.name);
  const instLabel = isAdv && instanceNum != null ? String(instanceNum) : null;

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

  const bgClass = isChar
    ? (isMyCharacter ? 'bg-green-700' : 'bg-sky-700')
    : 'bg-amber-800';

  return (
    <div
      className={`
        relative rounded-full flex items-center justify-center select-none cursor-grab active:cursor-grabbing
        border-2 border-black transition-opacity
        ${bgClass}
        ${isDragging ? 'opacity-30' : ''}
        ${isGhost ? 'opacity-90 pointer-events-none' : ''}
        ${isProxy ? 'opacity-20' : ''}
        ${isPinned ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}
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
      <span className="text-white font-bold leading-none" style={{ fontSize: Math.max(10, Math.round(size * 0.35)) }}>
        {label}
      </span>
      {instLabel && (
        <span
          className="absolute bottom-0 right-0 bg-slate-900 text-white rounded-full font-bold leading-none flex items-center justify-center"
          style={{ fontSize: Math.max(8, Math.round(size * 0.26)), width: Math.max(14, Math.round(size * 0.4)), height: Math.max(14, Math.round(size * 0.4)), transform: 'translate(25%, 25%)' }}
        >
          {instLabel}
        </span>
      )}
    </div>
  );
}

// ─── TokenDetailPanel ────────────────────────────────────────────────────────

function TokenDetailPanel({ element, isPlayer, isMyCharacter, updateActiveElement, onRemoveFromMap, onClose, anchorX, anchorY }) {
  const isChar = element.elementType === 'character';
  const isAdv = element.elementType === 'adversary';
  const canEdit = !isPlayer || isMyCharacter;
  const canEditAdv = !isPlayer; // only GM edits adversaries

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
      className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 min-w-[180px] max-w-[240px]"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{element.name}</div>
          {isChar && element.playerName && (
            <div className="text-xs text-slate-400 truncate">{element.playerName}</div>
          )}
          {isAdv && (
            <div className="text-xs text-slate-400 capitalize">{element.role || ''} {element.tier ? `T${element.tier}` : ''}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onRemoveFromMap && (
            <button
              onClick={onRemoveFromMap}
              className="p-1 rounded text-slate-500 hover:text-amber-400 transition-colors"
              title="Remove from map (return to tray)"
            >
              <ArrowLeftToLine size={13} />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* HP — filled = damage taken (matches sidebar & token dots) */}
      {hpMax > 0 && (
        <div className="mb-1.5">
          <div className="text-xs text-slate-500 mb-0.5">HP {element.currentHp ?? hpMax}/{hpMax}</div>
          <CheckboxTrack
            total={hpMax}
            filled={Math.max(0, hpMax - (element.currentHp ?? hpMax))}
            fillColor="bg-red-500"
            onSetFilled={canEdit || canEditAdv
              ? (dmg) => updateActiveElement(element.instanceId, { currentHp: hpMax - dmg })
              : undefined}
          />
        </div>
      )}

      {/* Stress */}
      {stressMax > 0 && (
        <div className="mb-1.5">
          <div className="text-xs text-slate-500 mb-0.5">Stress {element.currentStress ?? 0}/{stressMax}</div>
          <CheckboxTrack
            total={stressMax}
            filled={element.currentStress ?? 0}
            fillColor="bg-yellow-600"
            onSetFilled={canEdit || canEditAdv
              ? (v) => updateActiveElement(element.instanceId, { currentStress: v })
              : undefined}
          />
        </div>
      )}

      {/* Hope (characters only) */}
      {isChar && (element.maxHope ?? 6) > 0 && (
        <div className="mb-1.5">
          <div className="text-xs text-slate-500 mb-0.5">Hope {element.hope ?? (element.maxHope ?? 6)}/{element.maxHope ?? 6}</div>
          <CheckboxTrack
            total={element.maxHope ?? 6}
            filled={element.hope ?? (element.maxHope ?? 6)}
            fillColor="bg-amber-400"
            onSetFilled={canEdit ? (v) => updateActiveElement(element.instanceId, { hope: v }) : undefined}
          />
        </div>
      )}

      {/* Armor (Daggerstack characters) */}
      {isChar && (element.maxArmor ?? 0) > 0 && (
        <div className="mb-1.5">
          <div className="text-xs text-slate-500 mb-0.5">Armor {element.currentArmor ?? element.maxArmor ?? 0}/{element.maxArmor ?? 0}</div>
          <CheckboxTrack
            total={element.maxArmor ?? 0}
            filled={element.currentArmor ?? element.maxArmor ?? 0}
            fillColor="bg-cyan-600"
            onSetFilled={canEdit ? (v) => {
              const upd = { currentArmor: v };
              if (element.reinforcedActive && v < (element.currentArmor ?? element.maxArmor ?? 0)) upd.reinforcedActive = false;
              updateActiveElement(element.instanceId, upd);
            } : undefined}
          />
        </div>
      )}

      {/* Conditions */}
      {(canEdit || canEditAdv) && (
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Conditions</div>
          <input
            type="text"
            value={element.conditions ?? ''}
            onChange={e => updateActiveElement(element.instanceId, { conditions: e.target.value })}
            placeholder="none"
            className="w-full px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
          />
        </div>
      )}
      {/* Read-only conditions for player on enemy */}
      {isPlayer && isAdv && element.conditions && (
        <div>
          <div className="text-xs text-slate-500 mb-0.5">Conditions</div>
          <div className="text-xs text-slate-300">{element.conditions}</div>
        </div>
      )}
    </div>
  );
}

// ─── TrayColumn ──────────────────────────────────────────────────────────────

function TrayColumn({ tokens, side, isHighlighted, trayRef, tokenSizePx, dragRef, onPointerDown, onPointerMove, onPointerUp, pinnedInstanceId }) {
  if (tokens.length === 0) return null;

  const borderClass = side === 'left' ? 'border-r border-slate-800' : 'border-l border-slate-800';

  return (
    <div
      ref={trayRef}
      className={`flex flex-col items-center gap-2 py-3 px-1.5 shrink-0 overflow-y-auto
        transition-colors duration-150 ${borderClass}
        ${isHighlighted ? 'bg-amber-900/30' : 'bg-slate-900/60'}`}
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

export function BattleMap({ gmUid, user, isPlayer = false, activeElements = [], updateActiveElement, mapConfig, onMapConfigChange, className = '' }) {
  const scrollWrapperRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const leftTrayRef = useRef(null);
  const rightTrayRef = useRef(null);
  const dragRef = useRef(null);
  const fileInputRef = useRef(null);

  const [containerWidth, setContainerWidth] = useState(600);
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

  // Track scroll container width for pxPerFt calculation
  useLayoutEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w > 0) setContainerWidth(w);
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
  const trayTokenSizePx = 36; // fixed size for tray tokens

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
    if (!isPlayer) return true; // GM can drag anything
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

  // Convert client coordinates to map feet, accounting for scroll
  const clientToFt = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const mapX = clientX - rect.left + container.scrollLeft;
    const mapY = clientY - rect.top + container.scrollTop;
    return { x: mapX / pxPerFt, y: mapY / pxPerFt };
  }, [pxPerFt]);

  // Find a placed token whose bounding box contains the given client point
  const findTokenAtClient = useCallback((clientX, clientY) => {
    const container = scrollContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const mapX = clientX - rect.left + container.scrollLeft;
    const mapY = clientY - rect.top + container.scrollTop;
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
  }, [allMapTokens, pxPerFt, tokenSizePx]);

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
      // Use nearest-edge distance: subtract token radius so any overlap with a band counts
      const dist = Math.max(0, Math.sqrt(dx * dx + dy * dy) - 2.5);
      const bandIdx = RANGE_BANDS.findIndex(b => dist <= b.maxFt);
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
    const bandIdx = RANGE_BANDS.findIndex(b => dist <= b.maxFt);
    return bandIdx >= 0 ? RANGE_BANDS[bandIdx] : null;
  }, [bullseyeFt, followBullseyeFt]);

  // ─── Drag handlers ──────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e, element, fromTray) => {
    if (!canDrag(element)) return;
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
        const tokenClientX = element.tokenX * pxPerFt - container.scrollLeft + rect.left;
        const tokenClientY = element.tokenY * pxPerFt - container.scrollTop + rect.top;
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
    };
  }, [canDrag, instanceNumbers, isMyCharacter, trayTokenSizePx, tokenSizePx, pxPerFt]);

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
      setDragGhost({ element: ds.element, clientX: e.clientX, clientY: e.clientY, instanceNum: ds.instanceNum, isMyChar: ds.myChar, tokenSize: ds.tokenSize, grabOffsetX: ds.grabOffsetX, grabOffsetY: ds.grabOffsetY });
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
      }
      return;
    }

    // Dropped on map?
    const container = scrollContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      // Subtract grab offset so the token's top-left lands where the ghost was,
      // not where the raw cursor was.
      const mapX = e.clientX - rect.left + container.scrollLeft - (ds.grabOffsetX ?? ds.tokenSize / 2);
      const mapY = e.clientY - rect.top + container.scrollTop - (ds.grabOffsetY ?? ds.tokenSize / 2);
      const ftX = mapX / pxPerFt;
      const ftY = mapY / pxPerFt;

      if (ftX >= 0 && ftX <= mapWidthFt && ftY >= 0 && ftY <= mapHeightFt) {
        const clampedX = Math.max(0, Math.min(mapWidthFt - 5, ftX));
        const clampedY = Math.max(0, Math.min(mapHeightFt - 5, ftY));
        updateActiveElement(ds.instanceId, { tokenX: clampedX, tokenY: clampedY });
      } else if (!ds.fromTray) {
        // Dropped outside map and trays while dragging from map: return to tray
        updateActiveElement(ds.instanceId, { tokenX: null, tokenY: null });
        if (pinnedToken?.element.instanceId === ds.instanceId) setPinnedToken(null);
      }
    }
  }, [isPlayer, pxPerFt, mapWidthFt, mapHeightFt, updateActiveElement, pinnedToken]);

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

  const showLeftTray = characters.length > 0;
  const showRightTray = !isPlayer && adversaries.length > 0;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Toolbar — GM only */}
      {!isPlayer && (
        <MapConfigToolbar
          mapConfig={mapConfig}
          onMapConfigChange={handleMapConfigChange}
          isUploading={isUploading}
          onFileSelect={handleImageFile}
        />
      )}

      {/* Map area */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left tray — characters without position */}
        {showLeftTray && (
          <TrayColumn
            tokens={charTrayTokens}
            side="left"
            isHighlighted={highlightLeftTray}
            trayRef={leftTrayRef}
            tokenSizePx={trayTokenSizePx}
            dragRef={dragRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            pinnedInstanceId={pinnedToken?.element.instanceId}
          />
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
            {/* Map content at computed pixel size */}
            <div
              className="relative shrink-0"
              style={{ width: renderedWidthPx, height: renderedHeightPx }}
              onPointerMove={handleMapPointerMove}
              onPointerLeave={handleMapPointerLeave}
            >
              {/* Map image or blank area */}
              {mapConfig?.mapImageUrl ? (
                <img
                  src={mapConfig.mapImageUrl}
                  alt="Battle map"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
                  draggable={false}
                />
              ) : (
                <div
                  className="absolute inset-0 bg-slate-900 flex items-center justify-center"
                  style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)' }}
                >
                  {!isPlayer && charTrayTokens.length === 0 && advTrayTokens.length === 0 && charMapTokens.length === 0 && advMapTokens.length === 0 && (
                    <div className="text-slate-700 text-sm text-center pointer-events-none">
                      <Map size={32} className="mx-auto mb-2 opacity-40" />
                      <div>Upload a battle map or drag tokens onto the canvas</div>
                    </div>
                  )}
                  {isPlayer && charMapTokens.length === 0 && advMapTokens.length === 0 && (
                    <div className="text-slate-700 text-sm text-center pointer-events-none">
                      <Map size={32} className="mx-auto mb-2 opacity-40" />
                      <div>No map yet</div>
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

              {/* Placed character tokens */}
              {charMapTokens.map(({ element, isMyCharacter: myChar }) => {
                const bandIdx = tokenRangeBands[element.instanceId];
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                return (
                <div
                  key={element.instanceId}
                  className="absolute"
                  style={{
                    left: element.tokenX * pxPerFt,
                    top: element.tokenY * pxPerFt,
                    width: tokenSizePx,
                    height: tokenSizePx,
                    touchAction: 'none',
                    zIndex: 10,
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

              {/* Placed adversary tokens */}
              {advMapTokens.map(({ element, instanceNum }) => {
                const bandIdx = tokenRangeBands[element.instanceId];
                const rangeBand = (bandIdx != null && bandIdx >= 0) ? RANGE_BANDS[bandIdx] : null;
                return (
                <div
                  key={element.instanceId}
                  className="absolute"
                  style={{
                    left: element.tokenX * pxPerFt,
                    top: element.tokenY * pxPerFt,
                    width: tokenSizePx,
                    height: tokenSizePx,
                    touchAction: 'none',
                    zIndex: 10,
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
              size={dragGhost.tokenSize ?? trayTokenSizePx}
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
