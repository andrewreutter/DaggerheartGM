import { describe, it, expect } from 'vitest';
import { Resilient } from '../../../../src/features-v2/armor_properties/Resilient.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

describe('Resilient', () => {
  it('on d6 6: reduces pending HP loss by 1, revokes armor commitment, queues rollDie', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const action = {
      type: 'attack',
      actorInstanceId: 'adv-1',
      targetInstanceIds: ['char-1'],
      trait: 'Strength',
      range: 'melee',
      effects: [
        { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 },
      ],
      useArmorByTargetId: { 'char-1': true },
    };
    const { mutations } = runReviewOutcome(
      { ...Resilient, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.999,
        action,
      }
    );
    expect(action.effects[0].amount).toBe(1);
    expect(action.useArmorByTargetId['char-1']).toBe(false);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 6 }),
      })
    );
  });

  it('on d6 not 6: does not change HP or armor commitment', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 },
    ];
    runReviewOutcome(
      { ...Resilient, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.4,
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
    expect(effects[0].amount).toBe(2);
  });

  it('does nothing when more than one armor slot remains (even on 6)', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 2, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 },
    ];
    runReviewOutcome(
      { ...Resilient, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.999,
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
    expect(effects[0].amount).toBe(2);
  });

  it('reduces type:damage amount and clears useArmor on 6', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 4, useArmor: true },
    ];
    runReviewOutcome(
      { ...Resilient, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.999,
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
    expect(effects[0].amount).toBe(3);
    expect(effects[0].useArmor).toBe(false);
  });

  it('does not run when armor is not committed', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 1, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }];
    runReviewOutcome(
      { ...Resilient, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.999,
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
});
