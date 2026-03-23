import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { ShrinkingPotion } from '../../../../src/features-v2/consumables/ShrinkingPotion.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Shrinking Potion', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Shrinking Potion', id: 'srd-cns-shrinking-potion' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Shrinking Potion',
        description: ShrinkingPotion.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-shrinking-potion',
      })
    );
  });

  it('onUse queues remove + appendActiveModifier', () => {
    const t = buildTableSnapshot(
      mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Shrinking Potion' })
    );
    ShrinkingPotion.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'removeActiveModifier',
        payload: expect.objectContaining({ instanceId: 'char-1', id: 'cns-shrinking-potion' }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'appendActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          modifier: expect.objectContaining({
            id: 'cns-shrinking-potion',
            name: 'Shrunk (Shrinking Potion)',
            type: 'consumable',
            refreshOn: 'rest',
          }),
        }),
      })
    );
  });

  it('while shrunk, attack with Agility applies +2 and -1 to action roll', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-shrinking-potion', name: 'Shrunk (Shrinking Potion)' }],
    });
    const { mutations } = runIntent(
      { ...ShrinkingPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Shrinking Potion',
          value: 2,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Shrinking Potion',
          value: -1,
        }),
      })
    );
  });

  it('while shrunk, attack with Strength applies only proficiency penalty', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-shrinking-potion', name: 'Shrunk (Shrinking Potion)' }],
    });
    const { mutations } = runIntent(
      { ...ShrinkingPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Strength' },
        actionType: 'attack',
      }
    );
    const statics = mutations.filter((m) => m.type === 'addRollStatic');
    expect(statics).toHaveLength(1);
    expect(statics[0]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ value: -1 }),
      })
    );
  });

  it('while shrunk, non-attack Agility roll applies +2 only', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-shrinking-potion', name: 'Shrunk (Shrinking Potion)' }],
    });
    const { mutations } = runIntent(
      { ...ShrinkingPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
        actionType: 'roll',
      }
    );
    const statics = mutations.filter((m) => m.type === 'addRollStatic');
    expect(statics).toHaveLength(1);
    expect(statics[0]).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ value: 2 }),
      })
    );
  });

  it('onIntent does nothing when not shrunk', () => {
    const char = mockCharacter({ instanceId: 'char-1', activeModifiers: [] });
    const { mutations } = runIntent(
      { ...ShrinkingPotion, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
        actionType: 'attack',
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('drop-form card chip is available while shrunk', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      activeModifiers: [{ id: 'cns-shrinking-potion', name: 'Shrunk (Shrinking Potion)' }],
    });
    const gs = mockGameState({
      _ownerInstanceId: 'char-1',
      _featureKey: 'Shrinking Potion',
      activeElements: [char],
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ShrinkingPotion, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]?.description).toMatch(/drop/i);
  });
});
