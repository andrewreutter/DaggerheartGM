// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  APP_BUILD_CHECK_EVENT,
  isAppBuildStale,
  shouldShowNewVersionBanner,
  notifyAppBuildCheck,
  attachSseAppBuildCheck,
} from '../../src/client/lib/app-build-check.js';

describe('isAppBuildStale', () => {
  it('is false when either id is missing', () => {
    expect(isAppBuildStale(null, 'abc')).toBe(false);
    expect(isAppBuildStale('abc', null)).toBe(false);
    expect(isAppBuildStale('', 'abc')).toBe(false);
    expect(isAppBuildStale('abc', '')).toBe(false);
  });

  it('is false when ids match and true when they differ', () => {
    expect(isAppBuildStale('abc', 'abc')).toBe(false);
    expect(isAppBuildStale('abc', 'def')).toBe(true);
  });
});

describe('shouldShowNewVersionBanner', () => {
  it('is false when the build is current or the new id was dismissed', () => {
    expect(shouldShowNewVersionBanner({ currentBuildId: 'a', serverBuildId: 'a' })).toBe(false);
    expect(shouldShowNewVersionBanner({
      currentBuildId: 'a',
      serverBuildId: 'b',
      dismissedBuildId: 'b',
    })).toBe(false);
  });

  it('is true for a new server id that has not been dismissed', () => {
    expect(shouldShowNewVersionBanner({
      currentBuildId: 'a',
      serverBuildId: 'b',
      dismissedBuildId: 'a',
    })).toBe(true);
    expect(shouldShowNewVersionBanner({ currentBuildId: 'a', serverBuildId: 'b' })).toBe(true);
  });
});

describe('notifyAppBuildCheck / attachSseAppBuildCheck', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches the window event', () => {
    const spy = vi.fn();
    window.addEventListener(APP_BUILD_CHECK_EVENT, spy);
    notifyAppBuildCheck();
    window.removeEventListener(APP_BUILD_CHECK_EVENT, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('subscribes to EventSource open', () => {
    const listeners = {};
    const es = {
      addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    };
    attachSseAppBuildCheck(es);
    expect(es.addEventListener).toHaveBeenCalledWith('open', expect.any(Function));
    const spy = vi.fn();
    window.addEventListener(APP_BUILD_CHECK_EVENT, spy);
    listeners.open();
    window.removeEventListener(APP_BUILD_CHECK_EVENT, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the EventSource is missing', () => {
    expect(() => attachSseAppBuildCheck(null)).not.toThrow();
  });
});
