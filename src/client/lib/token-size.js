/**
 * Per-token size multipliers (width × length) — library-scoped.
 *
 * A character/adversary (or a Beastbound companion's own data) may carry
 * `tokenSizeWidth` / `tokenSizeLength` / `tokenSizeLinked` fields that scale its
 * battle map footprint relative to the standard 5×5' token. These are ordinary
 * library fields (default `1`/`1`/`true` reproduce today's uniform 5×5' token
 * exactly), so every call site here is backward-compatible by default.
 *
 * Shared by `map-range.js` (range/adjacency math) and `BattleMap.jsx` (rendering + drag).
 */

export const TOKEN_SIZE_MIN = 0.1;
export const TOKEN_SIZE_MAX = 5;
export const TOKEN_SIZE_STEP = 0.1;

/** Half-extent (feet) of a standard 5×5' token at multiplier 1. */
const TOKEN_HALF_FT_BASE = 2.5;

/**
 * Clamp a raw size multiplier into range and round to the nearest 0.1 step
 * (fixes float drift, e.g. `1.45` → `1.5`, `1.44` → `1.4`).
 *
 * @param {number} value
 * @returns {number}
 */
export function roundTokenSizeMultiplier(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.max(TOKEN_SIZE_MIN, Math.min(TOKEN_SIZE_MAX, n));
  return Math.round(clamped * 10) / 10;
}

/**
 * Read `{ width, length, linked }` off a character, adversary, or companion object.
 * Missing/invalid fields default to `{ width: 1, length: 1, linked: true }` — the
 * standard 5×5' token.
 *
 * @param {object|null|undefined} source
 * @returns {{ width: number, length: number, linked: boolean }}
 */
export function getTokenSizeMultipliers(source) {
  if (!source || typeof source !== 'object') return { width: 1, length: 1, linked: true };
  const width = source.tokenSizeWidth != null ? roundTokenSizeMultiplier(source.tokenSizeWidth) : 1;
  const length = source.tokenSizeLength != null ? roundTokenSizeMultiplier(source.tokenSizeLength) : 1;
  const linked = source.tokenSizeLinked !== false;
  return { width, length, linked };
}

/**
 * Token footprint half-extents in feet (`2.5 * multiplier`). Defaults reproduce the
 * standard `{ halfWidth: 2.5, halfLength: 2.5 }` token exactly.
 *
 * @param {object|null|undefined} source
 * @returns {{ halfWidth: number, halfLength: number }}
 */
export function getTokenFootprintFt(source) {
  const { width, length } = getTokenSizeMultipliers(source);
  return { halfWidth: TOKEN_HALF_FT_BASE * width, halfLength: TOKEN_HALF_FT_BASE * length };
}

/**
 * Render size in pixels for a token given the display size of a standard (1×/1×) token.
 *
 * @param {number} baseTokenSizePx - pixel size of a standard 5×5' token at the current zoom
 * @param {object|null|undefined} source
 * @returns {{ widthPx: number, heightPx: number }}
 */
export function computeTokenRenderPx(baseTokenSizePx, source) {
  const { width, length } = getTokenSizeMultipliers(source);
  const base = Number(baseTokenSizePx) || 0;
  return {
    widthPx: Math.max(1, Math.round(base * width)),
    heightPx: Math.max(1, Math.round(base * length)),
  };
}

/**
 * Build a patch for a width/length stepper change, respecting the current link state
 * (when linked, changing either axis snaps both to the same value).
 *
 * @param {object} current - object with tokenSizeWidth/tokenSizeLength/tokenSizeLinked
 * @param {{ axis: 'width'|'length', value: number }} change
 * @returns {object} patch to merge onto `current`
 */
export function buildTokenSizeUpdate(current, { axis, value }) {
  const cur = getTokenSizeMultipliers(current);
  const v = roundTokenSizeMultiplier(value);
  if (axis === 'width') {
    return cur.linked ? { tokenSizeWidth: v, tokenSizeLength: v } : { tokenSizeWidth: v };
  }
  if (axis === 'length') {
    return cur.linked ? { tokenSizeWidth: v, tokenSizeLength: v } : { tokenSizeLength: v };
  }
  return {};
}

/**
 * Build a patch for toggling the width/length link. Turning link **on** immediately
 * snaps length to match width.
 *
 * @param {object} current - object with tokenSizeWidth/tokenSizeLength/tokenSizeLinked
 * @param {boolean} linked
 * @returns {object} patch to merge onto `current`
 */
export function buildTokenSizeLinkToggleUpdate(current, linked) {
  const cur = getTokenSizeMultipliers(current);
  if (linked) {
    return { tokenSizeLinked: true, tokenSizeWidth: cur.width, tokenSizeLength: cur.width };
  }
  return { tokenSizeLinked: false };
}
