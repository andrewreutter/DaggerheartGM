import { describe, it, expect } from 'vitest';
import { Long } from '../../../../src/features-v2/weapon_properties/Long.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

const WID = 'w-long';

function longFeat() {
  return { ...Long, _ownerInstanceId: 'char-1', _weaponId: WID };
}

describe('Long', () => {
  it('on a successful hit, applies the same damage to another adversary on the line from attacker to primary target', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMid = mockAdversary({ instanceId: 'adv-mid', tokenX: 10, tokenY: 0 });
    const advPrimary = mockAdversary({ instanceId: 'adv-primary', tokenX: 20, tokenY: 0 });

    const effects = [
      {
        type: 'damage',
        target: advPrimary,
        amount: 4,
        source: char,
        damageType: 'physical',
      },
    ];

    const { mutations } = runResolve(longFeat(), {
      activeElements: [char, advMid, advPrimary],
      action: {
        ...mockAction({ type: 'attack', range: 'melee', weaponId: WID }),
        actorInstanceId: char.instanceId,
        targetInstanceIds: [advPrimary.instanceId],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markHP', payload: { instanceId: 'adv-mid', amount: 4 } })
    );
  });

  it('does not hit adversaries off the attack line', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advOff = mockAdversary({ instanceId: 'adv-off', tokenX: 10, tokenY: 15 });
    const advPrimary = mockAdversary({ instanceId: 'adv-primary', tokenX: 20, tokenY: 0 });

    const effects = [
      {
        type: 'damage',
        target: advPrimary,
        amount: 4,
        source: char,
        damageType: 'physical',
      },
    ];

    const { mutations } = runResolve(longFeat(), {
      activeElements: [char, advOff, advPrimary],
      action: {
        ...mockAction({ type: 'attack', range: 'melee', weaponId: WID }),
        actorInstanceId: char.instanceId,
        targetInstanceIds: [advPrimary.instanceId],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });

  it('does nothing when the attack misses', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const advMid = mockAdversary({ instanceId: 'adv-mid', tokenX: 10, tokenY: 0 });
    const advPrimary = mockAdversary({ instanceId: 'adv-primary', tokenX: 20, tokenY: 0 });

    const effects = [
      {
        type: 'damage',
        target: advPrimary,
        amount: 4,
        source: char,
        damageType: 'physical',
      },
    ];

    const { mutations } = runResolve(longFeat(), {
      activeElements: [char, advMid, advPrimary],
      action: {
        ...mockAction({ type: 'attack', range: 'melee', weaponId: WID }),
        actorInstanceId: char.instanceId,
        targetInstanceIds: [advPrimary.instanceId],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });
});
