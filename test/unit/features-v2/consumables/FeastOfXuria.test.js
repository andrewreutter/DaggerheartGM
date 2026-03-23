import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { FeastOfXuria } from '../../../../src/features-v2/consumables/FeastOfXuria.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Feast of Xuria', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Feast of Xuria', id: 'srd-cns-feast-of-xuria' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Feast of Xuria',
        description: FeastOfXuria.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-feast-of-xuria',
      })
    );
  });

  it('onUse clears all HP and Stress then rolls d4 Hope', () => {
    const t = buildTableSnapshot(
      mockGameState({
        character: mockCharacter({
          instanceId: 'char-1',
          currentHp: 2,
          maxHp: 6,
          currentStress: 3,
          maxStress: 6,
          hope: 1,
          maxHope: 6,
        }),
        _ownerInstanceId: 'char-1',
        _featureKey: 'Feast of Xuria',
        _rng: () => 0.625,
      })
    );
    FeastOfXuria.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 4,
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
        type: 'gainHope',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          amount: 3,
        }),
      })
    );
  });

  it('onIntent does not queue consumable effects (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...FeastOfXuria, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(
      mutations.filter(
        (m) =>
          m.type === 'clearHP' ||
          m.type === 'clearStress' ||
          m.type === 'gainHope' ||
          m.type === 'rollDie'
      )
    ).toHaveLength(0);
  });
});
