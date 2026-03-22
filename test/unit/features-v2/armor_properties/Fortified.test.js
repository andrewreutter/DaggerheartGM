import { describe, it, expect } from 'vitest';
import { Fortified } from '../../../../src/features-v2/armor_properties/Fortified.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

describe('Fortified', () => {
  it('reduces pending HP loss by 1 when armor use is committed (useArmorByTargetId)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 },
    ];
    runReviewOutcome(
      { ...Fortified, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Strength',
          range: 'melee',
          effects,
          useArmorByTargetId: { 'char-1': true },
        },
      }
    );
    expect(effects[0].amount).toBe(1);
  });

  it('does not reduce HP loss when armor is not committed', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 },
    ];
    runReviewOutcome(
      { ...Fortified, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Strength',
          range: 'melee',
          effects,
        },
      }
    );
    expect(effects[0].amount).toBe(2);
  });

  it('reduces HP loss when useArmor is set on a damage effect for this target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 10,
        useArmor: true,
      },
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 1 },
    ];
    runReviewOutcome(
      { ...Fortified, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Strength',
          range: 'melee',
          effects,
        },
      }
    );
    expect(effects[1].amount).toBe(0);
  });
});
