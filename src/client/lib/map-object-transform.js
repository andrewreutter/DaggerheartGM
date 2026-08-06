/**
 * Pure geometry/permission helpers shared by BattleMap's placed map objects
 * (`mapImage` and `drawShape`): the creator-or-GM modify-permission rule and the
 * corner-drag resize math (aspect-locked for images, uniform-scale for brush
 * strokes, free for rect/oval). No React, no BattleMap-specific state — safe to
 * unit test directly.
 */

/**
 * Creator-or-GM permission rule for placed map objects (`mapImage`, `drawShape`).
 * The GM can modify any object. A player can modify an object they created, or
 * any legacy object that predates `createdByUid` (left permissive — no migration
 * needed for images placed before this field existed).
 *
 * @param {{ createdByUid?: string | null }} el
 * @param {{ isPlayer: boolean, userUid?: string | null }} ctx
 * @returns {boolean}
 */
export function canModifyMapObject(el, { isPlayer, userUid } = {}) {
  if (!isPlayer) return true;
  if (!el?.createdByUid) return true;
  return el.createdByUid === userUid;
}

/**
 * The fixed opposite-corner anchor point (in feet) for a corner-drag resize,
 * captured once at drag start. `corner` is one of 'NW' | 'NE' | 'SW' | 'SE'.
 *
 * @param {{ corner: string, cx: number, cy: number, widthFt: number, heightFt: number }} args
 * @returns {{ anchorX: number, anchorY: number }}
 */
export function computeCornerAnchor({ corner, cx, cy, widthFt, heightFt }) {
  const anchorX = corner === 'NW' || corner === 'SW' ? cx + widthFt / 2 : cx - widthFt / 2;
  const anchorY = corner === 'NW' || corner === 'NE' ? cy + heightFt / 2 : cy - heightFt / 2;
  return { anchorX, anchorY };
}

/**
 * Corner-drag resize math shared by every placed map object type.
 *
 * `mode`:
 *  - `'aspectLocked'` — width drives height via `ratio` (images: natural aspect ratio).
 *  - `'uniform'` — identical math to `'aspectLocked'`; pass the object's own starting
 *    height/width as `ratio` so the whole object (including any relative points) scales
 *    uniformly (used by brush strokes).
 *  - `'free'` — width and height resize independently from horizontal/vertical drag
 *    (rect/oval have no natural aspect ratio to preserve).
 *
 * The opposite corner (`anchorX`/`anchorY`) stays fixed; returns the new center position
 * and size.
 *
 * @param {{
 *   mode: 'aspectLocked' | 'uniform' | 'free',
 *   corner: 'NW' | 'NE' | 'SW' | 'SE',
 *   dxFt: number,
 *   dyFt: number,
 *   anchorX: number,
 *   anchorY: number,
 *   startWidthFt: number,
 *   startHeightFt: number,
 *   ratio?: number,
 *   minSizeFt?: number,
 * }} args
 * @returns {{ xFt: number, yFt: number, widthFt: number, heightFt: number }}
 */
export function computeCornerResize({
  mode,
  corner,
  dxFt,
  dyFt,
  anchorX,
  anchorY,
  startWidthFt,
  startHeightFt,
  ratio = 1,
  minSizeFt = 1,
}) {
  const growsRight = corner === 'NE' || corner === 'SE';
  const growsDown = corner === 'SW' || corner === 'SE';
  const widthFt = Math.max(minSizeFt, growsRight ? startWidthFt + dxFt : startWidthFt - dxFt);
  const heightFt =
    mode === 'free'
      ? Math.max(minSizeFt, growsDown ? startHeightFt + dyFt : startHeightFt - dyFt)
      : widthFt * ratio;
  const xFt = growsRight ? anchorX + widthFt / 2 : anchorX - widthFt / 2;
  const yFt = growsDown ? anchorY + heightFt / 2 : anchorY - heightFt / 2;
  return { xFt, yFt, widthFt, heightFt };
}

/**
 * Uniformly scales a brush stroke's center-relative points and radius by `scaleFactor`
 * (new width / old width) — used when resizing a `drawShape` brush object so the
 * freehand stroke scales without distorting.
 *
 * @param {{x: number, y: number}[]} pointsFt
 * @param {number} radiusFt
 * @param {number} scaleFactor
 * @returns {{ pointsFt: {x: number, y: number}[], radiusFt: number }}
 */
export function scaleBrushStroke(pointsFt, radiusFt, scaleFactor) {
  return {
    pointsFt: (pointsFt || []).map((p) => ({ x: p.x * scaleFactor, y: p.y * scaleFactor })),
    radiusFt: radiusFt * scaleFactor,
  };
}
