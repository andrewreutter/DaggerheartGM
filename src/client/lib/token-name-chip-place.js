/**
 * Place a compact name chip next to a hovered map token, preferring sides
 * that do not sit on other tokens, the altitude HUD, or distance labels.
 */

import {
  ALTITUDE_CONTROL_WIDTH_PX,
  altitudeControlExpandLeftPx,
  altitudeStemOffsetPx,
} from './token-altitude.js';
import { formatRangeDistanceFt, pointNearSegmentTarget } from './map-range.js';

export const TOKEN_NAME_CHIP_GAP_PX = 3;
export const TOKEN_NAME_CHIP_HEIGHT_PX = 11;
export const TOKEN_NAME_CHIP_PAD_X_PX = 5;
export const TOKEN_NAME_CHIP_CHAR_W_PX = 4.1;
const TOKEN_NAME_CHIP_MIN_WIDTH_PX = 19;

/** Preference order: keep off the left (altitude control) unless every other side is blocked. */
export const TOKEN_NAME_CHIP_SIDE_ORDER = [
  'right',
  'top',
  'bottom',
  'top-right',
  'bottom-right',
  'top-left',
  'bottom-left',
  'left',
];

/**
 * @param {string|null|undefined} name
 * @returns {{ width: number, height: number }}
 */
