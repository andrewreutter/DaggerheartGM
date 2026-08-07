import { describe, expect, it } from 'vitest';
import {
  filterSeriousSubclassConsoleErrors,
  isBenignSubclassConsoleError,
  withTimeout,
} from '../helpers/subclass-video.js';

describe('withTimeout', () => {
  it('resolves when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'fast')).resolves.toBe(42);
  });

  it('rejects when the timer wins', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 500));
    await expect(withTimeout(slow, 20, 'slow-op')).rejects.toThrow(/slow-op timed out after 20ms/);
  });
});

describe('filterSeriousSubclassConsoleErrors', () => {
  it('treats resource 403 and 404 as benign', () => {
    expect(isBenignSubclassConsoleError('Failed to load resource: the server responded with a status of 404 (Not Found)')).toBe(
      true
    );
    expect(isBenignSubclassConsoleError('[A] Failed to load resource: the server responded with a status of 403 (Forbidden)')).toBe(
      true
    );
    expect(filterSeriousSubclassConsoleErrors(['real boom', '[A] Failed to load resource: … 404 (Not Found)'])).toEqual([
      'real boom',
    ]);
  });
});
