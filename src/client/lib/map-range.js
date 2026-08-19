import { effectiveTokenMapId } from './map-table-state.js';
import { getTokenFootprintFt } from './token-size.js';
import {
  characterCountFromElements,
  isAdversaryPresentForParty,
} from './party-scaled-adversaries.js';

export { getTokenFootprintFt };

/**
 * Parallel maps: tokens on different `mapId` planes do not measure range to each other.
 */
function sameTokenMapPlane(a, b) {
  return effectiveTokenMapId(a?.mapId) === effectiveTokenMapId(b?.mapId);
}

/**
 * Map range utilities for game mechanics that depend on token positions.
 *
 * Range bands (in feet) and highlight colors live on RANGE_BANDS_ORDERED.
 * Distance uses nearest-edge logic: center-to-center distance minus one
 * token radius (2.5'), so any overlap with a band boundary counts.
 */

/** Maximum feet for each Daggerheart range band. */
export const RANGE_BANDS_FT = {
  MELEE:      5,
  VERY_CLOSE: 10,
  CLOSE:      30,
  FAR:        100,
  VERY_FAR:   300,
};

export const FAR_RANGE_FT = RANGE_BANDS_FT.FAR;
export const CLOSE_RANGE_FT = RANGE_BANDS_FT.CLOSE;

/** Daggerheart range band display names (case-insensitive) to max feet. */
const RANGE_BAND_NAME_TO_FT = {
  melee: RANGE_BANDS_FT.MELEE,
  'very close': RANGE_BANDS_FT.VERY_CLOSE,
  close: RANGE_BANDS_FT.CLOSE,
  far: RANGE_BANDS_FT.FAR,
  'very far': RANGE_BANDS_FT.VERY_FAR,
};

/**
 * Map a range band name (e.g. "Melee", "Far") to max distance in feet.
 * Case-insensitive; returns undefined for unknown or empty input.
 *
 * @param {string} rangeName - e.g. "Melee", "Very Close", "Close", "Far", "Very Far"
 * @returns {number | undefined}
 */
export function rangeBandNameToFt(rangeName) {
  if (rangeName == null || typeof rangeName !== 'string') return undefined;
  const key = rangeName.trim().toLowerCase();
  return key ? RANGE_BAND_NAME_TO_FT[key] : undefined;
}

/** Display label for each standard range band (feet → label). */
const RANGE_FT_TO_LABEL = {
  [RANGE_BANDS_FT.MELEE]: 'Melee',
  [RANGE_BANDS_FT.VERY_CLOSE]: 'Very Close',
  [RANGE_BANDS_FT.CLOSE]: 'Close',
  [RANGE_BANDS_FT.FAR]: 'Far',
  [RANGE_BANDS_FT.VERY_FAR]: 'Very Far',
};

/**
 * Format a max range in feet as a display label for UI (e.g. "Apply within Melee").
 * Standard Daggerheart bands use band names; other values use "X ft".
 *
 * @param {number} maxFt - max distance in feet (e.g. from _weaponRangeFt)
 * @returns {string} e.g. "Melee", "Close", "30 ft"
 */
export function rangeFtToLabel(maxFt) {
  if (maxFt == null || typeof maxFt !== 'number') return '';
  return RANGE_FT_TO_LABEL[maxFt] ?? `${maxFt} ft`;
}

/**
 * Token center in feet given the token's top-left position.
 * Daggerheart tokens occupy a 5×5' square; their center is +2.5' from origin.
 */
const TOKEN_HALF_FT = 2.5;

/** Default token footprint (standard 5×5' token, size multiplier 1×1). */
export const DEFAULT_TOKEN_FOOTPRINT_FT = { halfWidth: TOKEN_HALF_FT, halfLength: TOKEN_HALF_FT };

/**
 * Radius (feet) of an axis-aligned ellipse with half-extents `halfWidth`/`halfLength`
 * along the direction `angleRad`. For `halfWidth === halfLength` this is constant
 * (a circle) regardless of angle — reproducing the old flat-radius behavior exactly.
 *
 * @param {number} halfWidth - half-extent along the X axis (feet)
 * @param {number} halfLength - half-extent along the Y axis (feet)
 * @param {number} angleRad - direction of travel (radians); symmetric under +π
 * @returns {number}
 */