export function estimateTokenNameChipSize(name) {
  const text = name != null && String(name).trim() ? String(name).trim() : 'Token';
  return {
    width: Math.ceil(Math.max(TOKEN_NAME_CHIP_MIN_WIDTH_PX, text.length * TOKEN_NAME_CHIP_CHAR_W_PX + TOKEN_NAME_CHIP_PAD_X_PX)),
    height: TOKEN_NAME_CHIP_HEIGHT_PX,
  };
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 */
export function rectsOverlapArea(a, b) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (denom === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/**
 * True when the segment from (x1,y1) to (x2,y2) clips `rect`.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {{ x: number, y: number, w: number, h: number }} rect
 */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  if (!rect) return false;
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;
  const { x, y, w, h } = rect;
  return (
    segmentsIntersect(x1, y1, x2, y2, x, y, x + w, y)
    || segmentsIntersect(x1, y1, x2, y2, x + w, y, x + w, y + h)
    || segmentsIntersect(x1, y1, x2, y2, x + w, y + h, x, y + h)
    || segmentsIntersect(x1, y1, x2, y2, x, y + h, x, y)
  );
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} tokenRect
 * @param {{ width: number, height: number }} chipSize
 * @param {number} [gap]
 */
export function tokenNameChipCandidates(tokenRect, chipSize, gap = TOKEN_NAME_CHIP_GAP_PX) {
  const { x, y, w, h } = tokenRect;
  const cw = chipSize.width;
  const ch = chipSize.height;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const bySide = {
    right: { x: x + w + gap, y: cy - ch / 2 },
    top: { x: cx - cw / 2, y: y - ch - gap },
    bottom: { x: cx - cw / 2, y: y + h + gap },
    'top-right': { x: x + w + gap, y: y - ch - gap },
    'bottom-right': { x: x + w + gap, y: y + h + gap },
    'top-left': { x: x - cw - gap, y: y - ch - gap },
    'bottom-left': { x: x - cw - gap, y: y + h + gap },
    left: { x: x - cw - gap, y: cy - ch / 2 },
  };
  return TOKEN_NAME_CHIP_SIDE_ORDER.map((side) => ({
    side,
    ...bySide[side],
    w: cw,
    h: ch,
  }));
}

/**
 * @param {{ x: number, y: number, w: number, h: number }} candidate
 * @param {Array<{ x: number, y: number, w: number, h: number }>} obstacles
 * @param {{ x: number, y: number, w: number, h: number }|null} [mapBounds]
 * @param {Array<{ x1: number, y1: number, x2: number, y2: number }>} [segments]
 */
export function scoreTokenNameChipCandidate(candidate, obstacles = [], mapBounds = null, segments = []) {
  let score = 0;
  for (const o of obstacles) score += rectsOverlapArea(candidate, o);
  if (mapBounds) {
    if (candidate.x < mapBounds.x) score += (mapBounds.x - candidate.x) * 2;
    if (candidate.y < mapBounds.y) score += (mapBounds.y - candidate.y) * 2;
    const right = candidate.x + candidate.w;
    const bottom = candidate.y + candidate.h;
    if (right > mapBounds.x + mapBounds.w) score += (right - (mapBounds.x + mapBounds.w)) * 2;
    if (bottom > mapBounds.y + mapBounds.h) score += (bottom - (mapBounds.y + mapBounds.h)) * 2;
  }
  const area = candidate.w * candidate.h;
  for (const seg of segments) {
    if (segmentHitsRect(seg.x1, seg.y1, seg.x2, seg.y2, candidate)) {
      score += area * 0.5;
    }
  }
  return score;
}

/**
 * @param {{
 *   tokenRect: { x: number, y: number, w: number, h: number },
 *   name: string,
 *   obstacles?: Array<{ x: number, y: number, w: number, h: number }>,
 *   mapBounds?: { x: number, y: number, w: number, h: number }|null,
 *   segments?: Array<{ x1: number, y1: number, x2: number, y2: number }>,
 * }} opts
 * @returns {{ x: number, y: number, w: number, h: number, side: string }}
 */
export function placeTokenNameChip({
  tokenRect,
  name,
  obstacles = [],
  mapBounds = null,
  segments = [],
} = {}) {
  const size = estimateTokenNameChipSize(name);
  const candidates = tokenNameChipCandidates(tokenRect, size);
  let best = candidates[0];
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = scoreTokenNameChipCandidate(c, obstacles, mapBounds, segments);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { x: best.x, y: best.y, w: best.w, h: best.h, side: best.side };
}

function connectorLabelRect(connector, pxPerFt, originRadiusPx) {
  const x1 = connector.x1 * pxPerFt;
  const y1 = connector.y1 * pxPerFt;
  const x2 = connector.x2 * pxPerFt;
  const y2 = connector.y2 * pxPerFt;
  const label = formatRangeDistanceFt(connector.distanceFt);
  const fontSize = 10;
  const padX = 4;
  const padY = 2.5;
  const textW = Math.max(18, label.length * 6.1);
  const w = textW + padX * 2;
  const h = fontSize + padY * 2;
  const targetRadiusPx = Math.max(connector.targetHalfWidthFt ?? 0, connector.targetHalfLengthFt ?? 0) * pxPerFt;
  const { x: mx, y: my } = pointNearSegmentTarget(x1, y1, x2, y2, {
    originRadiusPx,
    targetRadiusPx,
    labelHalfW: w / 2,
    labelHalfH: h / 2,
  });
  return {
    x: mx - w / 2,
    y: my - h / 2,
    w,
    h,
    kind: 'distance-label',
  };
}

/**
 * Build obstacle rects + connector segments for `placeTokenNameChip`.
 * @param {{
 *   hoveredInstanceId: string,
 *   tokens: Array<{ element: object, widthPx: number, heightPx: number }>,
 *   pxPerFt: number,
 *   connectors?: object[],
 *   hoverFocused?: boolean,
 * }} opts
 */
export function collectTokenNameChipObstacles({
  hoveredInstanceId,
  tokens = [],
  pxPerFt,
  connectors = [],
  hoverFocused = true,
} = {}) {
  const obstacles = [];
  const segments = [];
  const scale = Number(pxPerFt);
  if (!(scale > 0)) return { obstacles, segments };

  let originRadiusPx = 0;
  for (const row of tokens) {
    const el = row?.element;
    if (!el || el.tokenX == null || el.tokenY == null) continue;
    const w = Number(row.widthPx) || 0;
    const h = Number(row.heightPx) || 0;
    const left = el.tokenX * scale;
    const top = el.tokenY * scale;
    const centerX = left + w / 2;
    const centerY = top + h / 2;
    if (el.instanceId === hoveredInstanceId) {
      originRadiusPx = Math.max(w, h) / 2;
    } else {
      obstacles.push({ x: left, y: top, w, h, kind: 'token' });
    }

    const alt = el.altitude ?? 0;
    if (alt !== 0) {
      const stem = altitudeStemOffsetPx(alt, scale);
      const tipY = centerY - stem;
      obstacles.push({
        x: centerX - 1,
        y: Math.min(centerY, tipY),
        w: 2,
        h: Math.abs(stem),
        kind: 'stem',
      });
      obstacles.push({
        x: centerX - 16,
        y: stem >= 0 ? tipY - 16 : tipY + 2,
        w: 32,
        h: 14,
        kind: 'altitude-tip',
      });
    }

    if (el.instanceId === hoveredInstanceId && hoverFocused) {
      obstacles.push({
        x: left - altitudeControlExpandLeftPx(),
        y: centerY - 14,
        w: ALTITUDE_CONTROL_WIDTH_PX,
        h: 28,
        kind: 'altitude-control',
      });
    }
  }

  for (const c of connectors) {
    if (!c) continue;
    obstacles.push(connectorLabelRect(c, scale, originRadiusPx));
    segments.push({
      x1: c.x1 * scale,
      y1: c.y1 * scale,
      x2: c.x2 * scale,
      y2: c.y2 * scale,
    });
  }

  return { obstacles, segments };
}
