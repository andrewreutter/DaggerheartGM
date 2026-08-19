import { describe, it, expect } from 'vitest';
import {
  tokenDistanceFt,
  tokenDistanceFtForElements,
  pointToTokenDistanceFt,
  pointToTokenCenterDistanceFt,
  collectBullseyeAltitudeConnectors,
  formatRangeDistanceFt,
  pointNearSegmentTarget,
  BULLSEYE_CONNECTOR_LABEL_INSET_PX,
  positionAtDistanceFt,
  ellipseRadiusAtAngle,
  getTokenFootprintFt,
  getCharactersWithinFarRange,
  getCharactersWithinCloseRangeWithMarkedHp,
  getAdversariesWithinMeleeRange,
  getAdversariesWithinRangeFt,
  rangeBandNameToFt,
  RANGE_BANDS_FT,
  RANGE_BANDS_ORDERED,
  FAR_RANGE_FT,
  CLOSE_RANGE_FT,
  getRangeBandIndexForDistanceFt,
  rangeBandConnectorColors,
} from '../../src/client/lib/map-range.js';

describe('tokenDistanceFt', () => {
  it('returns 0 for overlapping tokens', () => {
    expect(tokenDistanceFt(0, 0, 0, 0)).toBe(0);
  });

  it('computes nearest-edge distance (subtracts token radius)', () => {
    // Centers 100' apart, nearest-edge = 100 - 2.5 = 97.5
    expect(tokenDistanceFt(0, 0, 100, 0)).toBeCloseTo(97.5, 5);
  });

  it('clamps to 0 when tokens are adjacent / overlapping', () => {
    // Centers 2' apart: center-to-center 2, minus 2.5 = -0.5, clamped to 0
    expect(tokenDistanceFt(0, 0, 2, 0)).toBe(0);
  });
});

describe('getTokenFootprintFt', () => {
  it('defaults to the standard 2.5/2.5 footprint', () => {
    expect(getTokenFootprintFt(null)).toEqual({ halfWidth: 2.5, halfLength: 2.5 });
    expect(getTokenFootprintFt({})).toEqual({ halfWidth: 2.5, halfLength: 2.5 });
  });

  it('scales with tokenSizeWidth/tokenSizeLength', () => {
    expect(getTokenFootprintFt({ tokenSizeWidth: 2, tokenSizeLength: 1 })).toEqual({
      halfWidth: 5,
      halfLength: 2.5,
    });
  });
});

describe('ellipseRadiusAtAngle', () => {
  it('is constant (a circle) when halfWidth === halfLength', () => {
    for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, 3.7]) {
      expect(ellipseRadiusAtAngle(2.5, 2.5, angle)).toBeCloseTo(2.5, 10);
    }
  });

  it('returns halfWidth along the X axis and halfLength along the Y axis', () => {
    expect(ellipseRadiusAtAngle(5, 2.5, 0)).toBeCloseTo(5, 10);
    expect(ellipseRadiusAtAngle(5, 2.5, Math.PI / 2)).toBeCloseTo(2.5, 10);
  });

  it('is symmetric under +π (direction-agnostic)', () => {
    const a = ellipseRadiusAtAngle(5, 2, 0.7);
    const b = ellipseRadiusAtAngle(5, 2, 0.7 + Math.PI);
    expect(b).toBeCloseTo(a, 10);
  });
});

