import { describe, expect, it } from 'vitest';
import { groupButtonIndicesByRow } from '../../src/client/lib/v2-inline-select-ui.js';
import { mergeOptionAndFeatureTooltipMarkdown } from '../../src/client/lib/guide-feature-card-tip-text.js';

describe('mergeOptionAndFeatureTooltipMarkdown', () => {
  it('joins option and feature text when both present', () => {
    expect(mergeOptionAndFeatureTooltipMarkdown('Spend 1 Hope', 'Once per rest.')).toBe(
      'Spend 1 Hope\n\nOnce per rest.'
    );
  });

  it('returns whichever side is non-empty', () => {
    expect(mergeOptionAndFeatureTooltipMarkdown('', 'Feature body')).toBe('Feature body');
    expect(mergeOptionAndFeatureTooltipMarkdown('Option only', '')).toBe('Option only');
  });
});

describe('groupButtonIndicesByRow', () => {
  it('groups indices that share the same offsetTop (within one row)', () => {
    expect(groupButtonIndicesByRow([0, 0, 0])).toEqual([[0, 1, 2]]);
    expect(groupButtonIndicesByRow([10, 10, 40, 40])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('returns one index per row when tops differ', () => {
    expect(groupButtonIndicesByRow([0, 24, 48])).toEqual([[0], [1], [2]]);
  });

  it('returns empty for empty input', () => {
    expect(groupButtonIndicesByRow([])).toEqual([]);
  });
});
