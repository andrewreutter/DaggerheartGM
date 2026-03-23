import { describe, it, expect } from 'vitest';
import { BattleCry } from '../../../../src/features-v2/abilities/Blade/BattleCry.js';
import { collectChips, activateChip, makeChipState, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import {
  mockCharacter,
  mockGameState,
  mockAdversary,
  mockRoll,
  runIntent,
  runReviewOutcome,
} from '../helpers.js';

const battleCryFeat = { ...BattleCry, _ownerInstanceId: 'char-1' };

describe('Blade — Battle Cry', () => {
  it('default card is once per long rest', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Battle Cry',
        featureState: {},
        action: { type: 'free', actorInstanceId: 'char-1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([battleCryFeat], 'card', tbl);
    expect(chips[0]?.frequency).toBe('longRest');
  });

  it('onUse clears Stress and grants Hope to other PCs, sets rally state, and posts actionLoop', () => {
    const fs = { 'Battle Cry': {} };
    const war = mockCharacter({ instanceId: 'char-1', currentStress: 1 });
    const ally = mockCharacter({ instanceId: 'char-2', currentStress: 2, hope: 0, maxHope: 6 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [war, ally, mockAdversary()],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Battle Cry',
        featureState: fs,
        action: { type: 'free', actorInstanceId: 'char-1', targetInstanceIds: [], effects: [] },
        rolls: undefined,
      })
    );
    const chips = collectChips([battleCryFeat], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState());
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const all = [...fromUse, ...fromCost];
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'char-2', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-2', amount: 1 }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Battle Cry',
          key: 'battleCryRallyActive',
          value: true,
        }),
      })
    );
    expect(all).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Battle Cry' }),
      })
    );
  });

  it('onIntent adds an advantage die when rally is active and another PC makes an attack', () => {
    const war = mockCharacter({ instanceId: 'char-1' });
    const ally = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(battleCryFeat, {
      activeElements: [war, ally, adv],
      featureState: {
        'Battle Cry': { battleCryRallyActive: true, battleCryGrantorInstanceId: 'char-1' },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Battle Cry' }),
      })
    );
  });

  it('onIntent does not grant advantage to the grantor’s own attacks', () => {
    const war = mockCharacter({ instanceId: 'char-1' });
    const ally = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(battleCryFeat, {
      activeElements: [war, ally, adv],
      featureState: {
        'Battle Cry': { battleCryRallyActive: true, battleCryGrantorInstanceId: 'char-1' },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    expect(mutations.some((m) => m.type === 'addAdvantageDie')).toBe(false);
  });

  it('onReviewOutcome clears rally when a PC rolls Fear-dominated (Hope < Fear)', () => {
    const fs = {
      'Battle Cry': { battleCryRallyActive: true, battleCryGrantorInstanceId: 'char-1' },
    };
    const war = mockCharacter({ instanceId: 'char-1' });
    const ally = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    runReviewOutcome(battleCryFeat, {
      activeElements: [war, ally, adv],
      featureState: fs,
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({
        hopeValue: 2,
        fearValue: 9,
        action: { isSuccess: false },
      }),
    });
    expect(fs['Battle Cry']?.battleCryRallyActive).toBe(false);
    expect(fs['Battle Cry']?.battleCryGrantorInstanceId).toBeNull();
  });
});
