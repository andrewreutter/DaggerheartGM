import { describe, it, expect } from 'vitest';
import {
  distancePcToAdversaryFt,
  weaponMaxRangeFt,
  selectTargetsIncludesAdversary,
  safeSelectTargets,
  applySelectTargetsAdversaryGate,
  formatAdversaryPinRangeLabel,
} from '../../src/client/lib/player-adversary-target-aid.js';

describe('distancePcToAdversaryFt', () => {
  it('returns null when tokens are on different map planes', () => {
    const pc = { tokenX: 0, tokenY: 0, mapId: 'm1' };
    const adv = { tokenX: 10, tokenY: 0, mapId: 'm2' };
    expect(distancePcToAdversaryFt(pc, adv)).toBeNull();
  });

  it('returns null when either token coordinates are missing', () => {
    const placed = { tokenX: 0, tokenY: 0, mapId: null };
    const adv = { tokenX: 10, tokenY: 0, mapId: null };
    expect(distancePcToAdversaryFt({ tokenX: null, tokenY: 0, mapId: null }, adv)).toBeNull();
    expect(distancePcToAdversaryFt(placed, { tokenX: 10, tokenY: null, mapId: null })).toBeNull();
  });

  it('returns nearest-edge distance when comparable', () => {
    const pc = { tokenX: 0, tokenY: 0, mapId: 'm1' };
    const adv = { tokenX: 100, tokenY: 0, mapId: 'm1' };
    expect(distancePcToAdversaryFt(pc, adv)).toBeCloseTo(97.5, 5);
  });
});

describe('weaponMaxRangeFt', () => {
  it('returns undefined for bad input', () => {
    expect(weaponMaxRangeFt(null, [])).toBeUndefined();
    expect(weaponMaxRangeFt({ range: null }, [])).toBeUndefined();
  });

  it('reads range from effective range / range string', () => {
    expect(weaponMaxRangeFt({ range: 'Melee' }, [])).toBe(5);
    expect(weaponMaxRangeFt({ range: 'Far' }, [])).toBe(100);
  });
});

describe('selectTargetsIncludesAdversary', () => {
  it('matches instanceId on targets', () => {
    expect(selectTargetsIncludesAdversary([{ instanceId: 'a1' }], 'a1')).toBe(true);
    expect(selectTargetsIncludesAdversary([{ id: 'a1' }], 'a1')).toBe(true);
    expect(selectTargetsIncludesAdversary([{ instanceId: 'x' }], 'a1')).toBe(false);
  });

  it('returns false for empty or missing adversary id', () => {
    expect(selectTargetsIncludesAdversary([], 'a1')).toBe(false);
    expect(selectTargetsIncludesAdversary([{ instanceId: 'a1' }], null)).toBe(false);
  });
});

describe('safeSelectTargets', () => {
  it('returns array from selectTargets', () => {
    const chip = { selectTargets: () => [{ instanceId: 'x' }] };
    expect(safeSelectTargets(chip, {})).toEqual([{ instanceId: 'x' }]);
  });

  it('returns [] on throw or non-array', () => {
    expect(safeSelectTargets({ selectTargets: () => { throw new Error('x'); } }, {})).toEqual([]);
    expect(safeSelectTargets({ selectTargets: () => 'nope' }, {})).toEqual([]);
    expect(safeSelectTargets({}, {})).toEqual([]);
  });
});

describe('formatAdversaryPinRangeLabel', () => {
  it('returns unknown range when distance is not a number', () => {
    expect(formatAdversaryPinRangeLabel(null)).toBe('unknown range');
    expect(formatAdversaryPinRangeLabel(undefined)).toBe('unknown range');
  });

  it('returns a band name for standard distances', () => {
    expect(formatAdversaryPinRangeLabel(2)).toBe('Melee');
    expect(formatAdversaryPinRangeLabel(50)).toBe('Far');
  });
});

describe('applySelectTargetsAdversaryGate', () => {
  it('returns slot unchanged when adversary is valid', () => {
    const slot = { moveToUnusable: false, primaryUnusableLine: 'Hope' };
    expect(applySelectTargetsAdversaryGate(slot, true)).toBe(slot);
  });

  it('forces unusable with merged line when invalid', () => {
    const slot = { moveToUnusable: false, primaryUnusableLine: 'Need 2 Hope' };
    const out = applySelectTargetsAdversaryGate(slot, false);
    expect(out.moveToUnusable).toBe(true);
    expect(out.primaryUnusableLine).toBe('Not a valid target — Need 2 Hope');
  });

  it('uses bare message when no prior line', () => {
    const out = applySelectTargetsAdversaryGate({ primaryUnusableLine: undefined }, false);
    expect(out.primaryUnusableLine).toBe('Not a valid target');
  });
});
