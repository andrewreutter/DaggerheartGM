import { describe, expect, it } from 'vitest';
import {
  getSheetSourceChipPalette,
  intrinsicWidthActionsStripPalette,
} from '../../src/client/lib/sheet-source-chip-styles.js';

describe('intrinsicWidthActionsStripPalette', () => {
  it('replaces full-width group shells with intrinsic-width shells', () => {
    const p = getSheetSourceChipPalette('class');
    const i = intrinsicWidthActionsStripPalette(p);
    expect(i.groupOuter).not.toMatch(/\bflex w-full\b/);
    expect(i.groupOuter).toMatch(/flex w-auto max-w-full/);
    expect(i.segmentScrollOuter).toMatch(/flex w-auto max-w-full/);
  });
});