export function ellipseRadiusAtAngle(halfWidth, halfLength, angleRad) {
  const hw = Math.max(1e-6, Number(halfWidth) || 0);
  const hl = Math.max(1e-6, Number(halfLength) || 0);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const denom = Math.sqrt((cos * cos) / (hw * hw) + (sin * sin) / (hl * hl));
  return denom > 0 ? 1 / denom : Math.max(hw, hl);
}

/**
 * Combine a planar (horizontal) nearest-edge distance with a vertical altitude delta via
 * Pythagoras. Equal altitudes return `horizontalDist` unchanged (byte-identical to 2D).
 *
 * @param {number} horizontalDist - planar nearest-edge distance in feet (≥ 0)
 * @param {number} [aAltitudeFt=0]
 * @param {number} [bAltitudeFt=0]
 * @returns {number}
 */
export function combinePlanarDistanceWithAltitude(horizontalDist, aAltitudeFt = 0, bAltitudeFt = 0) {
  const dAlt = (Number(bAltitudeFt) || 0) - (Number(aAltitudeFt) || 0);
  if (dAlt === 0) return horizontalDist;
  return Math.sqrt(horizontalDist * horizontalDist + dAlt * dAlt);
}

/**
 * Point-to-token nearest-edge + sphere distance used by BattleMap bullseye highlighting.
 *
 * Subtracts only the token's directional ellipse radius toward the point (the point has
 * zero radius — unlike `tokenDistanceFt`, which averages both tokens' reaches). Equal
 * altitudes return the planar result unchanged.
 *
 * `tokenCx`/`tokenCy` are the token's center in feet (not top-left).
 *
 * @param {number} px
 * @param {number} py
 * @param {number} [pAltitudeFt=0]
 * @param {number} tokenCx
 * @param {number} tokenCy
 * @param {{halfWidth:number,halfLength:number}} [footprint]
 * @param {number} [tokenAltitudeFt=0]
 * @returns {number} nearest-edge distance in feet (≥ 0)
 */
export function pointToTokenCenterDistanceFt(
  px, py, pAltitudeFt = 0,
  tokenCx, tokenCy,
  footprint = DEFAULT_TOKEN_FOOTPRINT_FT,
  tokenAltitudeFt = 0,
) {
  const fp = footprint || DEFAULT_TOKEN_FOOTPRINT_FT;
  const dx = tokenCx - px;
  const dy = tokenCy - py;
  const centerDist = Math.sqrt(dx * dx + dy * dy);
  const reach = centerDist < 1e-9
    ? (fp.halfWidth + fp.halfLength) / 2
    : ellipseRadiusAtAngle(fp.halfWidth, fp.halfLength, Math.atan2(dy, dx));
  const dist = Math.max(0, centerDist - reach);
  return combinePlanarDistanceWithAltitude(dist, pAltitudeFt, tokenAltitudeFt);
}

/**
 * Point-to-token nearest-edge + sphere distance from a point to a token's top-left + footprint.
 * Same formula as BattleMap range-band highlighting.
 *
 * @param {number} px
 * @param {number} py
 * @param {number} [pAltitudeFt=0]
 * @param {number} tokenX - token top-left X (feet)
 * @param {number} tokenY - token top-left Y (feet)
 * @param {{halfWidth:number,halfLength:number}} [footprint]
 * @param {number} [tokenAltitudeFt=0]
 * @returns {number}
 */
export function pointToTokenDistanceFt(
  px, py, pAltitudeFt = 0,
  tokenX, tokenY,
  footprint = DEFAULT_TOKEN_FOOTPRINT_FT,
  tokenAltitudeFt = 0,
) {
  const fp = footprint || DEFAULT_TOKEN_FOOTPRINT_FT;
  return pointToTokenCenterDistanceFt(
    px, py, pAltitudeFt,
    tokenX + fp.halfWidth, tokenY + fp.halfLength,
    fp, tokenAltitudeFt,
  );
}

/**
 * Format a range/sphere distance in feet for the bullseye HUD (`"60'"`, `"97.5'"`).
 * Rounds to one decimal; strips a trailing `.0`.
 *
 * @param {number} ft
 * @returns {string}
 */
export function formatRangeDistanceFt(ft) {
  const n = Number(ft);
  if (!Number.isFinite(n) || n < 0) return "0'";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}'`;
}

