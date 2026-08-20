/**
 * Pure helpers for the "Place on map" action (tray token → random open spot on the
 * current camera view). No React/DOM dependency so this is directly unit-testable.
 *
 * Coordinates are all in feet, matching `tokenX`/`tokenY` semantics elsewhere
 * (top-left of the token's bounding box).
 */

/**
 * Clamp `[min, min+span]` range so it fits within `[0, boundMax]`. Returns `{ min, max }`
 * (inclusive) for the token's top-left coordinate along one axis, or `null` when the
 * requested span cannot fit anywhere on the map at all (token bigger than the map).
 *
 * @param {number} rangeStart - desired range start (e.g. camera-visible left/top edge)
 * @param {number} rangeSpan - desired range span (e.g. camera-visible width/height)
 * @param {number} tokenSpan - full extent of the token along this axis (2 * half-extent)
 * @param {number} boundMax - map extent along this axis
 * @returns {{ min: number, max: number } | null}
 */
function clampPlacementRange(rangeStart, rangeSpan, tokenSpan, boundMax) {
  const mapMax = boundMax - tokenSpan;
  if (mapMax < 0) return null; // token doesn't fit on the map at all
  const min = Math.max(0, Math.min(mapMax, rangeStart));
  const max = Math.max(0, Math.min(mapMax, rangeStart + rangeSpan - tokenSpan));
  if (max >= min) return { min, max };
  // Camera view is narrower than the token (heavily zoomed in) — fall back to a single point.
  const point = Math.max(0, Math.min(mapMax, rangeStart));
  return { min: point, max: point };
}

/**
 * Two AABBs (given as center + half-extents) overlap when their centers are closer than
 * the sum of their half-extents on both axes.
 */
function footprintsOverlap(cx1, cy1, hw1, hl1, cx2, cy2, hw2, hl2) {
  return Math.abs(cx1 - cx2) < hw1 + hw2 && Math.abs(cy1 - cy2) < hl1 + hl2;
}

/**
 * Pick a random top-left `{ x, y }` (feet) to place a token on the current map, preferring
 * a spot inside the visible camera viewport that doesn't overlap any already-placed token.
 *
 * Falls back progressively when no such spot exists:
 * 1. Random spot within the viewport (clamped to map bounds), avoiding overlap.
 * 2. Random spot anywhere on the map, avoiding overlap.
 * 3. A clamped point (viewport center if possible, else map center) — even if it overlaps.
 *
 * @param {object} opts
 * @param {number} opts.mapWidthFt
 * @param {number} opts.mapHeightFt
 * @param {{ x: number, y: number, width: number, height: number }} opts.viewportFt - camera-visible rect
 * @param {{ halfWidth: number, halfLength: number }} opts.footprint - footprint of the token being placed
 * @param {Array<{ x: number, y: number, footprint: { halfWidth: number, halfLength: number } }>} [opts.otherTokens] - existing placed tokens (top-left ft) to avoid overlapping
 * @param {() => number} [opts.randomFn] - injectable RNG for tests (defaults to `Math.random`)
 * @param {number} [opts.maxAttemptsPerPass]
 * @returns {{ x: number, y: number }}
 */
