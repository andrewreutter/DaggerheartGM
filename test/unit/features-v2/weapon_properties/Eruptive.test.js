import { describe, it, expect } from 'vitest';
import { Eruptive } from '../../../../src/features-v2/weapon_properties/Eruptive.js';
import { runResolve, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Eruptive', () => {
  it('marks HP on nearby adversaries that fail the reaction roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', tokenX: 8, tokenY: 0 });

    const effects = [
      { stat: 'currentHP', amount: 2, target: target },
    ];

    const { mutations, narrations } = runResolve(Eruptive, {
      _rng: () => 0,
      activeElements: [char, target, nearby],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-target'],
        trait: 'Strength',
        range: 'melee',
        effects,
        appliedEffects: effects,
      },
      rolls: { action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false }, damage: { dice: [], statics: [] }, other: {} },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markHP', payload: { instanceId: 'adv-nearby', amount: 1 } })
    );
    expect(narrations.length).toBeGreaterThan(0);
  });

  it('does not mark HP on nearby adversaries that succeed the reaction roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', tokenX: 8, tokenY: 0 });

    const effects = [
      { stat: 'currentHP', amount: 2, target: target },
    ];

    const { mutations } = runResolve(Eruptive, {
      _rng: () => 0.99,
      activeElements: [char, target, nearby],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-target'],
        trait: 'Strength',
        range: 'melee',
        effects,
        appliedEffects: effects,
      },
      rolls: { action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false }, damage: { dice: [], statics: [] }, other: {} },
    });

    expect(mutations.filter((m) => m.type === 'markHP' && m.payload.instanceId === 'adv-nearby')).toHaveLength(0);
  });

  it('does not fire on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', tokenX: 8, tokenY: 0 });

    const effects = [
      { stat: 'currentHP', amount: 2, target: target },
    ];

    const { mutations } = runResolve(Eruptive, {
      _rng: () => 0,
      activeElements: [char, target, nearby],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-target'],
        trait: 'Strength',
        range: 'melee',
        effects,
        appliedEffects: effects,
      },
      rolls: { action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: false, isCritical: false }, damage: { dice: [], statics: [] }, other: {} },
    });

    expect(mutations.filter((m) => m.type === 'markHP' && m.payload.instanceId === 'adv-nearby')).toHaveLength(0);
  });

  it('does not fire on a non-melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 50, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', tokenX: 8, tokenY: 0 });

    const effects = [
      { stat: 'currentHP', amount: 2, target: target },
    ];

    const { mutations } = runResolve(Eruptive, {
      _rng: () => 0,
      activeElements: [char, target, nearby],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-target'],
        trait: 'Agility',
        range: 'far',
        effects,
        appliedEffects: effects,
      },
      rolls: { action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false }, damage: { dice: [], statics: [] }, other: {} },
    });

    expect(mutations.filter((m) => m.type === 'markHP' && m.payload.instanceId === 'adv-nearby')).toHaveLength(0);
  });

  it('does not fire on a non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 5, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      _rng: () => 0,
      activeElements: [char, target],
      action: {
        type: 'trait',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-target'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
      rolls: { action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [], isSuccess: true, isCritical: false }, damage: { dice: [], statics: [] }, other: {} },
    });

    expect(mutations.filter((m) => m.type === 'markHP')).toHaveLength(0);
  });
});
