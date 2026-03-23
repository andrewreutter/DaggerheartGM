import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { Stardrop } from '../../../../src/features-v2/consumables/Stardrop.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Stardrop', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Stardrop', id: 'srd-cns-stardrop' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Stardrop',
        description: Stardrop.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-stardrop',
      })
    );
  });

  it('does not load when inventory lacks this consumable', () => {
    const feats = loadCharacterFeatures(mockCharacter({ inventory: [] }), registry);
    expect(feats.some((f) => f.name === 'Stardrop')).toBe(false);
  });

  it('onUse queues actionLoop for Very Far hailstorm damage', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Stardrop',
      })
    );
    Stardrop.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Stardrop',
          description: expect.stringMatching(/Very Far range/i),
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/8d20.*physical damage/i),
        }),
      })
    );
  });
});
