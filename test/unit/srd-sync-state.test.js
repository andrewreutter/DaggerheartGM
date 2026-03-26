import { describe, it, expect } from 'vitest';
import { formatSrdCacheStamp, SRD_EXTERNAL_CACHE_REVISION } from '../../src/srd-sync-state.js';

describe('srd-sync-state', () => {
  it('prefixes content hash so loader revision bumps invalidate DB without submodule changes', () => {
    expect(formatSrdCacheStamp('deadbeef')).toBe(`${SRD_EXTERNAL_CACHE_REVISION}:deadbeef`);
  });

  it('returns null when hash missing', () => {
    expect(formatSrdCacheStamp(null)).toBe(null);
    expect(formatSrdCacheStamp(undefined)).toBe(null);
  });
});
