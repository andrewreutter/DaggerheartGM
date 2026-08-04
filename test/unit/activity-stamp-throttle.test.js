/**
 * Unit tests for src/server/activity-stamp-throttle.js
 *
 * Tests the pure shouldSkipActivityStamp helper that guards lastPlayActivityAt
 * writes in applyOpToTableState.
 */
import { describe, it, expect } from 'vitest';
import { shouldSkipActivityStamp, ACTIVITY_STAMP_THROTTLE_MS } from '../../src/server/activity-stamp-throttle.js';

describe('shouldSkipActivityStamp', () => {
  it('returns false when lastPlayActivityAt is undefined', () => {
    expect(shouldSkipActivityStamp(undefined)).toBe(false);
  });

  it('returns false when lastPlayActivityAt is null', () => {
    expect(shouldSkipActivityStamp(null)).toBe(false);
  });

  it('returns false when lastPlayActivityAt is not a number', () => {
    expect(shouldSkipActivityStamp('2024-01-01')).toBe(false);
    expect(shouldSkipActivityStamp({})).toBe(false);
  });

  it('returns true when timestamp is very recent (0 ms ago)', () => {
    const now = Date.now();
    expect(shouldSkipActivityStamp(now, now)).toBe(true);
  });

  it('returns true when timestamp is within the throttle window', () => {
    const now = Date.now();
    const recentTs = now - (ACTIVITY_STAMP_THROTTLE_MS - 1);
    expect(shouldSkipActivityStamp(recentTs, now)).toBe(true);
  });

  it('returns false when timestamp is exactly at the throttle boundary', () => {
    const now = Date.now();
    const oldTs = now - ACTIVITY_STAMP_THROTTLE_MS;
    expect(shouldSkipActivityStamp(oldTs, now)).toBe(false);
  });

  it('returns false when timestamp is older than the throttle window', () => {
    const now = Date.now();
    const oldTs = now - (ACTIVITY_STAMP_THROTTLE_MS + 5000);
    expect(shouldSkipActivityStamp(oldTs, now)).toBe(false);
  });

  it('accepts a custom throttleMs override', () => {
    const now = Date.now();
    const ts = now - 5000; // 5 seconds ago
    expect(shouldSkipActivityStamp(ts, now, 10_000)).toBe(true);  // 10s window → still fresh
    expect(shouldSkipActivityStamp(ts, now, 1_000)).toBe(false);  // 1s window → stale
  });
});
