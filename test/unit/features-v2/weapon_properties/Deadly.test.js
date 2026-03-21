import { describe, it, expect } from 'vitest';
import { Deadly } from '../../../../src/features-v2/weapon_properties/Deadly.js';
import { runReviewOutcome, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Deadly', () => {
  it('adds 1 HP to target effects with amount >= 3', () => {
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', amount: 3, target: adv },
      { stat: 'currentHP', amount: 2, target: adv },
      { stat: 'currentStress', amount: 3, target: adv },
    ];

    runReviewOutcome(Deadly, {
      action: mockAction({ effects }),
    });

    expect(effects[0].amount).toBe(4);
    expect(effects[1].amount).toBe(2);
    expect(effects[2].amount).toBe(3);
  });

  it('does not modify HP effects targeting the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { stat: 'currentHP', amount: 3, target: adv },   // action target — should increase
      { stat: 'currentHP', amount: 3, target: char },  // attacker — should NOT increase
    ];

    runReviewOutcome(Deadly, {
      activeElements: [char, adv],
      action: mockAction({ actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], effects }),
    });

    expect(effects[0].amount).toBe(4);
    expect(effects[1].amount).toBe(3);
  });
});
