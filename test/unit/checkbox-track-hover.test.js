import { describe, expect, it } from 'vitest';
import {
  computeCheckboxTrackPreviewFilled,
  isCheckboxTrackPreviewSlotChanged,
} from '../../src/client/components/CheckboxTrack.jsx';

describe('computeCheckboxTrackPreviewFilled', () => {
  it('returns current filled when not hovering', () => {
    expect(computeCheckboxTrackPreviewFilled(4, null, 5)).toBe(4);
    expect(computeCheckboxTrackPreviewFilled(4, undefined, 5)).toBe(4);
  });

  it('decrease: 4 of 5 filled, hover third box (index 2) → preview 2 filled', () => {
    const filled = 4;
    const total = 5;
    expect(computeCheckboxTrackPreviewFilled(filled, 2, total)).toBe(2);
  });

  it('increase: 2 of 5 filled, hover fourth box (index 3) → preview 4 filled', () => {
    const filled = 2;
    const total = 5;
    expect(computeCheckboxTrackPreviewFilled(filled, 3, total)).toBe(4);
  });

  it('increase: 5 of 6 filled, hover last empty (index 5) → 6', () => {
    expect(computeCheckboxTrackPreviewFilled(5, 5, 6)).toBe(6);
  });

  it('increase: 5 filled of 6, hover indices 5–7 clamp to full', () => {
    const filled = 5;
    expect(computeCheckboxTrackPreviewFilled(filled, 5, 6)).toBe(6);
    expect(computeCheckboxTrackPreviewFilled(filled, 6, 6)).toBe(6);
    expect(computeCheckboxTrackPreviewFilled(filled, 7, 6)).toBe(6);
  });

  it('decrease: hover filled slots sets to that index', () => {
    expect(computeCheckboxTrackPreviewFilled(5, 4, 10)).toBe(4);
    expect(computeCheckboxTrackPreviewFilled(5, 3, 10)).toBe(3);
  });

  it('from zero: hover index 0 → 1 filled', () => {
    expect(computeCheckboxTrackPreviewFilled(0, 0, 5)).toBe(1);
  });

  it('clamps hover index to track bounds', () => {
    expect(computeCheckboxTrackPreviewFilled(3, -1, 5)).toBe(0);
    expect(computeCheckboxTrackPreviewFilled(3, 99, 5)).toBe(5);
  });
});

describe('isCheckboxTrackPreviewSlotChanged', () => {
  it('is false when preview count matches actual (no slot flips)', () => {
    for (let i = 0; i < 5; i++) {
      expect(isCheckboxTrackPreviewSlotChanged(i, 3, 3)).toBe(false);
    }
  });

  it('marks slots that flip when decreasing 4→2 of 5', () => {
    const filled = 4;
    const effective = 2;
    expect(isCheckboxTrackPreviewSlotChanged(0, filled, effective)).toBe(false);
    expect(isCheckboxTrackPreviewSlotChanged(1, filled, effective)).toBe(false);
    expect(isCheckboxTrackPreviewSlotChanged(2, filled, effective)).toBe(true);
    expect(isCheckboxTrackPreviewSlotChanged(3, filled, effective)).toBe(true);
    expect(isCheckboxTrackPreviewSlotChanged(4, filled, effective)).toBe(false);
  });

  it('marks slots that flip when increasing 2→4 of 5', () => {
    const filled = 2;
    const effective = 4;
    expect(isCheckboxTrackPreviewSlotChanged(0, filled, effective)).toBe(false);
    expect(isCheckboxTrackPreviewSlotChanged(1, filled, effective)).toBe(false);
    expect(isCheckboxTrackPreviewSlotChanged(2, filled, effective)).toBe(true);
    expect(isCheckboxTrackPreviewSlotChanged(3, filled, effective)).toBe(true);
    expect(isCheckboxTrackPreviewSlotChanged(4, filled, effective)).toBe(false);
  });
});