describe('tokenDistanceFt with custom footprints', () => {
  it('reproduces the default-token result exactly when footprints are omitted', () => {
    expect(tokenDistanceFt(0, 0, 100, 0)).toBeCloseTo(97.5, 10);
  });

  it('averages the two tokens\' directional reach (not summed)', () => {
    // Two default-sized tokens 100' apart center-to-center: reach = (2.5+2.5)/2 = 2.5
    const aFootprint = { halfWidth: 2.5, halfLength: 2.5 };
    const bFootprint = { halfWidth: 2.5, halfLength: 2.5 };
    expect(tokenDistanceFt(0, 0, 100, 0, aFootprint, bFootprint)).toBeCloseTo(97.5, 10);
  });

  it('a wider token reaches further along its wide axis', () => {
    // Token A is 10'x5' (half 5/2.5) at top-left (0,0) -> center (5, 2.5).
    // Token B is default 5x5' at top-left (100,0) -> center (102.5, 2.5).
    // Center distance = 102.5 - 5 = 97.5; reach = (5 + 2.5)/2 = 3.75; distance = 93.75.
    const aFootprint = { halfWidth: 5, halfLength: 2.5 };
    const bFootprint = { halfWidth: 2.5, halfLength: 2.5 };
    expect(tokenDistanceFt(0, 0, 100, 0, aFootprint, bFootprint)).toBeCloseTo(93.75, 10);
  });

  it('clamps to 0 for overlapping tokens', () => {
    expect(tokenDistanceFt(0, 0, 0, 0)).toBe(0);
  });
});

describe('tokenDistanceFtForElements', () => {
  it('matches tokenDistanceFt with default footprints for default-sized elements', () => {
    const a = { tokenX: 0, tokenY: 0 };
    const b = { tokenX: 100, tokenY: 0 };
    expect(tokenDistanceFtForElements(a, b)).toBeCloseTo(tokenDistanceFt(0, 0, 100, 0), 10);
  });

  it('uses each element\'s tokenSizeWidth/tokenSizeLength', () => {
    const a = { tokenX: 0, tokenY: 0, tokenSizeWidth: 2, tokenSizeLength: 1 };
    const b = { tokenX: 100, tokenY: 0 };
    // a's footprint = {halfWidth: 5, halfLength: 2.5} -> center (5, 2.5); b's center (102.5, 2.5).
    // Center distance = 97.5; reach = (5+2.5)/2 = 3.75; distance = 93.75.
    expect(tokenDistanceFtForElements(a, b)).toBeCloseTo(93.75, 10);
  });

  it('reads altitude from each element', () => {
    const a = { tokenX: 0, tokenY: 0, altitude: 0 };
    const b = { tokenX: 4, tokenY: 0, altitude: 60 };
    const planar = tokenDistanceFt(0, 0, 4, 0);
    expect(tokenDistanceFtForElements(a, b)).toBeCloseTo(Math.sqrt(planar * planar + 60 * 60), 5);
  });
});

describe('tokenDistanceFt altitude (sphere)', () => {
  it('is unchanged when both altitudes are equal (including the implicit 0 default)', () => {
    const planar = tokenDistanceFt(0, 0, 100, 0);
    expect(tokenDistanceFt(0, 0, 100, 0, undefined, undefined, 0, 0)).toBe(planar);
    expect(tokenDistanceFt(0, 0, 100, 0, undefined, undefined, 50, 50)).toBe(planar);
  });

  it('combines a Melee-range horizontal gap with a large altitude delta into a farther band', () => {
    // tokenX 4: centers 4' apart, nearest-edge 1.5' → Melee (≤5)
    const planar = tokenDistanceFt(0, 0, 4, 0);
    expect(planar).toBeLessThanOrEqual(RANGE_BANDS_FT.MELEE);
    const withAlt = tokenDistanceFt(0, 0, 4, 0, undefined, undefined, 0, 60);
    expect(withAlt).toBeCloseTo(Math.sqrt(planar * planar + 60 * 60), 5);
    expect(withAlt).toBeGreaterThan(RANGE_BANDS_FT.CLOSE);
    expect(withAlt).toBeLessThanOrEqual(RANGE_BANDS_FT.FAR);
  });

  it('treats negative altitude the same as a positive delta of the same magnitude', () => {
    const up = tokenDistanceFt(0, 0, 4, 0, undefined, undefined, 0, 20);
    const down = tokenDistanceFt(0, 0, 4, 0, undefined, undefined, 0, -20);
    expect(down).toBeCloseTo(up, 10);
  });
});

