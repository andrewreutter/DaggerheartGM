import { describe, it, expect } from 'vitest';
import { Sharp } from '../../../../src/features-v2/armor_properties/Sharp.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Sharp', () => {
  it('adds d4 to damage on a successful melee attack (armor wearer acting)', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];

    const { mutations } = runReviewAction(Sharp, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true, damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
      _rng: () => 0.5,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd4' }) })
    );
    expect(effects[0].amount).toBe(8);
  });

  it('does not add damage when the attack is not at melee range', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 200, tokenY: 0 });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];

    const { mutations } = runReviewAction(Sharp, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });

  it('does not add damage when the attack roll failed', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];

    const { mutations } = runReviewAction(Sharp, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger when the armor owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const other = mockCharacter({ instanceId: 'char-2', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char },
    ];

    const { mutations } = runReviewAction({ ...Sharp, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });
});
