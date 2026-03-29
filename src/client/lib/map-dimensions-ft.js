/** Match battle map size bounds in BattleMap.jsx / ai-image-prompts */
export const MAP_SIZE_FT_MIN = 1;
export const MAP_SIZE_FT_MAX = 3000;

/**
 * Footprint of the battle map: one edge length (`mapSizeFt`) is user-edited; the other follows
 * image aspect ratio when natural dimensions exist, else square.
 * @param {object} [mapConfig]
 * @returns {{ mapWidthFt: number, mapHeightFt: number }}
 */
export function getMapDimensionsFt(mapConfig) {
  const { mapSizeFt = 100, mapDimension = 'width', mapImageNaturalWidth, mapImageNaturalHeight } =
    mapConfig ?? {};
  const sizeFt = Math.max(MAP_SIZE_FT_MIN, Math.min(MAP_SIZE_FT_MAX, Number(mapSizeFt) || 100));
  if (mapImageNaturalWidth > 0 && mapImageNaturalHeight > 0) {
    const aspect = mapImageNaturalWidth / mapImageNaturalHeight;
    return mapDimension === 'width'
      ? { mapWidthFt: sizeFt, mapHeightFt: Math.round((sizeFt / aspect) * 10) / 10 }
      : { mapHeightFt: sizeFt, mapWidthFt: Math.round(sizeFt * aspect * 10) / 10 };
  }
  return { mapWidthFt: sizeFt, mapHeightFt: sizeFt };
}