describe('pointToTokenDistanceFt (bullseye highlighting)', () => {
  it('matches tokenDistanceFt for two default-sized tokens (averaged reach equals one radius)', () => {
    // Bullseye at token A center (2.5, 2.5); token B top-left (100, 0).
    expect(pointToTokenDistanceFt(2.5, 2.5, 0, 100, 0)).toBeCloseTo(tokenDistanceFt(0, 0, 100, 0), 10);
  });

  it('subtracts only the target token reach (not averaged) for a wider token', () => {
    const wide = { halfWidth: 5, halfLength: 2.5 };
    // Point at (2.5, 2.5); token top-left (100, 0) → center (105, 2.5); dx=102.5; reach=5; dist=97.5
    expect(pointToTokenDistanceFt(2.5, 2.5, 0, 100, 0, wide)).toBeCloseTo(97.5, 10);
    expect(tokenDistanceFt(0, 0, 100, 0, undefined, wide)).toBeCloseTo(98.75, 10);
  });

  it('combines planar nearest-edge with altitude the same way highlighting does', () => {
    const planar = pointToTokenDistanceFt(2.5, 2.5, 0, 4, 0);
    const withAlt = pointToTokenDistanceFt(2.5, 2.5, 0, 4, 0, undefined, 60);
    expect(withAlt).toBeCloseTo(Math.sqrt(planar * planar + 60 * 60), 5);
  });

  it('pointToTokenCenterDistanceFt accepts a precomputed token center', () => {
    const fromTopLeft = pointToTokenDistanceFt(2.5, 2.5, 0, 100, 0);
    const fromCenter = pointToTokenCenterDistanceFt(2.5, 2.5, 0, 102.5, 2.5);
    expect(fromCenter).toBeCloseTo(fromTopLeft, 10);
  });
});

describe('formatRangeDistanceFt', () => {
  it('formats whole feet and one decimal', () => {
    expect(formatRangeDistanceFt(60)).toBe("60'");
    expect(formatRangeDistanceFt(97.5)).toBe("97.5'");
    expect(formatRangeDistanceFt(60.07)).toBe("60.1'");
  });

  it('treats invalid input as 0', () => {
    expect(formatRangeDistanceFt(undefined)).toBe("0'");
    expect(formatRangeDistanceFt(-4)).toBe("0'");
    expect(formatRangeDistanceFt(NaN)).toBe("0'");
  });
});

