import { describe, it, expect } from 'vitest';
import { MANUAL_DICE_SIZES, buildManualRollText } from '../../src/client/lib/manual-dice-roll-text.js';

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
});
