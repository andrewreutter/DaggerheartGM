import { describe, it, expect } from 'vitest';
import { runReviewAction, mockTable, mockChipState } from '../helpers.js';
import { Luckbender } from '../../../../src/features-v2/ancestries/Faerie.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';

describe('Luckbender', () => {
  it('shows chip when acting character makes action roll', () => {
    const result = runReviewAction(Luckbender, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].name).toBe('Luckbender');
    expect(result.chips[0].hopeCost).toBe(3);
    expect(result.chips[0].frequency).toBe('session');
  });

  it('does not show chip when not acting and no action roll', () => {
    const result = runReviewAction(Luckbender, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        // No action roll
        damage: {
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('shows chip when ally is acting within Close range', () => {
    const allyChar = { instanceId: 'char-2', elementType: 'character', name: 'Ally',
      currentHp: 4, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
      currentArmor: 3, maxArmor: 3, conditions: [], traits: {},
      tokenX: 0, tokenY: 0 };
    const meChar = { instanceId: 'char-1', elementType: 'character', name: 'Me',
      currentHp: 4, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
      currentArmor: 3, maxArmor: 3, conditions: [], traits: {},
      tokenX: 20, tokenY: 0 }; // 20ft away — within Close (30ft)
    const result = runReviewAction(Luckbender, {
      activeElements: [meChar, allyChar],
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [] },
      },
    });

    expect(result.chips).toHaveLength(1);
    expect(result.chips[0].name).toBe('Luckbender');
  });

  it('does not show chip when ally is acting outside Close range', () => {
    const allyChar = { instanceId: 'char-2', elementType: 'character', name: 'Ally',
      currentHp: 4, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
      currentArmor: 3, maxArmor: 3, conditions: [], traits: {},
      tokenX: 0, tokenY: 0 };
    const meChar = { instanceId: 'char-1', elementType: 'character', name: 'Me',
      currentHp: 4, maxHp: 6, currentStress: 0, maxStress: 6, hope: 3, maxHope: 6,
      currentArmor: 3, maxArmor: 3, conditions: [], traits: {},
      tokenX: 50, tokenY: 0 }; // 50ft away — outside Close (30ft)
    const result = runReviewAction(Luckbender, {
      activeElements: [meChar, allyChar],
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [] },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('rerolls both Hope and Fear dice when chip is used', () => {
    const result = runReviewAction(Luckbender, {
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.chips).toHaveLength(1);
    const chip = result.chips[0];
    
    const table = mockTable({
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
        },
      },
    });
    
    chip.onUse(table, mockChipState({ _isOn: true }));
    const mutations = applyMutations(table);
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'hopeDie' }
      })
    );
    
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: { rollKey: 'action', dieType: 'fearDie' }
      })
    );
  });
});