describe('pointNearSegmentTarget', () => {
  it('sits at the target when the segment has no length', () => {
    expect(pointNearSegmentTarget(10, 20, 10, 20)).toEqual({ x: 10, y: 20 });
  });

  it('insets from the target toward the origin on a long segment', () => {
    const p = pointNearSegmentTarget(0, 0, 200, 0, 28);
    expect(p.x).toBeCloseTo(172, 10);
    expect(p.y).toBeCloseTo(0, 10);
    expect(p.x).toBeGreaterThan(100);
  });

  it('stays on the target half of a short segment', () => {
    const p = pointNearSegmentTarget(0, 0, 40, 0, BULLSEYE_CONNECTOR_LABEL_INSET_PX);
    expect(p.x).toBeCloseTo(40 - 40 * 0.35, 10);
    expect(p.x).toBeGreaterThan(20);
  });

  it('flips to the far side of the other token when the near placement would sit on the bullseye token', () => {
    const p = pointNearSegmentTarget(0, 0, 30, 0, {
      insetPx: 28,
      originRadiusPx: 16,
      labelHalfW: 16,
      labelHalfH: 7,
    });
    expect(p.x).toBeGreaterThan(30);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('keeps the near-target placement when the bullseye token is far from the label', () => {
    const p = pointNearSegmentTarget(0, 0, 200, 0, {
      insetPx: 28,
      originRadiusPx: 16,
      labelHalfW: 16,
      labelHalfH: 7,
    });
    expect(p.x).toBeCloseTo(172, 10);
  });
});

describe('collectBullseyeAltitudeConnectors', () => {
  const footprint = { halfWidth: 2.5, halfLength: 2.5 };
  const getFootprint = () => footprint;
  const hovered = {
    instanceId: 'a',
    tokenX: 0,
    tokenY: 0,
    altitude: 0,
  };
  const center = {
    x: 2.5,
    y: 2.5,
    altitude: 0,
    excludeInstanceId: 'a',
  };

  it('returns [] unless the bullseye is snapped to a token', () => {
    const other = { instanceId: 'b', tokenX: 50, tokenY: 0, altitude: 20 };
    expect(collectBullseyeAltitudeConnectors(null, [hovered, other], getFootprint)).toEqual([]);
    expect(collectBullseyeAltitudeConnectors({ x: 10, y: 10, altitude: 0 }, [hovered, other], getFootprint)).toEqual([]);
  });

  it('skips tokens at the same altitude and the hovered token itself', () => {
    const sameAlt = { instanceId: 'b', tokenX: 50, tokenY: 0, altitude: 0 };
    expect(collectBullseyeAltitudeConnectors(center, [
      { element: hovered },
      { element: sameAlt },
    ], getFootprint)).toEqual([]);
  });

  it('draws a connector to another token at a different altitude using highlighting distance', () => {
    const other = { instanceId: 'b', tokenX: 50, tokenY: 0, altitude: 60 };
    const [link] = collectBullseyeAltitudeConnectors(center, [
      { element: hovered },
      { element: other },
    ], getFootprint);
    expect(link.instanceId).toBe('b');
    expect(link.x1).toBe(2.5);
    expect(link.y1).toBe(2.5);
    expect(link.x2).toBe(52.5);
    expect(link.y2).toBe(2.5);
    expect(link.distanceFt).toBeCloseTo(
      pointToTokenDistanceFt(2.5, 2.5, 0, 50, 0, footprint, 60),
      10,
    );
    expect(link.rangeBandIndex).toBe(getRangeBandIndexForDistanceFt(link.distanceFt));
  });

  it('colors the connector from the target token range-band highlight', () => {
    const other = { instanceId: 'b', tokenX: 50, tokenY: 0, altitude: 60 };
    const [link] = collectBullseyeAltitudeConnectors(center, [
      { element: hovered },
      { element: other },
    ], getFootprint);
    const colors = rangeBandConnectorColors(link.rangeBandIndex);
    const band = RANGE_BANDS_ORDERED[link.rangeBandIndex];
    expect(link.rangeBandIndex).toBeGreaterThanOrEqual(0);
    expect(colors.line).toBe(band.tokenGlow);
    expect(colors.text).toBe(band.tokenRing);
    expect(colors.boxStroke).toBe(band.ringColor);
  });

  it('skips unplaced tokens', () => {
    const unplaced = { instanceId: 'b', tokenX: null, tokenY: null, altitude: 40 };
    expect(collectBullseyeAltitudeConnectors(center, [hovered, unplaced], getFootprint)).toEqual([]);
  });
});

describe('rangeBandConnectorColors', () => {
  it('uses the same glow as the target token range highlight for each band', () => {
    for (let i = 0; i < RANGE_BANDS_ORDERED.length; i++) {
      const colors = rangeBandConnectorColors(i);
      expect(colors.line).toBe(RANGE_BANDS_ORDERED[i].tokenGlow);
      expect(colors.text).toBe(RANGE_BANDS_ORDERED[i].tokenRing);
      expect(colors.boxStroke).toBe(RANGE_BANDS_ORDERED[i].ringColor);
    }
  });

  it('does not reuse Melee green for a Far-range target', () => {
    const melee = rangeBandConnectorColors(0);
    const far = rangeBandConnectorColors(3);
    expect(far.line).not.toBe(melee.line);
    expect(far.line).toBe(RANGE_BANDS_ORDERED[3].tokenGlow);
  });

  it('falls back to a muted stroke beyond Very Far', () => {
    const colors = rangeBandConnectorColors(-1);
    expect(colors.line).not.toBe(RANGE_BANDS_ORDERED[0].tokenGlow);
    expect(colors.line).toMatch(/226,\s*232,\s*240/);
  });
});

describe('positionAtDistanceFt', () => {
  it('reproduces default-token behavior when footprints are omitted', () => {
    const pos = positionAtDistanceFt(0, 0, 10, 0, 50);
    // A center (2.5,2.5); direction toward B is +X; new center at (52.5, 2.5); top-left = (50, 0)
    expect(pos.x).toBeCloseTo(50, 10);
    expect(pos.y).toBeCloseTo(0, 10);
  });

  it('converts the new center back to top-left using the target\'s own footprint', () => {
    // A default footprint (2.5/2.5) at (0,0) -> center (2.5, 2.5).
    // B footprint halfLength matches A's (2.5) so the direction stays pure +X; halfWidth is 5.
    const bFootprint = { halfWidth: 5, halfLength: 2.5 };
    const pos = positionAtDistanceFt(0, 0, 10, 0, 50, undefined, bFootprint);
    // B's center at (10+5, 0+2.5) = (15, 2.5); direction from A center (2.5,2.5) is pure +X.
    // New center = (2.5+50, 2.5) = (52.5, 2.5); top-left = center - bFootprint = (47.5, 0).
    expect(pos.x).toBeCloseTo(47.5, 10);
    expect(pos.y).toBeCloseTo(0, 10);
  });
});

describe('getCharactersWithinFarRange', () => {
  const source = {
    instanceId: 'src',
    elementType: 'character',
    name: 'Source',
    tokenX: 0,
    tokenY: 0,
  };

  it('excludes the source character itself', () => {
    const elements = [source];
    expect(getCharactersWithinFarRange(elements, 'src')).toEqual([]);
  });

  it('includes a character whose nearest-edge distance is within FAR_RANGE_FT (100\')', () => {
    // Place target 50' to the right — nearest-edge = 50 - 2.5 = 47.5, well within Far
    const nearby = { instanceId: 't1', elementType: 'character', name: 'Nearby', tokenX: 50, tokenY: 0 };
    const result = getCharactersWithinFarRange([source, nearby], 'src');
    expect(result).toEqual([{ instanceId: 't1', name: 'Nearby' }]);
  });

  it('excludes a character beyond FAR_RANGE_FT (100\')', () => {
    // tokenX: 105 → center 107.5, center-to-center 107.5, nearest-edge 105 > 100
    const farAway = { instanceId: 't2', elementType: 'character', name: 'Far Away', tokenX: 105, tokenY: 0 };
    const result = getCharactersWithinFarRange([source, farAway], 'src');
    expect(result).toEqual([]);
  });

  it('includes a character at exactly FAR_RANGE_FT nearest-edge', () => {
    // nearest-edge = tokenX - 2.5 = 100 → tokenX = 102.5
    const atEdge = { instanceId: 't3', elementType: 'character', name: 'At Edge', tokenX: 102.5, tokenY: 0 };
    const result = getCharactersWithinFarRange([source, atEdge], 'src');
    expect(result).toEqual([{ instanceId: 't3', name: 'At Edge' }]);
  });

  it('excludes characters in the tray (tokenX or tokenY null)', () => {
    const inTray = { instanceId: 't4', elementType: 'character', name: 'In Tray', tokenX: null, tokenY: null };
    const result = getCharactersWithinFarRange([source, inTray], 'src');
    expect(result).toEqual([]);
  });

  it('excludes non-character elements', () => {
    const adversary = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 10, tokenY: 0 };
    const result = getCharactersWithinFarRange([source, adversary], 'src');
    expect(result).toEqual([]);
  });

  it('returns [] when source is not on the map', () => {
    const offMap = { ...source, tokenX: null, tokenY: null };
    const nearby = { instanceId: 't1', elementType: 'character', name: 'Nearby', tokenX: 0, tokenY: 0 };
    const result = getCharactersWithinFarRange([offMap, nearby], 'src');
    expect(result).toEqual([]);
  });

  it('returns [] when source is not found', () => {
    const nearby = { instanceId: 't1', elementType: 'character', name: 'Nearby', tokenX: 0, tokenY: 0 };
    const result = getCharactersWithinFarRange([nearby], 'missing-id');
    expect(result).toEqual([]);
  });

  it('returns multiple characters within range, excluding those beyond', () => {
    const close = { instanceId: 't1', elementType: 'character', name: 'Close', tokenX: 20, tokenY: 0 };
    const medium = { instanceId: 't2', elementType: 'character', name: 'Medium', tokenX: 60, tokenY: 0 };
    const farAway = { instanceId: 't3', elementType: 'character', name: 'Far Away', tokenX: 110, tokenY: 0 };
    const result = getCharactersWithinFarRange([source, close, medium, farAway], 'src');
    expect(result).toHaveLength(2);
    expect(result.map(r => r.instanceId)).toContain('t1');
    expect(result.map(r => r.instanceId)).toContain('t2');
    expect(result.map(r => r.instanceId)).not.toContain('t3');
  });
});

describe('FAR_RANGE_FT', () => {
  it('equals 100', () => {
    expect(FAR_RANGE_FT).toBe(100);
  });
});

describe('getCharactersWithinCloseRangeWithMarkedHp', () => {
  const source = {
    instanceId: 'src',
    elementType: 'character',
    name: 'Source',
    tokenX: 0,
    tokenY: 0,
  };

  it('returns [] when source is not on the map', () => {
    const offMap = { ...source, tokenX: null, tokenY: null };
    const wounded = { instanceId: 't1', elementType: 'character', name: 'Wounded', tokenX: 10, tokenY: 0, currentHp: 2, maxHp: 4 };
    expect(getCharactersWithinCloseRangeWithMarkedHp([offMap, wounded], 'src')).toEqual([]);
  });

  it('includes only characters within Close range (30\') with at least one marked HP', () => {
    const wounded = { instanceId: 't1', elementType: 'character', name: 'Wounded', tokenX: 10, tokenY: 0, currentHp: 2, maxHp: 4 };
    const fullHp = { instanceId: 't2', elementType: 'character', name: 'Full', tokenX: 15, tokenY: 0, currentHp: 5, maxHp: 5 };
    const result = getCharactersWithinCloseRangeWithMarkedHp([source, wounded, fullHp], 'src');
    expect(result).toEqual([{ instanceId: 't1', name: 'Wounded' }]);
  });

  it('excludes characters beyond Close range', () => {
    const woundedFar = { instanceId: 't1', elementType: 'character', name: 'Wounded Far', tokenX: 35, tokenY: 0, currentHp: 1, maxHp: 4 };
    const result = getCharactersWithinCloseRangeWithMarkedHp([source, woundedFar], 'src');
    expect(result).toEqual([]);
  });

  it('excludes the source character', () => {
    const woundedSource = { ...source, currentHp: 2, maxHp: 4 };
    const result = getCharactersWithinCloseRangeWithMarkedHp([woundedSource], 'src');
    expect(result).toEqual([]);
  });

  it('treats missing currentHp as full HP (no marked HP)', () => {
    const noHp = { instanceId: 't1', elementType: 'character', name: 'No Hp Field', tokenX: 10, tokenY: 0, maxHp: 4 };
    const result = getCharactersWithinCloseRangeWithMarkedHp([source, noHp], 'src');
    expect(result).toEqual([]);
  });

  it('CLOSE_RANGE_FT equals 30', () => {
    expect(CLOSE_RANGE_FT).toBe(30);
  });
});

describe('getAdversariesWithinMeleeRange', () => {
  const source = {
    instanceId: 'src',
    elementType: 'character',
    name: 'Source',
    tokenX: 0,
    tokenY: 0,
  };

  it('returns adversaries within Melee (5\') of the source', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 4, tokenY: 0 };
    const result = getAdversariesWithinMeleeRange([source, adv], 'src');
    expect(result).toEqual([{ instanceId: 'adv1', name: 'Goblin' }]);
  });

  it('excludes adversaries beyond Melee range', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 15, tokenY: 0 };
    const result = getAdversariesWithinMeleeRange([source, adv], 'src');
    expect(result).toEqual([]);
  });

  it('excludes adversaries in the tray (tokenX null)', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: null, tokenY: null };
    const result = getAdversariesWithinMeleeRange([source, adv], 'src');
    expect(result).toEqual([]);
  });

  it('returns [] when source is not on the map', () => {
    const offMap = { ...source, tokenX: null, tokenY: null };
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 0, tokenY: 0 };
    const result = getAdversariesWithinMeleeRange([offMap, adv], 'src');
    expect(result).toEqual([]);
  });

  it('uses RANGE_BANDS_FT.MELEE (5\')', () => {
    expect(RANGE_BANDS_FT.MELEE).toBe(5);
  });
});

