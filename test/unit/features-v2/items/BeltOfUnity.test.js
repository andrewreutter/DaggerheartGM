import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { BeltOfUnity } from '../../../../src/features-v2/items/BeltOfUnity.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('Items — Belt of Unity', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Belt of Unity', id: 'srd-itm-belt-of-unity' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Belt of Unity',
        description: BeltOfUnity.description,
        _source: 'item',
        _itemId: 'srd-itm-belt-of-unity',
      })
    );
  });

  it('card chip is once per session, costs 5 Hope, and posts actionLoop for Tag Team lead', () => {
    const char = mockCharacter({ instanceId: 'char-1', hope: 6 });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Belt of Unity',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BeltOfUnity, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('session');
    expect(chips[0].hopeCost).toBe(5);

    deductChipCosts(chips[0], tbl);
    const fromUse = [...activateChip(chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 5 }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Belt of Unity',
          description: expect.stringMatching(/Tag Team/i),
        }),
      })
    );
  });

  it('does not expose intent-phase chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Belt of Unity',
    });
    const tbl = buildTableSnapshot(gs);
    const intent = collectChips([{ ...BeltOfUnity, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toHaveLength(0);
  });
});
