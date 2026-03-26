import { describe, it, expect } from 'vitest';
import { Charged } from '../../../../src/features-v2/weapon_properties/Charged.js';

describe('Charged', () => {
  it('computeWeaponRenderHints hides duplicate Charged variant card when VTT intent strip is used', () => {
    const hints = Charged.computeWeaponRenderHints({
      source: { id: 'w-rapier' },
    });
    expect(hints['w-rapier']).toEqual({ hideChargedVariantCard: true });
  });
});
