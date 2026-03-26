import { describe, it, expect } from 'vitest';
import { getLibrarySidebarFeatures } from '../../src/client/lib/library-sidebar-features.js';

describe('getLibrarySidebarFeatures', () => {
  it('points to the Library Features tab', () => {
    const rows = getLibrarySidebarFeatures();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('v2-features-tab');
    expect(rows[0].title).toMatch(/Features/);
  });
});
