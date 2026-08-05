import { describe, it, expect } from 'vitest';
import {
  tokenDistanceFt,
  tokenDistanceFtForElements,
  positionAtDistanceFt,
  ellipseRadiusAtAngle,
  getTokenFootprintFt,
  getCharactersWithinFarRange,
  getCharactersWithinCloseRangeWithMarkedHp,
  getAdversariesWithinMeleeRange,
  getAdversariesWithinRangeFt,
  rangeBandNameToFt,
  RANGE_BANDS_FT,
  FAR_RANGE_FT,
  CLOSE_RANGE_FT,
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

  it('returns [] when maxFt is invalid (negative or non-number)', () => {
    const adv = { instanceId: 'adv1', elementType: 'adversary', name: 'Goblin', tokenX: 0, tokenY: 0 };
    expect(getAdversariesWithinRangeFt([source, adv], 'src', -1)).toEqual([]);
    expect(getAdversariesWithinRangeFt([source, adv], 'src', NaN)).toEqual([]);
  });
});
