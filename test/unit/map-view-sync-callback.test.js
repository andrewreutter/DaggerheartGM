import { describe, it, expect, vi } from 'vitest';
import { callLatestOnMapViewSync } from '../../src/client/lib/map-view-sync.js';

describe('callLatestOnMapViewSync', () => {
  it('invokes the current ref callback with encoded framing (latest closure wins)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const ref = { current: first };
    const encoded = {
      mapViewZoomRatio: 0.5,
      mapViewPanNorm: { x: 0.1, y: 0.2 },
      mapViewVisibleNorm: null,
    };
    callLatestOnMapViewSync(ref, encoded);
    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(0.5, { x: 0.1, y: 0.2 }, null);

    ref.current = second;
    callLatestOnMapViewSync(ref, {
      mapViewZoomRatio: 0.6,
      mapViewPanNorm: { x: 0.3, y: 0.4 },
      mapViewVisibleNorm: { x: 0, y: 0, w: 1, h: 1 },
    });
    expect(second).toHaveBeenCalledWith(0.6, { x: 0.3, y: 0.4 }, { x: 0, y: 0, w: 1, h: 1 });
  });

  it('no-ops when ref has no function', () => {
    expect(() =>
      callLatestOnMapViewSync(
        { current: null },
        { mapViewZoomRatio: null, mapViewPanNorm: null, mapViewVisibleNorm: null },
      ),
    ).not.toThrow();
  });
});
