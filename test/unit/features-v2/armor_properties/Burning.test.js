import { describe, it, expect } from 'vitest';
import { Burning } from '../../../../src/features-v2/armor_properties/Burning.js';
import { runReviewAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Burning', () => {
  it('marks 1 Stress on the attacker when attacked at melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Burning, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });

  it('does not mark Stress when the attack is not at melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(Burning, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        range: 'close',
        effects: [],
        appliedEffects: [],
      },
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not mark Stress when the armor wearer is not targeted', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...Burning, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char1, char2, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-2'],
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      }
    );

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not mark Stress when a character attacks you at melee (adversaries only per SRD)', () => {
    const target = mockCharacter({ instanceId: 'char-1' });
    const attacker = mockCharacter({ instanceId: 'char-2' });

    const { mutations } = runReviewAction(Burning, {
      activeElements: [target, attacker],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-2',
        targetInstanceIds: ['char-1'],
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});
