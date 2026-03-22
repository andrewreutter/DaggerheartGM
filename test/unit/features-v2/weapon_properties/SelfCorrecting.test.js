import { describe, it, expect } from 'vitest';
import { SelfCorrecting } from '../../../../src/features-v2/weapon_properties/SelfCorrecting.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('SelfCorrecting', () => {
  it('adds 5 to damage amount when one damage die shows a 1 (deals 6 instead)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 1, damageType: 'physical', source: char }];

    runReviewAction(SelfCorrecting, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 1 }] }),
    });

    expect(effects[0].amount).toBe(6);
  });

  it('adds 10 to damage amount when two damage dice each show a 1', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 2, damageType: 'physical', source: char }];

    runReviewAction(SelfCorrecting, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 1 },
          { name: 'bonus', die: 'd6', value: 1 },
        ],
      }),
    });

    expect(effects[0].amount).toBe(12);
  });

  it('does not change damage when no damage die shows a 1', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char }];

    runReviewAction(SelfCorrecting, {
      activeElements: [char, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });

    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger when the feature owner is not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 1, damageType: 'physical', source: char }];

    runReviewAction({ ...SelfCorrecting, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: { ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }), effects },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 1 }] }),
    });

    expect(effects[0].amount).toBe(1);
  });
});
