import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { VarikLeaves } from '../../../../src/features-v2/consumables/VarikLeaves.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Varik Leaves', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Varik Leaves', id: 'srd-cns-varik-leaves' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Varik Leaves',
        description: VarikLeaves.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-varik-leaves',
      })
    );
  });

  it('onUse queues gainHope 2', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Varik Leaves',
      })
    );
    VarikLeaves.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 2,
        }),
      })
    );
  });

  it('onIntent does not queue hope (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...VarikLeaves, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });
});