/** Default pixel inset from the target token when placing a bullseye distance label. */
export const BULLSEYE_CONNECTOR_LABEL_INSET_PX = 28;

function normalizeSegmentLabelOpts(insetOrOpts) {
  const defaults = {
    insetPx: BULLSEYE_CONNECTOR_LABEL_INSET_PX,
    originRadiusPx: 0,
    targetRadiusPx: 0,
    labelHalfW: 0,
    labelHalfH: 0,
  };
  if (insetOrOpts && typeof insetOrOpts === 'object') {
    const n = (v) => {
      const x = Number(v);
      return Number.isFinite(x) && x > 0 ? x : 0;
    };
    return {
      insetPx: n(insetOrOpts.insetPx) || defaults.insetPx,
      originRadiusPx: n(insetOrOpts.originRadiusPx),
      targetRadiusPx: n(insetOrOpts.targetRadiusPx),
      labelHalfW: n(insetOrOpts.labelHalfW),
      labelHalfH: n(insetOrOpts.labelHalfH),
    };
  }
  const requested = Number(insetOrOpts);
  return {
    ...defaults,
    insetPx: Number.isFinite(requested) && requested > 0 ? requested : defaults.insetPx,
  };
}

function labelOverlapsOrigin(x, y, x1, y1, originRadiusPx, labelHalfW, labelHalfH) {
  const dist = Math.hypot(x - x1, y - y1);
  const labelReach = Math.hypot(labelHalfW, labelHalfH);
  return dist < originRadiusPx + labelReach;
}

/**
 * Place a label along the segment from `(x1,y1)` (bullseye token) toward `(x2,y2)`
 * (the other token), close to the other token rather than at the midpoint.
 *
 * Default: inset from the target back toward the origin. If that would sit on/behind
 * the bullseye token, place the label on the far side of the other token instead.
 *
 * `insetOrOpts` may be a number (`insetPx`) or `{ insetPx, originRadiusPx, targetRadiusPx, labelHalfW, labelHalfH }`.
 *
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number|{ insetPx?: number, originRadiusPx?: number, targetRadiusPx?: number, labelHalfW?: number, labelHalfH?: number }} [insetOrOpts]
 * @returns {{ x: number, y: number }}
 */
export function pointNearSegmentTarget(x1, y1, x2, y2, insetOrOpts = BULLSEYE_CONNECTOR_LABEL_INSET_PX) {
  const { insetPx, originRadiusPx, targetRadiusPx, labelHalfW, labelHalfH } = normalizeSegmentLabelOpts(insetOrOpts);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return { x: x2, y: y2 };
  const nearInset = Math.min(insetPx, len * 0.35);
  const near = {
    x: x1 + dx * (1 - nearInset / len),
    y: y1 + dy * (1 - nearInset / len),
  };
  if (!labelOverlapsOrigin(near.x, near.y, x1, y1, originRadiusPx, labelHalfW, labelHalfH)) {
    return near;
  }
  const farInset = Math.max(insetPx, targetRadiusPx + 8);
  const ux = dx / len;
  const uy = dy / len;
  return { x: x2 + ux * farInset, y: y2 + uy * farInset };
}

/**
 * When the bullseye is snapped to a token, return dotted-line connectors to every other
 * placed token at a different altitude. Distance is `pointToTokenDistanceFt` — the same
 * measure used for range-band highlighting.
 *
 * @param {{ x: number, y: number, altitude?: number, excludeInstanceId?: string }|null|undefined} center
 * @param {Array<{ element: object }|object>} tokens
 * @param {(element: object) => { halfWidth: number, halfLength: number }} getFootprint
 * @returns {Array<{ instanceId: string, x1: number, y1: number, x2: number, y2: number, distanceFt: number, rangeBandIndex: number }>}
 */
