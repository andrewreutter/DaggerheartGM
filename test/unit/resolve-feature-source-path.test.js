import { describe, it, expect } from 'vitest';
import {
  resolveV2FeatureSourcePath,
  resolveV2LibraryItemSourcePath,
} from '../../src/features-v2/resolve-feature-source-path.js';

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

  it('resolves ability when SRD slug id differs from registry (apostrophe)', () => {
    const p = resolveV2FeatureSourcePath({
      _sourceScopeKey: 'abilities:srd-abl-a-soldier-s-bond',
      _source: 'ability',
      name: "A Soldier's Bond",
    });
    expect(p).toBe('abilities/Blade/ASoldiersBond.js');
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

describe('resolveV2LibraryItemSourcePath', () => {
  it('resolves SRD ability row by collection + id', () => {
    const p = resolveV2LibraryItemSourcePath('abilities', {
      _source: 'srd',
      id: 'srd-abl-rune-ward',
      name: 'Rune Ward',
    });
    expect(p).toBe('abilities/Arcana/RuneWard.js');
  });

  it('resolves A Soldier\'s Bond from SRD list slug id', () => {
    const p = resolveV2LibraryItemSourcePath('abilities', {
      _source: 'srd',
      id: 'srd-abl-a-soldier-s-bond',
      name: "A Soldier's Bond",
    });
    expect(p).toBe('abilities/Blade/ASoldiersBond.js');
  });

  it('resolves Aquatic Predator beastform', () => {
    const p = resolveV2LibraryItemSourcePath('beastforms', {
      _source: 'srd',
      id: 'srd-bst-aquatic-predator',
      name: 'Aquatic Predator',
    });
    expect(p).toBe('beastforms/AquaticPredator.js');
  });

  it('returns null when not SRD', () => {
    expect(
      resolveV2LibraryItemSourcePath('abilities', { _source: 'own', id: 'srd-abl-rune-ward' }),
    ).toBe(null);
  });

  it('returns null for collections without a top-level module map', () => {
    expect(resolveV2LibraryItemSourcePath('domains', { _source: 'srd', id: 'srd-dom-arcana' })).toBe(null);
  });
});
