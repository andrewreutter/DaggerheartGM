import { describe, it, expect } from 'vitest';
import { Pompous } from '../../../../src/features-v2/weapon_properties/Pompous.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';

describe('Pompous', () => {
  it('uses onRender to set isDisabled from Presence and SRD text', () => {
    expect(Pompous.name).toBe('Pompous');
    expect(Pompous.description).toMatch(/Presence of 0 or lower/i);
    expect(typeof Pompous.onRender).toBe('function');
  });

  it('applyDeclarativeFeatures merges weaponRenderHints for the weapon id', () => {
    const char = {
      instanceId: 'c1',
      traits: { presence: 2 },
      primaryWeaponId: 'w-pomp',
    };
    const feature = {
      ...Pompous,
      _ownerInstanceId: 'c1',
      _source: 'weapon_property',
      _weaponId: 'w-pomp',
    };
    const { weaponRenderHints } = applyDeclarativeFeatures([feature], char, {});
    expect(weaponRenderHints['w-pomp']).toEqual(
      expect.objectContaining({ isDisabled: true, disabledReason: 'Requires Presence ≤ 0' })
    );
    const ok = applyDeclarativeFeatures([feature], { ...char, traits: { ...char.traits, presence: 0 } }, {});
    expect(ok.weaponRenderHints['w-pomp']).toEqual(expect.objectContaining({ isDisabled: false }));
  });
});
