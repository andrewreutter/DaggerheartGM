import { describe, expect, it } from 'vitest';
import {
  sortIndicesByDescendingWidth,
  sortIndicesByDescendingWidthTwoKey,
  measureSortWidthForNode,
} from '../../src/client/components/WidthSortedFlexWrap.jsx';

describe('sortIndicesByDescendingWidth', () => {
  it('orders widest first', () => {
    expect(sortIndicesByDescendingWidth([10, 30, 20])).toEqual([1, 2, 0]);
  });

  it('is stable when widths tie (keeps lower index first)', () => {
    expect(sortIndicesByDescendingWidth([20, 20, 10])).toEqual([0, 1, 2]);
  });
});

describe('sortIndicesByDescendingWidthTwoKey', () => {
  it('breaks primary ties with secondary (descending)', () => {
    expect(sortIndicesByDescendingWidthTwoKey([100, 100, 50], [80, 200, 20])).toEqual([1, 0, 2]);
  });
});

describe('measureSortWidthForNode', () => {
  it('uses max button width when present', () => {
    const btn = { getBoundingClientRect: () => ({ width: 120 }) };
    const wrap = {
      getBoundingClientRect: () => ({ width: 400 }),
      querySelectorAll(sel) {
        if (sel === 'button') return [btn];
        if (sel === '[data-v2-seg-btn]') return [];
        return [];
      },
    };
    expect(measureSortWidthForNode(wrap)).toBe(120);
  });

  it('falls back to outer width when no interactive controls', () => {
    const wrap = {
      getBoundingClientRect: () => ({ width: 88 }),
      querySelectorAll: () => [],
    };
    expect(measureSortWidthForNode(wrap)).toBe(88);
  });
});
