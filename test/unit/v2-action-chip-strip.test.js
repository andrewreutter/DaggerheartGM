import { describe, expect, it } from 'vitest';
import {
  entryHasUnusableActionChipsForSheet,
  hasAnyUnusableActionChipsForSheet,
  shouldMoveV2ActionChipToUnusableSubsection,
  shouldUseIntrinsicWidthForActionsStripSlot,
} from '../../src/client/lib/v2-action-chip-strip.js';

describe('shouldMoveV2ActionChipToUnusableSubsection', () => {
  it('is true when used this cycle', () => {
    expect(
      shouldMoveV2ActionChipToUnusableSubsection({ usedThisCycle: true, resourceUnaffordable: false }),
    ).toBe(true);
  });
  it('is true when resource costs cannot be paid', () => {
    expect(
      shouldMoveV2ActionChipToUnusableSubsection({ usedThisCycle: false, resourceUnaffordable: true }),
    ).toBe(true);
  });
  it('is false when neither applies', () => {
    expect(
      shouldMoveV2ActionChipToUnusableSubsection({
        usedThisCycle: false,
        resourceUnaffordable: false,
        logicDisabled: false,
      }),
    ).toBe(false);
  });
  it('is true when logic-disabled / inapplicable', () => {
    expect(
      shouldMoveV2ActionChipToUnusableSubsection({
        usedThisCycle: false,
        resourceUnaffordable: false,
        logicDisabled: true,
      }),
    ).toBe(true);
  });
});

describe('shouldUseIntrinsicWidthForActionsStripSlot', () => {
  it('is true for sheet active and unusable subsections (matching segmented chip width)', () => {
    expect(shouldUseIntrinsicWidthForActionsStripSlot('activeOnly')).toBe(true);
    expect(shouldUseIntrinsicWidthForActionsStripSlot('unusableOnly')).toBe(true);
  });
  it('is false for full strip mode (expanded card / non-sheet)', () => {
    expect(shouldUseIntrinsicWidthForActionsStripSlot('full')).toBe(false);
  });
});

describe('hasAnyUnusableActionChipsForSheet', () => {
  it('is false for empty entries', () => {
    expect(hasAnyUnusableActionChipsForSheet([], {}, {})).toBe(false);
  });
  it('delegates to entry helper', () => {
    const entry = { key: 'K', row: { name: 'X' } };
    expect(entryHasUnusableActionChipsForSheet(entry, {}, {})).toBe(
      hasAnyUnusableActionChipsForSheet([entry], {}, {}),
    );
  });
});
