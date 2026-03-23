import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { MinorHealthPotion } from '../../../../src/features-v2/consumables/MinorHealthPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Minor Health Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Minor Health Potion', id: 'srd-cns-minor-health-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Minor Health Potion',
        description: MinorHealthPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-minor-health-potion',
      })
    );
  });

  it('onUse queues rollDie then clearHP for the rolled total', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Minor Health Potion',
        _rng: () => 0.625,
      })
    );
    MinorHealthPotion.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({
          notation: 'd4',
          total: 3,
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 3,
        }),
      })
    );
  });

  it('onIntent does not queue healing (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...MinorHealthPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });
});