export function collectBullseyeAltitudeConnectors(center, tokens, getFootprint) {
  if (!center || center.excludeInstanceId == null || !Array.isArray(tokens)) return [];
  const cAlt = center.altitude ?? 0;
  const out = [];
  for (const row of tokens) {
    const el = row?.element ?? row;
    if (!el || el.tokenX == null || el.tokenY == null) continue;
    if (el.instanceId === center.excludeInstanceId) continue;
    const tAlt = el.altitude ?? 0;
    if (tAlt === cAlt) continue;
    const footprint = getFootprint?.(el) || DEFAULT_TOKEN_FOOTPRINT_FT;
    const distanceFt = pointToTokenDistanceFt(
      center.x, center.y, cAlt,
      el.tokenX, el.tokenY, footprint, tAlt,
    );
    out.push({
      instanceId: el.instanceId,
      x1: center.x,
      y1: center.y,
      x2: el.tokenX + footprint.halfWidth,
      y2: el.tokenY + footprint.halfLength,
      targetHalfWidthFt: footprint.halfWidth,
      targetHalfLengthFt: footprint.halfLength,
      distanceFt,
      rangeBandIndex: getRangeBandIndexForDistanceFt(distanceFt),
    });
  }
  return out;
}

/**
 * Nearest-edge distance in feet between two placed tokens, accounting for each token's own
 * (possibly non-default) footprint. Game Table mechanics (`rangeFrom` / attack targeting) use
 * this token-to-token measure. BattleMap bullseye highlighting uses `pointToTokenDistanceFt`
 * (point has zero radius) — the two agree for default-sized tokens.
 *
 * Each token's "reach" toward the other is its own directional ellipse radius at the angle
 * between the two centers; the two reaches are **averaged** (not summed) so that two
 * default-sized (2.5'/2.5') tokens reproduce the original flat `-2.5'` subtraction exactly.
 *
 * Optional altitudes (feet, default 0) are combined with the planar result as a sphere:
 * `sqrt(horizontal² + Δaltitude²)`. When both altitudes are 0 the result is identical to 2D.
 *
 * @param {number} ax - Token A's tokenX (feet, top-left)
 * @param {number} ay - Token A's tokenY (feet, top-left)
 * @param {number} bx - Token B's tokenX (feet, top-left)
 * @param {number} by - Token B's tokenY (feet, top-left)
 * @param {{halfWidth:number,halfLength:number}} [aFootprint] - Token A's footprint (default: standard 5×5')
 * @param {{halfWidth:number,halfLength:number}} [bFootprint] - Token B's footprint (default: standard 5×5')
 * @param {number} [aAltitudeFt=0] - Token A's altitude in feet
 * @param {number} [bAltitudeFt=0] - Token B's altitude in feet
 * @returns {number} nearest-edge distance in feet (≥ 0)
 */
export function tokenDistanceFt(
  ax, ay, bx, by,
  aFootprint = DEFAULT_TOKEN_FOOTPRINT_FT,
  bFootprint = DEFAULT_TOKEN_FOOTPRINT_FT,
  aAltitudeFt = 0,
  bAltitudeFt = 0,
) {
  const acx = ax + aFootprint.halfWidth;
  const acy = ay + aFootprint.halfLength;
  const bcx = bx + bFootprint.halfWidth;
  const bcy = by + bFootprint.halfLength;
  const dx = acx - bcx;
  const dy = acy - bcy;
  const centerDist = Math.sqrt(dx * dx + dy * dy);
  let horizontal;
  if (centerDist < 1e-9) {
    const reach = ((aFootprint.halfWidth + aFootprint.halfLength) / 2 + (bFootprint.halfWidth + bFootprint.halfLength) / 2) / 2;
    horizontal = Math.max(0, centerDist - reach);
  } else {
    const angle = Math.atan2(dy, dx);
    const rA = ellipseRadiusAtAngle(aFootprint.halfWidth, aFootprint.halfLength, angle);
    const rB = ellipseRadiusAtAngle(bFootprint.halfWidth, bFootprint.halfLength, angle);
    const reach = (rA + rB) / 2;
    horizontal = Math.max(0, centerDist - reach);
  }
  return combinePlanarDistanceWithAltitude(horizontal, aAltitudeFt, bAltitudeFt);
}

/**
 * Convenience wrapper: extracts position + footprint (via `getTokenFootprintFt`) from two
 * elements and computes their nearest-edge distance in feet, including altitude
 * (`element.altitude ?? 0`).
 *
 * @param {object} a - element with tokenX/tokenY and optional tokenSizeWidth/tokenSizeLength
 * @param {object} b - element with tokenX/tokenY and optional tokenSizeWidth/tokenSizeLength
 * @returns {number} nearest-edge distance in feet (≥ 0)
 */
export function tokenDistanceFtForElements(a, b) {
  return tokenDistanceFt(
    a.tokenX, a.tokenY, b.tokenX, b.tokenY,
    getTokenFootprintFt(a), getTokenFootprintFt(b),
    a.altitude ?? 0, b.altitude ?? 0,
  );
}

