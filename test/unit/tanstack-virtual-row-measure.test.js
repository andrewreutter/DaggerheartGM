import { describe, it, expect } from 'vitest';
import { Virtualizer } from '@tanstack/virtual-core';

/**
 * Library grid uses useVirtualizer with a fixed estimateSize (row height). TanStack Virtual's
 * internal measurement memo does not list estimateSize as a dependency; when row height changes
 * without a count change, rowVirtualizer.measure() must run or layout stays stale (gaps/overlaps).
 * @see LibraryView.jsx useLayoutEffect after useVirtualizer
 */
describe('TanStack Virtualizer fixed row height', () => {
  it('getTotalSize stays stale after estimateSize changes until measure()', () => {
    let rowHeight = 184;
    const scrollEl = {
      scrollHeight: 5000,
      clientHeight: 400,
      scrollTop: 0,
      scrollTo: () => {},
      ownerDocument: { defaultView: globalThis },
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    const observeElementRect = (instance, cb) => {
      cb({ width: 800, height: 400 });
      return () => {};
    };
    const observeElementOffset = (instance, cb) => {
      cb(0, false);
      return () => {};
    };

    const v = new Virtualizer({
      count: 4,
      getScrollElement: () => scrollEl,
      estimateSize: () => rowHeight,
      scrollToFn: () => {},
      observeElementRect,
      observeElementOffset,
      enabled: true,
      gap: 0,
    });
    v._didMount();
    v._willUpdate();

    const t1 = v.getTotalSize();
    rowHeight = 300;
    v.setOptions({
      ...v.options,
      estimateSize: () => rowHeight,
    });
    const t2WithoutMeasure = v.getTotalSize();
    v.measure();
    const t3 = v.getTotalSize();

    expect(t1).toBe(4 * 184);
    expect(t2WithoutMeasure).toBe(t1);
    expect(t3).toBe(4 * 300);
  });
});
