/**
 * Map range utilities for game mechanics that depend on token positions.
 *
 * Range bands (in feet) match the constants in BattleMap.jsx.
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

/**
 * Nearest-edge distance in feet between two placed tokens.
 * Matches the distance formula used in BattleMap.jsx for range band highlighting.
 *
 * @param {number} ax - Token A's tokenX (feet, top-left)
 * @param {number} ay - Token A's tokenY (feet, top-left)
 * @param {number} bx - Token B's tokenX (feet, top-left)
 * @param {number} by - Token B's tokenY (feet, top-left)
 * @returns {number} nearest-edge distance in feet (≥ 0)
 */
export function tokenDistanceFt(ax, ay, bx, by) {
  const dx = (ax + TOKEN_HALF_FT) - (bx + TOKEN_HALF_FT);
  const dy = (ay + TOKEN_HALF_FT) - (by + TOKEN_HALF_FT);
  return Math.max(0, Math.sqrt(dx * dx + dy * dy) - TOKEN_HALF_FT);
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
 * @returns {{ x: number, y: number }} Token top-left position for the new placement
 */
export function positionAtDistanceFt(ax, ay, bx, by, d) {
  const acx = ax + TOKEN_HALF_FT;
  const acy = ay + TOKEN_HALF_FT;
  const bcx = bx + TOKEN_HALF_FT;
  const bcy = by + TOKEN_HALF_FT;
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
  return { x: newCx - TOKEN_HALF_FT, y: newCy - TOKEN_HALF_FT };
}

/** Ordered range bands (name + maxFt) for distance → band logic. Same edge rule as BattleMap token highlighting. */
export const RANGE_BANDS_ORDERED = [
  { name: 'Melee', maxFt: RANGE_BANDS_FT.MELEE },
  { name: 'Very Close', maxFt: RANGE_BANDS_FT.VERY_CLOSE },
  { name: 'Close', maxFt: RANGE_BANDS_FT.CLOSE },
  { name: 'Far', maxFt: RANGE_BANDS_FT.FAR },
  { name: 'Very Far', maxFt: RANGE_BANDS_FT.VERY_FAR },
];

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
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFt(source.tokenX, source.tokenY, e.tokenX, e.tokenY) <= FAR_RANGE_FT
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

  return activeElements
    .filter(e =>
      e.elementType === 'adversary' &&
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFt(source.tokenX, source.tokenY, e.tokenX, e.tokenY) <= RANGE_BANDS_FT.MELEE
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

  return activeElements
    .filter(e =>
      e.elementType === 'adversary' &&
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFt(source.tokenX, source.tokenY, e.tokenX, e.tokenY) <= maxFt
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
      e.tokenX != null &&
      e.tokenY != null &&
      tokenDistanceFt(source.tokenX, source.tokenY, e.tokenX, e.tokenY) <= maxFt
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
      if (e.tokenX == null || e.tokenY == null) return false;
      const dist = tokenDistanceFt(source.tokenX, source.tokenY, e.tokenX, e.tokenY);
      if (dist > CLOSE_RANGE_FT) return false;
      const maxHp = e.maxHp ?? 0;
      const currentHp = e.currentHp ?? maxHp;
      return maxHp > 0 && currentHp < maxHp;
    })
    .map(e => ({ instanceId: e.instanceId, name: e.name }));
}