/**
 * Token top-left position such that the token's center is at distance d feet from A's center,
 * along the ray from A toward B. Used for "knock to Far" (Concussive) and similar effects.
 *
 * @param {number} ax - Token A tokenX (top-left)
 * @param {number} ay - Token A tokenY (top-left)
 * @param {number} bx - Token B tokenX (top-left)
 * @param {number} by - Token B tokenY (top-left)
 * @param {number} d - Desired center-to-center distance in feet (e.g. RANGE_BANDS_FT.FAR for mid-Far)
 * @param {{halfWidth:number,halfLength:number}} [aFootprint] - Token A's footprint (default: standard 5×5')
 * @param {{halfWidth:number,halfLength:number}} [bFootprint] - Token B's footprint (default: standard 5×5'); used to convert the new center back to top-left
 * @returns {{ x: number, y: number }} Token top-left position for the new placement
 */
export function positionAtDistanceFt(
  ax, ay, bx, by, d,
  aFootprint = DEFAULT_TOKEN_FOOTPRINT_FT,
  bFootprint = DEFAULT_TOKEN_FOOTPRINT_FT,
) {
  const acx = ax + aFootprint.halfWidth;
  const acy = ay + aFootprint.halfLength;
  const bcx = bx + bFootprint.halfWidth;
  const bcy = by + bFootprint.halfLength;
  const dx = bcx - acx;
  const dy = bcy - acy;
  const L = Math.sqrt(dx * dx + dy * dy);
  let ux, uy;
  if (L < 1e-6) {
    ux = 1;
    uy = 0;
  } else {
    ux = dx / L;
    uy = dy / L;
  }
  const newCx = acx + d * ux;
  const newCy = acy + d * uy;
  return { x: newCx - bFootprint.halfWidth, y: newCy - bFootprint.halfLength };
}

/** Ordered range bands for distance → band logic and BattleMap token/connector highlight colors. */
export const RANGE_BANDS_ORDERED = [
  { name: 'Melee',      maxFt: RANGE_BANDS_FT.MELEE,      fillColor: 'rgba(34,197,94,0.14)',  ringColor: 'rgba(34,197,94,0.6)',   tokenGlow: 'rgba(34,197,94,0.85)',  tokenRing: 'rgba(34,197,94,0.95)'   },
  { name: 'Very Close', maxFt: RANGE_BANDS_FT.VERY_CLOSE, fillColor: 'rgba(56,189,248,0.11)', ringColor: 'rgba(56,189,248,0.5)',  tokenGlow: 'rgba(56,189,248,0.8)',  tokenRing: 'rgba(56,189,248,0.95)'  },
  { name: 'Close',      maxFt: RANGE_BANDS_FT.CLOSE,      fillColor: 'rgba(251,146,60,0.06)', ringColor: 'rgba(251,146,60,0.4)',  tokenGlow: 'rgba(251,146,60,0.7)',  tokenRing: 'rgba(251,146,60,0.95)'  },
  { name: 'Far',        maxFt: RANGE_BANDS_FT.FAR,        fillColor: 'rgba(250,204,21,0.08)', ringColor: 'rgba(250,204,21,0.45)', tokenGlow: 'rgba(250,204,21,0.75)', tokenRing: 'rgba(250,204,21,0.95)'  },
  { name: 'Very Far',   maxFt: RANGE_BANDS_FT.VERY_FAR,   fillColor: 'rgba(239,68,68,0.04)',  ringColor: 'rgba(239,68,68,0.30)',  tokenGlow: 'rgba(239,68,68,0.65)',  tokenRing: 'rgba(239,68,68,0.9)'    },
];

const CONNECTOR_BEYOND_RANGE_COLORS = {
  line: 'rgba(226, 232, 240, 0.55)',
  text: 'rgb(226, 232, 240)',
  boxFill: 'rgba(15, 23, 42, 0.9)',
  boxStroke: 'rgba(148, 163, 184, 0.45)',
};

/**
 * Stroke / label colors for a dotted altitude connector. Uses the same tokenGlow /
 * tokenRing / ringColor as BattleMap range-band highlighting on the target token.
 *
 * @param {number} rangeBandIndex - 0–4 (Melee…Very Far), or -1 / null beyond range
 * @returns {{ line: string, text: string, boxFill: string, boxStroke: string }}
 */
