import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { OgreMusk } from '../../../../src/features-v2/consumables/OgreMusk.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Ogre Musk', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Ogre Musk', id: 'srd-cns-ogre-musk' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Ogre Musk',
        description: OgreMusk.description,
        _source: 'consumable',
        _consumableId: 'srd-cns-ogre-musk',
      })
    );
  });

  it('onUse queues remove + appendActiveModifier for untrackable token', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Ogre Musk',
      })
    );
    OgreMusk.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'removeActiveModifier',
        payload: expect.objectContaining({ instanceId: 'char-1', id: 'ogre-musk-untrackable' }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'appendActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          modifier: expect.objectContaining({
            id: 'ogre-musk-untrackable',
            name: 'Untrackable (Ogre Musk)',
            type: 'consumable',
            refreshOn: 'rest',
          }),
        }),
      })
    );
  });

  it('card chip has no Hope cost', () => {
    const gs = mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Ogre Musk' });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...OgreMusk, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.hopeCost).toBeUndefined();
  });

  it('deductChipCosts does not queue spendHope', () => {
    const gs = mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Ogre Musk' });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...OgreMusk, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const card = chips[0];
    deductChipCosts(card, tbl);
    const mut = applyMutations(tbl);
    expect(mut.filter((m) => m.type === 'spendHope')).toHaveLength(0);
  });

  it('onIntent does not queue modifier (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...OgreMusk, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'appendActiveModifier')).toHaveLength(0);
  });
});
