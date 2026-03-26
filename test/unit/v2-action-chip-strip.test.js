import { describe, expect, it } from 'vitest';
import {
  entryHasUnusableActionChipsForSheet,
  hasAnyUnusableActionChipsForSheet,
  shouldMoveV2ActionChipToUnusableSubsection,
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
      shouldMoveV2ActionChipToUnusableSubsection({ usedThisCycle: false, resourceUnaffordable: false }),
    ).toBe(false);
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
