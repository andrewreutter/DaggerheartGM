import { describe, it, expect } from 'vitest';
import { Sturdy } from '../../../../src/features-v2/ancestries/Orc.js';
import { runIntent, mockCharacter, mockAdversary, mockGameState } from '../helpers.js';

describe('Sturdy', () => {
  it('adds disadvantage die when character has 1 HP remaining and is targeted', () => {
    // currentHp = marked boxes; 1 remaining means maxHp - currentHp === 1
    const char = mockCharacter({ instanceId: 'char-1', maxHp: 6, currentHp: 5 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runIntent(Sturdy, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
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

    expect(result.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDisadvantageDie',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Sturdy',
        }),
      })
    );
  });

  it('does not add disadvantage when character has more than 1 HP remaining', () => {
    // currentHp: 4 with maxHp: 6 means 2 HP remaining
    const char = mockCharacter({ instanceId: 'char-1', maxHp: 6, currentHp: 4 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runIntent(Sturdy, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [],
        appliedEffects: [],
      },
    });

    expect(result.mutations).not.toContainEqual(
      expect.objectContaining({ type: 'addDisadvantageDie' })
    );
  });

  it('does not add disadvantage when character is not targeted', () => {
    const char = mockCharacter({ instanceId: 'char-1', maxHp: 6, currentHp: 5 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runIntent(Sturdy, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'], // Different target
        effects: [],
        appliedEffects: [],
      },
    });

    expect(result.mutations).not.toContainEqual(
      expect.objectContaining({ type: 'addDisadvantageDie' })
    );
  });
});
