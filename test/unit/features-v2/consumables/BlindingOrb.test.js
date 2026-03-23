import { describe, it, expect } from 'vitest';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { dispatchStateChangeHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BlindingOrb } from '../../../../src/features-v2/consumables/BlindingOrb.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockAdversary, mockCharacter, mockGameState } from '../helpers.js';

const blindingOrbFeature = loadCharacterFeatures(
  mockCharacter({ inventory: [{ name: 'Blinding Orb', id: 'srd-cns-blinding-orb' }] }),
  registry
).find((f) => f.name === 'Blinding Orb');

describe('Consumables — Blinding Orb', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Blinding Orb', id: 'srd-cns-blinding-orb' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Blinding Orb',
        _source: 'consumable',
        _consumableId: 'srd-cns-blinding-orb',
      })
    );
  });

  it('onUse applies Vulnerable and tracks affected ids within Close range', () => {
    const user = mockCharacter({
      instanceId: 'a1',
      tokenX: 0,
      tokenY: 0,
    });
    const inRange = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 10,
      tokenY: 0,
    });
    const far = mockAdversary({
      instanceId: 'adv-2',
      tokenX: 200,
      tokenY: 0,
    });
    const gs = mockGameState({
      activeElements: [user, inRange, far],
      _ownerInstanceId: 'a1',
      _featureKey: 'Blinding Orb',
      _activeFeature: blindingOrbFeature,
      featureState: {},
    });
    const table = buildTableSnapshot(gs);
    BlindingOrb.onUse(table);
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'a1', condition: 'Vulnerable' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'adv-1', condition: 'Vulnerable' },
      })
    );
    expect(mutations).not.toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'adv-2', condition: 'Vulnerable' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'consumables:srd-cns-blinding-orb',
          key: 'affectedInstanceIds',
          value: ['a1', 'adv-1'],
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ instanceId: 'a1', title: 'Blinding Orb' }),
      })
    );
  });

  it('onStateChange clears Vulnerable when a tracked target marks HP', () => {
    const user = mockCharacter({
      instanceId: 'a1',
      tokenX: 0,
      tokenY: 0,
      conditions: ['Vulnerable'],
    });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 10,
      tokenY: 0,
      conditions: ['Vulnerable'],
    });
    const feat = { ...blindingOrbFeature, _ownerInstanceId: 'a1' };
    const gs = mockGameState({
      activeElements: [user, adv],
      _ownerInstanceId: 'a1',
      _featureKey: 'Blinding Orb',
      _activeFeature: feat,
      featureState: {
        'consumables:srd-cns-blinding-orb': { affectedInstanceIds: ['a1', 'adv-1'] },
      },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [feat],
      [{ type: 'markHP', payload: { instanceId: 'adv-1', amount: 1 } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'adv-1', condition: 'Vulnerable' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'consumables:srd-cns-blinding-orb',
          key: 'affectedInstanceIds',
          value: ['a1'],
        }),
      })
    );
  });
});
