import { describe, it, expect } from 'vitest';
import { Eruptive } from '../../../../src/features-v2/weapon_properties/Eruptive.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Eruptive', () => {
  it('marks HP on nearby adversaries that fail the reaction roll on a successful melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const splash = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, target, splash],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0, // reaction roll: 2d12 → 2 (fails DC 14)
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markHP', payload: { instanceId: 'adv-2', amount: 2 } })
    );
  });

  it('does not mark HP on adversaries that succeed on the reaction roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const splash = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, target, splash],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 11 / 12, // reaction roll: 2d12 → 12+12 = 24 (succeeds DC 14)
    });

    expect(mutations.filter((m) => m.type === 'markHP' && m.payload.instanceId === 'adv-2')).toHaveLength(0);
  });

  it('does not trigger on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const splash = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, target, splash],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: false }),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });

  it('does not trigger on a non-melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 50, tokenY: 0 });
    const splash = mockAdversary({ instanceId: 'adv-2', tokenX: 55, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, target, splash],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'far',
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });

  it('does not trigger on a non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv],
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });

  it('does not splash damage to the primary target', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, target],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 4, damageType: 'physical' }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(mutations.filter((m) => m.type === 'markHP' && m.payload.instanceId === 'adv-1')).toHaveLength(0);
  });

  it('rounds half damage up (CONV-012)', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const splash = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, target, splash],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [{ stat: 'currentHP', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical' }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0,
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markHP', payload: { instanceId: 'adv-2', amount: 2 } })
    );
  });
});
