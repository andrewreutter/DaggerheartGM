import { describe, it, expect } from 'vitest';
import { normalizePersistedIncludes, LIBRARY_DEFAULT_INCLUDES } from '../../src/client/lib/library-default-filters.js';

describe('normalizePersistedIncludes', () => {
  it('removes discontinued hod key', () => {
    expect(normalizePersistedIncludes(['own', 'hod', 'srd'])).toEqual(['own', 'srd']);
  });

  it('removes discontinued fcg key', () => {
    expect(normalizePersistedIncludes(['own', 'fcg', 'srd'])).toEqual(['own', 'srd']);
  });

  it('passes through undefined and non-arrays', () => {
    expect(normalizePersistedIncludes(undefined)).toBe(undefined);
    expect(normalizePersistedIncludes(null)).toBe(null);
  });

  it('leaves default-shaped arrays unchanged', () => {
    expect(normalizePersistedIncludes([...LIBRARY_DEFAULT_INCLUDES])).toEqual([...LIBRARY_DEFAULT_INCLUDES]);
  });
});
