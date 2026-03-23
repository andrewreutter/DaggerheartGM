import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { JarOfLostVoices } from '../../../../src/features-v2/consumables/JarOfLostVoices.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Consumables — Jar of Lost Voices', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Jar of Lost Voices', id: 'srd-cns-jar-of-lost-voices' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Jar of Lost Voices',
        description: JarOfLostVoices.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-jar-of-lost-voices',
      })
    );
  });

  it('does not load when inventory lacks this consumable', () => {
    const feats = loadCharacterFeatures(mockCharacter({ inventory: [] }), registry);
    expect(feats.some((f) => f.name === 'Jar of Lost Voices')).toBe(false);
  });

  it('onUse queues actionLoop with Far-range damage guidance and Instinct duration', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Jar of Lost Voices',
        character: mockCharacter({
          instanceId: 'char-1',
          traits: { agility: 0, strength: 0, finesse: 0, instinct: 2, presence: 0, knowledge: 0 },
        }),
      })
    );
    JarOfLostVoices.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Jar of Lost Voices',
          description: expect.stringMatching(/2 minutes.*Instinct/i),
        }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          description: expect.stringMatching(/Far range.*6d8.*magic damage/i),
        }),
      })
    );
  });
});