export function rangeBandConnectorColors(rangeBandIndex) {
  const band = (rangeBandIndex != null && rangeBandIndex >= 0)
    ? RANGE_BANDS_ORDERED[rangeBandIndex]
    : null;
  if (!band) return CONNECTOR_BEYOND_RANGE_COLORS;
  return {
    line: band.tokenGlow,
    text: band.tokenRing,
    boxFill: 'rgba(8, 12, 16, 0.88)',
    boxStroke: band.ringColor,
  };
}

/**
 * Given a nearest-edge distance in feet, return the range band name.
 * Uses the same edge logic as BattleMap (first band where dist <= maxFt).
 *
 * @param {number} distanceFt - nearest-edge distance in feet (e.g. from tokenDistanceFt)
 * @returns {string|null} 'Melee' | 'Very Close' | 'Close' | 'Far' | 'Very Far', or null if invalid
 */
export function distanceFtToRangeBandName(distanceFt) {
  if (distanceFt == null || typeof distanceFt !== 'number' || distanceFt < 0) return null;
  const band = RANGE_BANDS_ORDERED.find(b => distanceFt <= b.maxFt);
  return band ? band.name : null;
}

/**
 * Given a nearest-edge distance in feet, return the range band index (0–4).
 * Same edge logic as BattleMap. Use with RANGE_BANDS_ORDERED or BattleMap's RANGE_BANDS.
 *
 * @param {number} distanceFt - nearest-edge distance in feet
 * @returns {number} 0–4 for Melee..Very Far, or -1 if out of range / invalid
 */
export function getRangeBandIndexForDistanceFt(distanceFt) {
  if (distanceFt == null || typeof distanceFt !== 'number' || distanceFt < 0) return -1;
  const idx = RANGE_BANDS_ORDERED.findIndex(b => distanceFt <= b.maxFt);
  return idx >= 0 ? idx : -1;
}

