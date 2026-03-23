import { describe, it, expect } from 'vitest';
import { OnTheBrink } from '../../../../src/features-v2/abilities/Bone/OnTheBrink.js';
import { mockCharacter, mockAdversary, runReviewOutcome } from '../helpers.js';

describe('On the Brink', () => {
  it('clears pending Minor (1 HP) loss when owner has 2 or fewer HP remaining', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 1, damageType: 'physical' },
    ];
    runReviewOutcome(
      { ...OnTheBrink, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
          appliedEffects: [],
        },
      }
    );
    expect(effects[0].amount).toBe(0);
  });

  it('does not clear Minor loss when owner has more than 2 HP remaining', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 3, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 1, damageType: 'physical' },
    ];
    runReviewOutcome(
      { ...OnTheBrink, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
          appliedEffects: [],
        },
      }
    );
    expect(effects[0].amount).toBe(1);
  });

  it('does not clear Major or higher (2+ HP) loss when on the brink', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 1, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2, damageType: 'physical' },
    ];
    runReviewOutcome(
      { ...OnTheBrink, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
          appliedEffects: [],
        },
      }
    );
    expect(effects[0].amount).toBe(2);
  });
});
