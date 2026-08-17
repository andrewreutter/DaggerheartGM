/**
 * Pure geometry/permission helpers shared by BattleMap's placed map objects
 * (`mapImage` and `drawShape`): the creator-or-GM modify-permission rule, the
 * corner-drag resize math (aspect-locked for images, uniform-scale for brush
 * strokes, free for rect/oval), and stack/hit-test order (smaller objects on
 * top so they stay selectable). No React, no BattleMap-specific state — safe to
 * unit test directly.
 */

/** Display defaults when `widthFt`/`heightFt` are missing — match MapImageObject / DrawShapeObject. */
const DEFAULT_MAP_IMAGE_SIZE_FT = 20;
const DEFAULT_DRAW_SHAPE_SIZE_FT = 4;

/** Map objects stay in this band so tokens (z ≥ `TOKEN_LAYER_Z_INDEX_MIN`) always win hit-testing. */
export const MAP_OBJECT_Z_INDEX = 22;
export const MAP_OBJECT_Z_INDEX_MAX = 29;
/** First z-index used by placed tokens (characters, companions, adversaries). */
export const TOKEN_LAYER_Z_INDEX_MIN = 30;

/**
 * z-index for a map object in the 22–29 band. Unselected objects stack from the
 * base; the selected object uses the max so its grips stay reachable. Always
 * strictly below `TOKEN_LAYER_Z_INDEX_MIN` so a token on the same spot stays
 * clickable.
 *
 * @param {number} stackIdx
 * @param {{ selected?: boolean }} [opts]
 * @returns {number}
 */
export function mapObjectStackZIndex(stackIdx, { selected } = {}) {
  if (selected) return MAP_OBJECT_Z_INDEX_MAX;
  const idx = Number(stackIdx);
  const offset = Number.isFinite(idx) && idx > 0 ? Math.floor(idx) : 0;
  return Math.min(MAP_OBJECT_Z_INDEX + offset, MAP_OBJECT_Z_INDEX_MAX - 1);
}

/**
 * Bounding-box area in ft². Used to stack smaller objects above larger ones so a
 * click on an overlap hits the small object instead of the box covering it.
 *
 * @param {{ elementType?: string, widthFt?: number, heightFt?: number }} el
 * @returns {number}
 */
export function mapObjectAreaFt(el) {
  const fallback = el?.elementType === 'mapImage' ? DEFAULT_MAP_IMAGE_SIZE_FT : DEFAULT_DRAW_SHAPE_SIZE_FT;
  const w = Number(el?.widthFt);
  const h = Number(el?.heightFt);
  const width = Number.isFinite(w) && w > 0 ? w : fallback;
  const height = Number.isFinite(h) && h > 0 ? h : fallback;
  return width * height;
}

/**
 * Paint/hit order: largest first (behind), smallest last (on top). Ties break
 * by `instanceId` so the order is stable across renders. The selected object
 * (if any) is last so its resize grips stay reachable while editing; click
 * empty map to deselect, then the smaller object is on top again.
 *
 * @param {object[]} objects
 * @param {{ selectedId?: string | null }} [opts]
 * @returns {object[]}
 */
export function sortMapObjectsForStack(objects, { selectedId } = {}) {
  return [...(objects || [])].sort((a, b) => {
    if (selectedId) {
      if (a?.instanceId === selectedId) return 1;
      if (b?.instanceId === selectedId) return -1;
    }
    const d = mapObjectAreaFt(b) - mapObjectAreaFt(a);
    if (d !== 0) return d;
    return String(a?.instanceId ?? '').localeCompare(String(b?.instanceId ?? ''));
  });
}

/**
 * Escape on the battle map: drop map-object selection and the token pin (same
 * as clicking empty map). GM also leaves the current draw tool (`hand`).
 *
 * @param {{ isPlayer?: boolean }} [opts]
 * @returns {{ selectedMapObjectId: null, pinnedToken: null, resetDrawToolToHand: boolean }}
 */
export function battleMapEscapeResult({ isPlayer } = {}) {
  return {
    selectedMapObjectId: null,
    pinnedToken: null,
    resetDrawToolToHand: !isPlayer,
  };
}

/**
 * Unfilled rect/oval and brush strokes should not steal clicks in empty space
 * inside their bounding box — only the ink/stroke is a hit target (until the
 * object is selected, when the whole box is used for drag).
 *
 * @param {{ elementType?: string, shapeTool?: string, filled?: boolean }} el
 * @returns {boolean}
 */
export function mapObjectUsesStrokeHitTest(el) {
  if (el?.elementType !== 'drawShape') return false;
  if (el.shapeTool === 'brush') return true;
  return !el.filled;
}

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
