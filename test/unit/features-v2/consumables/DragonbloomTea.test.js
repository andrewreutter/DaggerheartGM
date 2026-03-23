import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { DragonbloomTea } from '../../../../src/features-v2/consumables/DragonbloomTea.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Dragonbloom Tea', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Dragonbloom Tea', id: 'srd-cns-dragonbloom-tea' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Dragonbloom Tea',
        description: DragonbloomTea.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-dragonbloom-tea',
      })
    );
  });

  it('onUse queues Instinct actionLoop for Close-range breath vs adversaries in front', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Dragonbloom Tea',
      })
    );
    DragonbloomTea.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Dragonbloom Tea',
          trait: 'Instinct',
          description: expect.stringMatching(/Instinct roll.*Close range/i),
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/2d20.*physical damage.*Proficiency/i),
        }),
      })
    );
  });
});