/**
 * Returns all character elements (other than the source) that are within
 * Far range of the source character on the battle map.
 *
 * Characters not placed on the map (tokenX/tokenY null) are excluded.
 * If the source character is not placed on the map, returns [].
 *
 * @param {Array} activeElements - the full resolvedActiveElements array
 * @param {string} sourceInstanceId - instanceId of the character using the feature
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getCharactersWithinFarRange(activeElements, sourceInstanceId) {
  const source = activeElements.find(e => e.instanceId === sourceInstanceId);
  if (!source || source.tokenX == null || source.tokenY == null) return [];

  return activeElements
    .filter(e =>
      e.elementType === 'character' &&
      e.instanceId !== sourceInstanceId &&
      sameTokenMapPlane(source, e) &&
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFtForElements(source, e) <= FAR_RANGE_FT
    )
    .map(e => ({ instanceId: e.instanceId, name: e.name }));
}

/**
 * Returns adversary elements (or minimal { instanceId, name }) within Melee range (5')
 * of the source character on the battle map.
 *
 * Adversaries not placed on the map (tokenX/tokenY null) are excluded.
 * If the source character is not placed on the map, returns [].
 *
 * @param {Array} activeElements - the full activeElements array (characters + adversaries)
 * @param {string} sourceInstanceId - instanceId of the character (attacker)
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getAdversariesWithinMeleeRange(activeElements, sourceInstanceId) {
  const source = activeElements.find(e => e.instanceId === sourceInstanceId);
  if (!source || source.tokenX == null || source.tokenY == null) return [];

  const characterCount = characterCountFromElements(activeElements);
  return activeElements
    .filter(e =>
      e.elementType === 'adversary' &&
      isAdversaryPresentForParty(e, characterCount) &&
      sameTokenMapPlane(source, e) &&
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFtForElements(source, e) <= RANGE_BANDS_FT.MELEE
    )
    .map(e => ({ instanceId: e.instanceId, name: e.name ?? '' }));
}

/**
 * Returns adversary elements within the given max distance (feet) of the source.
 * Adversaries not on the map are excluded. If the source is not on the map, returns [].
 *
 * @param {Array} activeElements - the full activeElements array (characters + adversaries)
 * @param {string} sourceInstanceId - instanceId of the character (attacker)
 * @param {number} maxFt - maximum nearest-edge distance in feet (e.g. from rangeBandNameToFt)
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getAdversariesWithinRangeFt(activeElements, sourceInstanceId, maxFt) {
  const source = activeElements.find(e => e.instanceId === sourceInstanceId);
  if (!source || source.tokenX == null || source.tokenY == null) return [];
  if (typeof maxFt !== 'number' || maxFt < 0) return [];

  const characterCount = characterCountFromElements(activeElements);
  return activeElements
    .filter(e =>
      e.elementType === 'adversary' &&
      isAdversaryPresentForParty(e, characterCount) &&
      sameTokenMapPlane(source, e) &&
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFtForElements(source, e) <= maxFt
    )
    .map(e => ({ instanceId: e.instanceId, name: e.name ?? '' }));
}

/**
 * Returns character elements within the given max distance (feet) of the source token.
 * Used for adversary attacks: source is the adversary instance; targets are characters.
 * Source can be any element type (adversary or character). Characters not on the map are excluded.
 * If the source is not on the map, returns [].
 *
 * @param {Array} activeElements - the full activeElements array (characters + adversaries)
 * @param {string} sourceInstanceId - instanceId of the source token (e.g. adversary attacker)
 * @param {number} maxFt - maximum nearest-edge distance in feet (e.g. from rangeBandNameToFt)
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getCharactersWithinRangeFt(activeElements, sourceInstanceId, maxFt) {
  const source = activeElements.find(e => e.instanceId === sourceInstanceId);
  if (!source || source.tokenX == null || source.tokenY == null) return [];
  if (typeof maxFt !== 'number' || maxFt < 0) return [];

  return activeElements
    .filter(e =>
      e.elementType === 'character' &&
      e.instanceId !== sourceInstanceId &&
      sameTokenMapPlane(source, e) &&
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFtForElements(source, e) <= maxFt
    )
    .map(e => ({ instanceId: e.instanceId, name: e.name ?? '' }));
}

/**
 * Returns character elements within maxFt of any of the given source instance IDs (union, deduplicated).
 * Used when multiple adversary instances can make the attack (e.g. 3 goblins); valid targets are
 * characters in range of any of them.
 *
 * @param {Array} activeElements - the full activeElements array
 * @param {string[]} sourceInstanceIds - instanceIds of source tokens (e.g. adversary instances)
 * @param {number} maxFt - maximum nearest-edge distance in feet
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getCharactersWithinRangeOfAny(activeElements, sourceInstanceIds, maxFt) {
  if (!Array.isArray(sourceInstanceIds) || sourceInstanceIds.length === 0) return [];
  if (typeof maxFt !== 'number' || maxFt < 0) return [];

  const seen = new Set();
  const result = [];
  for (const id of sourceInstanceIds) {
    const inRange = getCharactersWithinRangeFt(activeElements, id, maxFt);
    for (const c of inRange) {
      if (!seen.has(c.instanceId)) {
        seen.add(c.instanceId);
        result.push(c);
      }
    }
  }
  return result;
}

/**
 * Returns all character elements (other than the source) that are within
 * Close range of the source and have at least one marked hit point
 * (currentHp < maxHp).
 *
 * Characters not placed on the map are excluded.
 * If the source character is not placed on the map, returns [].
 *
 * @param {Array} activeElements - the full resolvedActiveElements array
 * @param {string} sourceInstanceId - instanceId of the character using the feature
 * @returns {Array<{ instanceId: string, name: string }>}
 */
export function getCharactersWithinCloseRangeWithMarkedHp(activeElements, sourceInstanceId) {
  const source = activeElements.find(e => e.instanceId === sourceInstanceId);
  if (!source || source.tokenX == null || source.tokenY == null) return [];

  return activeElements
    .filter(e => {
      if (e.elementType !== 'character' || e.instanceId === sourceInstanceId) return false;
      if (!sameTokenMapPlane(source, e)) return false;
      if (e.tokenX == null || e.tokenY == null) return false;
      const dist = tokenDistanceFtForElements(source, e);
      if (dist > CLOSE_RANGE_FT) return false;
      const maxHp = e.maxHp ?? 0;
      const currentHp = e.currentHp ?? maxHp;
      return maxHp > 0 && currentHp < maxHp;
    })
    .map(e => ({ instanceId: e.instanceId, name: e.name }));
}
