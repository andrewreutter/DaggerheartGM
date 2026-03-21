import { describe, it, expect } from 'vitest';
import { Eruptive } from '../../../../src/features-v2/weapon_properties/Eruptive.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Eruptive', () => {
  it('deals half damage to nearby adversaries that fail the reaction roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-2', name: 'Nearby Goblin', tokenX: 5, tokenY: 5 });

    const { mutations, narrations } = runReviewAction(Eruptive, {
      _rng: () => 0.1, // d20 rolls low → fails DC 14
      activeElements: [char, target, nearby],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'melee' }),
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 10, damageType: 'physical' },
        ],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(narrations.some((n) => n.includes('fails reaction roll'))).toBe(true);
  });

  it('does not splash when the attack misses', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-2', name: 'Nearby Goblin', tokenX: 5, tokenY: 5 });

    const { narrations } = runReviewAction(Eruptive, {
      activeElements: [char, target, nearby],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'melee' }),
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 10, damageType: 'physical' },
        ],
      },
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(narrations.filter((n) => n.includes('reaction roll'))).toHaveLength(0);
  });

  it('does not trigger on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { narrations } = runReviewAction(Eruptive, {
      activeElements: [char, target],
      action: {
        ...mockAction({ type: 'trait', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'melee' }),
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 10, damageType: 'physical' },
        ],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(narrations.filter((n) => n.includes('reaction roll'))).toHaveLength(0);
  });

  it('does not trigger on non-melee attacks', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 50, tokenY: 0 });

    const { narrations } = runReviewAction(Eruptive, {
      activeElements: [char, target],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'far' }),
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 10, damageType: 'physical' },
        ],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(narrations.filter((n) => n.includes('reaction roll'))).toHaveLength(0);
  });

  it('adversaries that succeed the reaction roll avoid splash damage', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const target = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const nearby = mockAdversary({ instanceId: 'adv-2', name: 'Nearby Goblin', tokenX: 5, tokenY: 5 });

    const { narrations } = runReviewAction(Eruptive, {
      _rng: () => 0.99, // d20 rolls high → succeeds DC 14
      activeElements: [char, target, nearby],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], range: 'melee' }),
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 10, damageType: 'physical' },
        ],
      },
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(narrations.some((n) => n.includes('succeeds reaction roll'))).toBe(true);
    expect(narrations.some((n) => n.includes('fails reaction roll'))).toBe(false);
  });
});
