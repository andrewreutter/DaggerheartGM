import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SunTreeSap } from '../../../../src/features-v2/consumables/SunTreeSap.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Sun Tree Sap', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Sun Tree Sap', id: 'srd-cns-sun-tree-sap' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Sun Tree Sap',
        description: SunTreeSap.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-sun-tree-sap',
      })
    );
  });

  it('onUse (d6 5–6) queues rollDie then clearHP 2', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sun Tree Sap',
        _rng: () => 0.75,
      })
    );
    SunTreeSap.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd6',
          total: 5,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 2,
        }),
      })
    );
  });

  it('onUse (d6 2–4) queues clearStress 3', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sun Tree Sap',
        _rng: () => 0.25,
      })
    );
    SunTreeSap.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd6',
          total: 2,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 3,
        }),
      })
    );
  });

  it('onUse (d6 1) queues addCondition Scar', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sun Tree Sap',
        _rng: () => 0,
      })
    );
    SunTreeSap.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd6',
          total: 1,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          condition: 'Scar',
        }),
      })
    );
  });

  it('onIntent does not queue consumable effects (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...SunTreeSap, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'addCondition')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
