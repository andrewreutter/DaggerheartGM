import { describe, it, expect } from 'vitest';
import { Eruptive } from '../../../../src/features-v2/weapon_properties/Eruptive.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Eruptive', () => {
  it('on a melee hit, splashes half damage to another adversary in Very Close of the target when reaction fails', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 28, tokenY: 0 });

    const effects = [
      {
        type: 'damage',
        target: adv1,
        amount: 9,
        source: char,
        damageType: 'physical',
      },
    ];

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: {
        ...mockAction({ type: 'attack', range: 'melee' }),
        actorInstanceId: char.instanceId,
        targetInstanceIds: [adv1.instanceId],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markHP', payload: { instanceId: 'adv-2', amount: 5 } })
    );
  });

  it('does nothing on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 28, tokenY: 0 });

    const effects = [
      {
        type: 'damage',
        target: adv1,
        amount: 9,
        source: char,
        damageType: 'physical',
      },
    ];

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: {
        ...mockAction({ type: 'attack', range: 'melee' }),
        actorInstanceId: char.instanceId,
        targetInstanceIds: [adv1.instanceId],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: false }),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });

  it('does not splash when the flat d20 meets or beats DC 14', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 28, tokenY: 0 });

    const effects = [
      {
        type: 'damage',
        target: adv1,
        amount: 9,
        source: char,
        damageType: 'physical',
      },
    ];

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: {
        ...mockAction({ type: 'attack', range: 'melee' }),
        actorInstanceId: char.instanceId,
        targetInstanceIds: [adv1.instanceId],
        effects,
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0.95,
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });
});
