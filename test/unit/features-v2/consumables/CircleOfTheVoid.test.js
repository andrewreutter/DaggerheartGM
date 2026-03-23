import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { CircleOfTheVoid } from '../../../../src/features-v2/consumables/CircleOfTheVoid.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Circle of the Void', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Circle of the Void', id: 'srd-cns-circle-of-the-void' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Circle of the Void',
        description: CircleOfTheVoid.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-circle-of-the-void',
      })
    );
  });

  it('onUse queues markStress 1', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Circle of the Void',
      })
    );
    CircleOfTheVoid.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 1,
        }),
      })
    );
  });

  it('onIntent does not queue resource changes (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...CircleOfTheVoid, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});
