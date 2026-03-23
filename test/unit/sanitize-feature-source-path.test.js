import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { safeResolveUnderFeaturesRoot } from '../../src/sanitize-feature-source-path.js';

describe('safeResolveUnderFeaturesRoot', () => {
  const base = join('/app', 'src', 'features-v2');

  it('allows a normal relative js path', () => {
    expect(safeResolveUnderFeaturesRoot(base, 'classes/Bard.js')).toBe(join(base, 'classes', 'Bard.js'));
  });

  it('rejects path traversal', () => {
    expect(safeResolveUnderFeaturesRoot(base, '../server.js')).toBe(null);
    expect(safeResolveUnderFeaturesRoot(base, 'foo/../../server.js')).toBe(null);
  });

  it('rejects non-js and odd characters', () => {
    expect(safeResolveUnderFeaturesRoot(base, 'classes/Bard.ts')).toBe(null);
    expect(safeResolveUnderFeaturesRoot(base, '')).toBe(null);
    expect(safeResolveUnderFeaturesRoot(base, 'foo\x00.js')).toBe(null);
  });
});
