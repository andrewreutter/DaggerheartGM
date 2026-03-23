import { describe, it, expect } from 'vitest';
import { resolveV2FeatureSourcePath } from '../../src/features-v2/resolve-feature-source-path.js';

describe('resolveV2FeatureSourcePath', () => {
  it('resolves class feature via scope', () => {
    const p = resolveV2FeatureSourcePath({
      _sourceScopeKey: 'classes:srd-cls-bard',
      _source: 'class',
      name: 'Rally',
    });
    expect(p).toBe('classes/Bard.js');
  });

  it('resolves ability id', () => {
    const p = resolveV2FeatureSourcePath({
      _sourceScopeKey: 'abilities:srd-abl-rune-ward',
      _source: 'ability',
      name: 'Rune Ward',
    });
    expect(p).toBe('abilities/Arcana/RuneWard.js');
  });

  it('resolves weapon property by name when scope is weapons', () => {
    const p = resolveV2FeatureSourcePath({
      _sourceScopeKey: 'weapons:srd-wpn-any',
      _source: 'weapon_property',
      name: 'Barrier',
    });
    expect(p).toBe('weapon_properties/Barrier.js');
  });

  it('returns null for unknown scope', () => {
    expect(resolveV2FeatureSourcePath({ _sourceScopeKey: 'unknown:x', name: 'Y' })).toBe(null);
  });
});