export function pickRandomPlaceOnMapSpot({
  mapWidthFt,
  mapHeightFt,
  viewportFt,
  footprint,
  otherTokens = [],
  randomFn = Math.random,
  maxAttemptsPerPass = 60,
}) {
  const halfWidth = footprint?.halfWidth ?? 2.5;
  const halfLength = footprint?.halfLength ?? 2.5;
  const tokenW = halfWidth * 2;
  const tokenL = halfLength * 2;

  const others = (otherTokens || []).map((t) => ({
    cx: t.x + (t.footprint?.halfWidth ?? 2.5),
    cy: t.y + (t.footprint?.halfLength ?? 2.5),
    halfWidth: t.footprint?.halfWidth ?? 2.5,
    halfLength: t.footprint?.halfLength ?? 2.5,
  }));

  const overlapsAny = (x, y) => {
    const cx = x + halfWidth;
    const cy = y + halfLength;
    return others.some((o) => footprintsOverlap(cx, cy, halfWidth, halfLength, o.cx, o.cy, o.halfWidth, o.halfLength));
  };

  const view = viewportFt || { x: 0, y: 0, width: mapWidthFt, height: mapHeightFt };
  const viewRangeX = clampPlacementRange(view.x, view.width, tokenW, mapWidthFt);
  const viewRangeY = clampPlacementRange(view.y, view.height, tokenL, mapHeightFt);

  const fullRangeX = clampPlacementRange(0, mapWidthFt, tokenW, mapWidthFt);
  const fullRangeY = clampPlacementRange(0, mapHeightFt, tokenL, mapHeightFt);

  const tryPass = (rangeX, rangeY) => {
    if (!rangeX || !rangeY) return null;
    for (let i = 0; i < maxAttemptsPerPass; i++) {
      const x = rangeX.min + randomFn() * Math.max(0, rangeX.max - rangeX.min);
      const y = rangeY.min + randomFn() * Math.max(0, rangeY.max - rangeY.min);
      if (!overlapsAny(x, y)) return { x, y };
    }
    return null;
  };

  const inView = tryPass(viewRangeX, viewRangeY);
  if (inView) return inView;

  const onMap = tryPass(fullRangeX, fullRangeY);
  if (onMap) return onMap;

  // Last resort: no open spot found — land at the viewport center (or map center) anyway.
  const rangeX = viewRangeX || fullRangeX || { min: 0, max: 0 };
  const rangeY = viewRangeY || fullRangeY || { min: 0, max: 0 };
  return {
    x: (rangeX.min + rangeX.max) / 2,
    y: (rangeY.min + rangeY.max) / 2,
  };
}

/**
 * Batch version of `pickRandomPlaceOnMapSpot` for the "place all on map" bulk tray action —
 * picks a spot for each `items` entry in order, feeding every spot already picked in this same
 * batch back into the next pick's overlap-avoidance set (in addition to `otherTokens`) so
 * multiple tokens placed together don't land stacked on top of each other.
 *
 * @param {object} opts
 * @param {number} opts.mapWidthFt
 * @param {number} opts.mapHeightFt
 * @param {{ x: number, y: number, width: number, height: number }} opts.viewportFt - camera-visible rect
 * @param {Array<{ footprint: { halfWidth: number, halfLength: number } }>} opts.items - tokens to place, in order
 * @param {Array<{ x: number, y: number, footprint: { halfWidth: number, halfLength: number } }>} [opts.otherTokens] - already-placed tokens (outside this batch) to avoid overlapping
 * @param {() => number} [opts.randomFn] - injectable RNG for tests (defaults to `Math.random`)
 * @param {number} [opts.maxAttemptsPerPass]
 * @returns {Array<{ x: number, y: number }>} one spot per `items` entry, same order
 */
export function pickRandomPlaceOnMapSpots({
  mapWidthFt,
  mapHeightFt,
  viewportFt,
  items,
  otherTokens = [],
  randomFn = Math.random,
  maxAttemptsPerPass = 60,
}) {
  const placed = [...(otherTokens || [])];
  const spots = [];
  for (const item of items || []) {
    const spot = pickRandomPlaceOnMapSpot({
      mapWidthFt,
      mapHeightFt,
      viewportFt,
      footprint: item.footprint,
      otherTokens: placed,
      randomFn,
      maxAttemptsPerPass,
    });
    placed.push({ x: spot.x, y: spot.y, footprint: item.footprint });
    spots.push(spot);
  }
  return spots;
}

/**
 * Which tray side a placed token "belongs" to — used both for the random-spot camera
 * preference (none currently) and for the return-to-tray / place-on-map icon direction.
 * Adversaries live in the right tray; characters and companion board tokens live in the
 * left tray.
 *
 * @param {string} elementType
 * @returns {'left' | 'right'}
 */
export function getTokenTrayDirection(elementType) {
  return elementType === 'adversary' ? 'right' : 'left';
}

/**
 * Right-tray pins open to the left of the token (mirrored from left-tray
 * character pins, which open to the right). Map tokens keep the default
 * right-of-click placement.
 * @param {{ fromTray?: boolean, elementType?: string }} opts
 */
export function tokenPinPrefersLeft({ fromTray, elementType } = {}) {
  return !!fromTray && getTokenTrayDirection(elementType) === 'right';
}