describe('rangeBandNameToFt', () => {
  it('maps each Daggerheart range band name to max feet', () => {
    expect(rangeBandNameToFt('Melee')).toBe(RANGE_BANDS_FT.MELEE);
    expect(rangeBandNameToFt('Very Close')).toBe(RANGE_BANDS_FT.VERY_CLOSE);
    expect(rangeBandNameToFt('Close')).toBe(RANGE_BANDS_FT.CLOSE);
    expect(rangeBandNameToFt('Far')).toBe(RANGE_BANDS_FT.FAR);
    expect(rangeBandNameToFt('Very Far')).toBe(RANGE_BANDS_FT.VERY_FAR);
  });

  it('is case-insensitive', () => {
    expect(rangeBandNameToFt('MELEE')).toBe(5);
    expect(rangeBandNameToFt('far')).toBe(100);
    expect(rangeBandNameToFt('Very close')).toBe(10);
  });

  it('returns undefined for unknown or empty input', () => {
    expect(rangeBandNameToFt('')).toBeUndefined();
    expect(rangeBandNameToFt('   ')).toBeUndefined();
    expect(rangeBandNameToFt('Ranged')).toBeUndefined();
    expect(rangeBandNameToFt(null)).toBeUndefined();
    expect(rangeBandNameToFt(undefined)).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(rangeBandNameToFt('  Melee  ')).toBe(5);
  });
});

