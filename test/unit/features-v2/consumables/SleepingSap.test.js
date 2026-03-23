import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SleepingSap } from '../../../../src/features-v2/consumables/SleepingSap.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Sleeping Sap', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Sleeping Sap', id: 'srd-cns-sleeping-sap' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Sleeping Sap',
        description: SleepingSap.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-sleeping-sap',
      })
    );
  });

  it('onUse queues clearStress for all marked Stress', () => {
    const t = buildTableSnapshot(
      mockGameState({
        character: mockCharacter({ instanceId: 'char-1', currentStress: 4, maxStress: 6 }),
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sleeping Sap',
      })
    );
    SleepingSap.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 4,
        }),
      })
    );
    expect(mut.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  it('onUse does not queue clearStress when no Stress is marked', () => {
    const t = buildTableSnapshot(
      mockGameState({
        character: mockCharacter({ instanceId: 'char-1', currentStress: 0, maxStress: 6 }),
        _ownerInstanceId: 'char-1',
        _featureKey: 'Sleeping Sap',
      })
    );
    SleepingSap.onUse(t);
    const mut = applyMutations(t);
    expect(mut.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });

  it('onIntent does not queue stress clear (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...SleepingSap, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'clearStress')).toHaveLength(0);
  });
});
