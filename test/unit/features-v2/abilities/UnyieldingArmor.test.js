import { describe, it, expect } from 'vitest';
import { UnyieldingArmor } from '../../../../src/features-v2/abilities/Valor/UnyieldingArmor.js';
import { runReviewOutcome, mockCharacter, mockAdversary } from '../helpers.js';

describe('Valor — Unyielding Armor', () => {
  it('rolls proficiency d6s; on any 6 reduces severity and revokes armor commitment', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      proficiency: 3,
      currentArmor: 2,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const action = {
      type: 'attack',
      actorInstanceId: 'adv-1',
      targetInstanceIds: ['char-1'],
      trait: 'Strength',
      range: 'melee',
      effects: [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }],
      useArmorByTargetId: { 'char-1': true },
    };
    const { mutations } = runReviewOutcome(
      { ...UnyieldingArmor, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.999,
        action,
      }
    );
    expect(action.effects[0].amount).toBe(1);
    expect(action.useArmorByTargetId['char-1']).toBe(false);
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(3);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6', total: 6 }),
      })
    );
  });

  it('when no die shows 6, leaves HP and armor commitment unchanged', () => {
    const char = mockCharacter({ instanceId: 'char-1', proficiency: 2, currentArmor: 2, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }];
    runReviewOutcome(
      { ...UnyieldingArmor, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _rng: () => 0.5,
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

  it('with proficiency 0, rolls no dice and does not change effects', () => {
    const char = mockCharacter({ instanceId: 'char-1', proficiency: 0, currentArmor: 2, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }];
    const { mutations } = runReviewOutcome(
      { ...UnyieldingArmor, _ownerInstanceId: 'char-1' },
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
    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
  });

  it('does not run when armor is not committed', () => {
    const char = mockCharacter({ instanceId: 'char-1', proficiency: 3, currentArmor: 2, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: { instanceId: 'char-1' }, amount: 2 }];
    runReviewOutcome(
      { ...UnyieldingArmor, _ownerInstanceId: 'char-1' },
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
