import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { SnapPowder } from '../../../../src/features-v2/consumables/SnapPowder.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Snap Powder', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Snap Powder', id: 'srd-cns-snap-powder' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Snap Powder',
        description: SnapPowder.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-snap-powder',
      })
    );
  });

  it('onUse queues markStress 1 and clearHP 1', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Snap Powder',
      })
    );
    SnapPowder.onUse(t);
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
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
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
      { ...SnapPowder, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'markStress' || m.type === 'clearHP')).toHaveLength(0);
  });
});
