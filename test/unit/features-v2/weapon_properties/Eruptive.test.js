import { describe, it, expect } from 'vitest';
import { Eruptive } from '../../../../src/features-v2/weapon_properties/Eruptive.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Eruptive', () => {
  it('narrates splash damage on nearby adversaries that fail reaction rolls on successful melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', name: 'Target Orc', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', name: 'Nearby Goblin', tokenX: 8, tokenY: 0 });

    const { narrations } = runResolve(Eruptive, {
      activeElements: [char, target, nearby],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-target'],
        range: 'melee',
      }),
      rolls: mockRoll({
        isSuccess: true,
        damageDice: [{ name: 'weapon', die: 'd8', value: 6 }],
        damageStatics: [{ name: 'bonus', value: 2 }],
      }),
      _rng: () => 0.1, // Forces low d20 rolls (fail reaction)
    });

    expect(narrations.length).toBeGreaterThan(0);
    expect(narrations.some((n) => n.includes('Nearby Goblin') && n.includes('fails reaction roll'))).toBe(true);
    expect(narrations.some((n) => n.includes('4 splash damage'))).toBe(true); // ceil((6+2)/2) = 4
  });

  it('narrates pass when nearby adversary succeeds on reaction roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', name: 'Target Orc', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', name: 'Nearby Goblin', tokenX: 8, tokenY: 0 });

    const { narrations } = runResolve(Eruptive, {
      activeElements: [char, target, nearby],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-target'],
        range: 'melee',
      }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0.95, // Forces high d20 roll (pass reaction)
    });

    expect(narrations.some((n) => n.includes('Nearby Goblin') && n.includes('passes reaction roll'))).toBe(true);
  });

  it('does not fire on failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', tokenX: 8, tokenY: 0 });

    const { narrations } = runResolve(Eruptive, {
      activeElements: [char, target, nearby],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-target'],
        range: 'melee',
      }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(narrations).toHaveLength(0);
  });

  it('does not fire on non-melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 30, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-nearby', tokenX: 8, tokenY: 0 });

    const { narrations } = runResolve(Eruptive, {
      activeElements: [char, target, nearby],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-target'],
        range: 'close',
      }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(narrations).toHaveLength(0);
  });

  it('does not fire on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', tokenX: 5, tokenY: 0 });

    const { narrations } = runResolve(Eruptive, {
      activeElements: [char, target],
      action: mockAction({ type: 'trait', range: 'melee' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(narrations).toHaveLength(0);
  });

  it('excludes the primary target from splash damage', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-target', name: 'Target', tokenX: 5, tokenY: 0 });

    const { narrations } = runResolve(Eruptive, {
      activeElements: [char, target],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-target'],
        range: 'melee',
      }),
      rolls: mockRoll({ isSuccess: true }),
      _rng: () => 0.1,
    });

    expect(narrations).toHaveLength(0);
  });
});
