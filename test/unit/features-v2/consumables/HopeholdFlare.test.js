import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { dispatchStateChangeHooks, dispatchSceneEndHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { HopeholdFlare } from '../../../../src/features-v2/consumables/HopeholdFlare.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

const hopeholdFlareFeature = loadCharacterFeatures(
  mockCharacter({ inventory: [{ name: 'Hopehold Flare', id: 'srd-cns-hopehold-flare' }] }),
  registry
).find((f) => f.name === 'Hopehold Flare');

describe('Consumables — Hopehold Flare', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Hopehold Flare', id: 'srd-cns-hopehold-flare' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Hopehold Flare',
        _source: 'consumable',
        _consumableId: 'srd-cns-hopehold-flare',
      })
    );
  });

  it('onUse queues feature state and actionLoop', () => {
    const char = mockCharacter({ instanceId: 'a1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'a1',
      _featureKey: 'Hopehold Flare',
      _activeFeature: hopeholdFlareFeature,
    });
    const table = buildTableSnapshot(gs);
    HopeholdFlare.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'consumables:srd-cns-hopehold-flare',
          key: 'active',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'consumables:srd-cns-hopehold-flare',
          key: 'activatorInstanceId',
          value: 'a1',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ instanceId: 'a1', title: 'Hopehold Flare' }),
      })
    );
  });

  it('onStateChange: ally in Close range who spends Hope rolls d6; on 6 refunds Hope', () => {
    const activator = mockCharacter({
      instanceId: 'a1',
      tokenX: 0,
      tokenY: 0,
      hope: 3,
    });
    const ally = mockCharacter({
      instanceId: 'b1',
      name: 'Ally',
      tokenX: 10,
      tokenY: 0,
      hope: 2,
    });
    const feat = { ...hopeholdFlareFeature, _ownerInstanceId: 'a1' };
    const gs = mockGameState({
      activeElements: [activator, ally],
      _ownerInstanceId: 'a1',
      _featureKey: 'Hopehold Flare',
      _activeFeature: feat,
      featureState: {
        'consumables:srd-cns-hopehold-flare': { active: true, activatorInstanceId: 'a1' },
      },
      action: null,
      rolls: null,
      _rng: () => 0.999,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [feat],
      [{ type: 'spendHope', payload: { instanceId: 'b1', amount: 1 } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 6 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: { instanceId: 'b1', amount: 1 },
      })
    );
  });

  it('onStateChange: no refund when d6 is not 6', () => {
    const activator = mockCharacter({
      instanceId: 'a1',
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'b1',
      tokenX: 10,
      tokenY: 0,
    });
    const feat = { ...hopeholdFlareFeature, _ownerInstanceId: 'a1' };
    const gs = mockGameState({
      activeElements: [activator, ally],
      _ownerInstanceId: 'a1',
      _featureKey: 'Hopehold Flare',
      _activeFeature: feat,
      featureState: {
        'consumables:srd-cns-hopehold-flare': { active: true, activatorInstanceId: 'a1' },
      },
      action: null,
      rolls: null,
      _rng: () => 0.5,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [feat],
      [{ type: 'spendHope', payload: { instanceId: 'b1', amount: 1 } }]
    );
    expect(mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });

  it('onSceneEnd clears flare state when activator runs hook', () => {
    const activator = mockCharacter({ instanceId: 'a1' });
    const feat = { ...hopeholdFlareFeature, _ownerInstanceId: 'a1' };
    const gs = mockGameState({
      activeElements: [activator],
      _ownerInstanceId: 'a1',
      _featureKey: 'Hopehold Flare',
      _activeFeature: feat,
      featureState: {
        'consumables:srd-cns-hopehold-flare': { active: true, activatorInstanceId: 'a1' },
      },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchSceneEndHooks(gs, [feat]);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'consumables:srd-cns-hopehold-flare',
          key: 'active',
          value: false,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'consumables:srd-cns-hopehold-flare',
          key: 'activatorInstanceId',
          value: null,
        }),
      })
    );
  });
});