describe('getAdversariesWithinRangeFt', () => {
  const source = {
    instanceId: 'src',
    elementType: 'character',
    name: 'Source',
    tokenX: 0,
    tokenY: 0,
  };

  it('returns adversaries within the given max feet (e.g. Close = 30)', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 25, tokenY: 0 };
    const result = getAdversariesWithinRangeFt([source, adv], 'src', 30);
    expect(result).toEqual([{ instanceId: 'adv1', name: 'Goblin' }]);
  });

  it('excludes adversaries beyond maxFt', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 40, tokenY: 0 };
    const result = getAdversariesWithinRangeFt([source, adv], 'src', 30);
    expect(result).toEqual([]);
  });

  it('includes adversaries at exactly maxFt nearest-edge', () => {
    // nearest-edge 30 → tokenX = 32.5
    const atEdge = { instanceId: 'adv1', elementType: 'adversary', name: 'At Edge', tokenX: 32.5, tokenY: 0 };
    const result = getAdversariesWithinRangeFt([source, atEdge], 'src', 30);
    expect(result).toEqual([{ instanceId: 'adv1', name: 'At Edge' }]);
  });

  it('returns [] when source is not on the map', () => {
    const offMap = { ...source, tokenX: null, tokenY: null };
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 0, tokenY: 0 };
    const result = getAdversariesWithinRangeFt([offMap, adv], 'src', 30);
    expect(result).toEqual([]);
  });

  it('excludes reserved minPartySize adversaries', () => {
    const reserved = { instanceId: 'adv1', elementType: 'adversary', name: 'Reaper', tokenX: 0, tokenY: 0, minPartySize: 5 };
    expect(getAdversariesWithinRangeFt([source, reserved], 'src', 30)).toEqual([]);
    const chars = [
      source,
      { instanceId: 'c2', elementType: 'character', tokenX: 1, tokenY: 1 },
      { instanceId: 'c3', elementType: 'character', tokenX: 2, tokenY: 2 },
      { instanceId: 'c4', elementType: 'character', tokenX: 3, tokenY: 3 },
      { instanceId: 'c5', elementType: 'character', tokenX: 4, tokenY: 4 },
      reserved,
    ];
    expect(getAdversariesWithinRangeFt(chars, 'src', 30)).toEqual([{ instanceId: 'adv1', name: 'Reaper' }]);
  });

  it('returns [] when maxFt is invalid (negative or non-number)', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 0, tokenY: 0 };
    expect(getAdversariesWithinRangeFt([source, adv], 'src', -1)).toEqual([]);
    expect(getAdversariesWithinRangeFt([source, adv], 'src', NaN)).toEqual([]);
  });
});
