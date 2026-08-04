import { describe, it, expect } from 'vitest';
import { MANUAL_DICE_SIZES, buildManualRollText, buildPreviewGroups } from '../../src/client/lib/manual-dice-roll-text.js';

describe('manual-dice-roll-text', () => {
  it('includes d4 in the Action Log builder', () => {
    expect(MANUAL_DICE_SIZES).toContain(4);
    expect(MANUAL_DICE_SIZES[0]).toBe(4);
  });

  it('buildManualRollText emits bracket notation for extra dice', () => {
    const empty = Object.fromEntries(MANUAL_DICE_SIZES.map((s) => [s, 0]));
    expect(buildManualRollText(false, { ...empty, 4: 2 })).toBe('[2d4]');
    expect(buildManualRollText(true, { ...empty, 6: 1 })).toMatch(/^Hope \[d12\] Fear \[d12\]/);
  });

  describe('buildManualRollText modifier', () => {
    const empty = Object.fromEntries(MANUAL_DICE_SIZES.map((s) => [s, 0]));

    it('omits the modifier bracket when 0 or unspecified', () => {
      expect(buildManualRollText(false, { ...empty, 6: 2 })).toBe('[2d6]');
      expect(buildManualRollText(false, { ...empty, 6: 2 }, 0)).toBe('[2d6]');
    });

    it('appends a labeled positive modifier bracket after the dice', () => {
      expect(buildManualRollText(false, { ...empty, 6: 2 }, 3)).toBe('[2d6] Modifier [3]');
    });

    it('appends a negative modifier bracket', () => {
      expect(buildManualRollText(false, { ...empty, 6: 2 }, -2)).toBe('[2d6] Modifier [-2]');
    });

    it('supports a modifier with duality on and no size dice', () => {
      expect(buildManualRollText(true, empty, 5)).toBe('Hope [d12] Fear [d12] Modifier [5]');
    });

    it('supports a modifier with no dice or duality at all', () => {
      expect(buildManualRollText(false, empty, 4)).toBe('Modifier [4]');
    });
  });

  describe('buildPreviewGroups', () => {
    const empty = Object.fromEntries(MANUAL_DICE_SIZES.map((s) => [s, 0]));

    it('returns an empty array when duality is off and all counts are zero', () => {
      expect(buildPreviewGroups(false, empty, 8)).toEqual([]);
    });

    it('includes a Hope d12 and a Fear d12 group when duality is on', () => {
      const groups = buildPreviewGroups(true, empty, 8);
      expect(groups).toEqual([
        { label: 'Hope', qty: 1, sides: 12 },
        { label: 'Fear', qty: 1, sides: 12 },
      ]);
    });

    it('omits the duality groups when duality is off', () => {
      const groups = buildPreviewGroups(false, { ...empty, 6: 3 }, 8);
      expect(groups.some((g) => g.label === 'Hope' || g.label === 'Fear')).toBe(false);
    });

    it('includes one group per non-zero size, in MANUAL_DICE_SIZES order', () => {
      const groups = buildPreviewGroups(false, { ...empty, 4: 2, 20: 1 }, 8);
      expect(groups).toEqual([
        { label: null, qty: 2, sides: 4 },
        { label: null, qty: 1, sides: 20 },
      ]);
    });

    it('caps a size group qty at the given cap without affecting others', () => {
      const groups = buildPreviewGroups(false, { ...empty, 6: 99, 8: 3 }, 8);
      expect(groups).toEqual([
        { label: null, qty: 8, sides: 6 },
        { label: null, qty: 3, sides: 8 },
      ]);
    });

    it('combines duality inclusion and cap behavior together', () => {
      const groups = buildPreviewGroups(true, { ...empty, 10: 50 }, 5);
      expect(groups).toEqual([
        { label: 'Hope', qty: 1, sides: 12 },
        { label: 'Fear', qty: 1, sides: 12 },
        { label: null, qty: 5, sides: 10 },
      ]);
    });
  });
});
