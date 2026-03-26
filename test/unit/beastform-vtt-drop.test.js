import { describe, it, expect } from 'vitest';
import { SRD_CLASS_DRUID_SCOPE_KEY } from '../../src/features-v2/engine/feature-scope-keys.js';
import {
  buildClearBeastformStateMutations,
  hasDeclarativeBeastformFragileDrop,
  legacyBeastformFeaturesLookFragile,
  shouldDropBeastformFromDamage,
} from '../../src/client/lib/beastform-vtt-drop.js';
import { applyV2LifecycleMutations } from '../../src/client/lib/table-ops.js';

describe('beastform-vtt-drop', () => {
  it('hasDeclarativeBeastformFragileDrop reads merged row flag', () => {
    expect(hasDeclarativeBeastformFragileDrop([{ name: 'Agile' }])).toBe(false);
    expect(hasDeclarativeBeastformFragileDrop([{ name: 'Fragile', dropBeastformOnMajorOrGreaterDamage: true }])).toBe(
      true
    );
  });

  it('legacyBeastformFeaturesLookFragile matches SRD feature name list', () => {
    expect(legacyBeastformFeaturesLookFragile({ features: [{ name: 'Agile' }] })).toBe(false);
    expect(legacyBeastformFeaturesLookFragile({ features: [{ name: 'Fragile' }] })).toBe(true);
  });

  it('shouldDropBeastformFromDamage', () => {
    expect(shouldDropBeastformFromDamage({ currentHp: 0, hpLossToApply: 1, hasFragile: false })).toBe(true);
    expect(shouldDropBeastformFromDamage({ currentHp: 3, hpLossToApply: 2, hasFragile: true })).toBe(true);
    expect(shouldDropBeastformFromDamage({ currentHp: 3, hpLossToApply: 1, hasFragile: true })).toBe(false);
  });

  it('buildClearBeastformStateMutations + applyV2LifecycleMutations clears scoped state and legacy mirror', () => {
    const activeElements = [
      {
        instanceId: 'c1',
        elementType: 'character',
        name: 'Druid',
        featureState: {
          [SRD_CLASS_DRUID_SCOPE_KEY]: {
            activeBeastform: { beastformId: 'srd-bst-agile-scout', viaEvolution: false },
            evolutionTraitKey: 'agility',
          },
        },
        activeBeastform: { id: 'srd-bst-agile-scout', name: 'Scout' },
        selectedBeastformAdvantage: 'Brutal',
      },
    ];
    const { updates } = applyV2LifecycleMutations(
      activeElements,
      buildClearBeastformStateMutations(),
      'c1'
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].instanceId).toBe('c1');
    expect(updates[0].updates.featureState[SRD_CLASS_DRUID_SCOPE_KEY].activeBeastform).toBeNull();
    expect(updates[0].updates.featureState[SRD_CLASS_DRUID_SCOPE_KEY].evolutionTraitKey).toBeNull();
    expect(updates[0].updates.activeBeastform).toBeNull();
    expect(updates[0].updates.selectedBeastformAdvantage).toBeNull();
  });
});
