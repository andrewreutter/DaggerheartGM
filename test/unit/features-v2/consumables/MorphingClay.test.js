import { describe, it, expect } from 'vitest';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { MorphingClay } from '../../../../src/features-v2/consumables/MorphingClay.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

describe('Consumables — Morphing Clay', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Morphing Clay', id: 'srd-cns-morphing-clay' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Morphing Clay',
        description: MorphingClay.description,
        hopeCost: 1,
        _source: 'consumable',
        _consumableId: 'srd-cns-morphing-clay',
      })
    );
  });

  it('onUse queues remove + appendActiveModifier for disguise token', () => {
    const t = buildTableSnapshot(
      mockGameState({
        _ownerInstanceId: 'char-1',
        _featureKey: 'Morphing Clay',
      })
    );
    MorphingClay.onUse(t);
    const mut = applyMutations(t);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'removeActiveModifier',
        payload: expect.objectContaining({ instanceId: 'char-1', id: 'morphing-clay-disguise' }),
      })
    );
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'appendActiveModifier',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          modifier: expect.objectContaining({
            id: 'morphing-clay-disguise',
            name: 'Disguised (Morphing Clay)',
            type: 'consumable',
            refreshOn: 'rest',
          }),
        }),
      })
    );
  });

  it('card chip has hopeCost 1', () => {
    const gs = mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Morphing Clay' });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...MorphingClay, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.hopeCost).toBe(1);
  });

  it('deductChipCosts queues spendHope 1', () => {
    const gs = mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Morphing Clay' });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...MorphingClay, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const card = chips[0];
    deductChipCosts(card, tbl);
    const mut = applyMutations(tbl);
    expect(mut).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('onIntent does not queue modifier (card action is onUse only)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { mutations } = runIntent(
      { ...MorphingClay, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        action: { traitKey: 'Agility' },
      }
    );
    expect(mutations.filter((m) => m.type === 'appendActiveModifier')).toHaveLength(0);
  });
});
