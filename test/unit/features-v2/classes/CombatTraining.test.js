import { describe, it, expect } from 'vitest';
import { CombatTraining } from '../../../../src/features-v2/classes/Warrior.js';
import { runReviewAction, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Combat Training (Warrior)', () => {
  it('adds the character level to physical damage on the action target (reviewAction)', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' },
    ];

    runReviewAction(
      { ...CombatTraining, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: [adv.instanceId],
          effects,
        }),
      }
    );

    expect(effects[0].amount).toBe(7);
  });

  it('does not add level when damage is magic', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'magic' },
    ];

    runReviewAction(
      { ...CombatTraining, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: [adv.instanceId],
          effects,
        }),
      }
    );

    expect(effects[0].amount).toBe(4);
  });

  it('does not modify damage when action type is not attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' },
    ];

    runReviewAction(
      { ...CombatTraining, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: mockAction({
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: [adv.instanceId],
          effects,
        }),
      }
    );

    expect(effects[0].amount).toBe(4);
  });
});
