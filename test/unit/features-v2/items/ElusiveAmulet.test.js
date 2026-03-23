import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { dispatchTokenMoveHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { loadCharacterFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { ElusiveAmulet } from '../../../../src/features-v2/items/ElusiveAmulet.js';
import registry from '../../../../src/features-v2/registry.js';
import { mockCharacter, mockAdversary, mockGameState } from '../helpers.js';

describe('Items — Elusive Amulet', () => {
  it('loads from inventory by SRD id', () => {
    const feats = loadCharacterFeatures(
      mockCharacter({
        inventory: [{ name: 'Elusive Amulet', id: 'srd-itm-elusive-amulet' }],
      }),
      registry
    );
    expect(feats).toContainEqual(
      expect.objectContaining({
        name: 'Elusive Amulet',
        description: ElusiveAmulet.description,
        _source: 'item',
        _itemId: 'srd-itm-elusive-amulet',
      })
    );
  });

  it('card chip is once per long rest; use adds Hidden and tracks amulet state', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Elusive Amulet',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ElusiveAmulet, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');

    deductChipCosts(chips[0], tbl);
    const fromUse = [...activateChip(chips[0], tbl, makeChipState()), ...applyMutations(tbl)];

    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'char-1', condition: 'Hidden' },
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Elusive Amulet',
          key: 'elusiveAmuletActive',
          value: true,
        }),
      })
    );
  });

  it('onTokenMove clears Hidden and amulet state when the wearer moves', () => {
    const c = mockCharacter({
      instanceId: 'ea1',
      conditions: ['Hidden'],
      tokenX: 10,
      tokenY: 0,
    });
    const gameState = {
      fear: 0,
      activeElements: [c, mockAdversary({ instanceId: 'adv-1', tokenX: 100, tokenY: 0 })],
      featureState: {
        'Elusive Amulet': { elusiveAmuletActive: true },
      },
      _previousPositions: { ea1: { tokenX: 0, tokenY: 0 } },
    };
    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...ElusiveAmulet, _ownerInstanceId: 'ea1' }],
      { moverInstanceId: 'ea1' }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'ea1', condition: 'Hidden' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Elusive Amulet',
          key: 'elusiveAmuletActive',
          value: false,
        }),
      })
    );
  });

  it('onTokenMove does nothing when someone else moves', () => {
    const c = mockCharacter({
      instanceId: 'ea2',
      conditions: ['Hidden'],
      tokenX: 0,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const gameState = {
      fear: 0,
      activeElements: [c, adv],
      featureState: {
        'Elusive Amulet': { elusiveAmuletActive: true },
      },
      _previousPositions: { 'adv-1': { tokenX: 0, tokenY: 0 } },
    };
    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...ElusiveAmulet, _ownerInstanceId: 'ea2' }],
      { moverInstanceId: 'adv-1' }
    );
    expect(mutations).toHaveLength(0);
  });
});
