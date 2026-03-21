import { describe, it, expect } from 'vitest';
import { Brutal } from '../../../../src/features-v2/weapon_properties/Brutal.js';
import { runReviewAction, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Brutal', () => {
  it('adds extra damage when a single damage die rolls its maximum face', () => {
    // d8 rolls 8 (max); extra d8 forced to roll 5 via _rng
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 8, damageType: 'physical', source: char }];
    const { mutations } = runReviewAction(Brutal, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 8 }] }),
      // _rng returns 4/8 → face = floor(4/8 * 8) + 1 = 5
      _rng: () => 4 / 8,
    });

    // rollDie mutation should be queued for the extra die
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'rollDie', payload: expect.objectContaining({ notation: 'd8' }) })
    );
    // The damage effect amount should be modified (8 + 5 = 13)
    expect(effects[0].amount).toBe(13);
  });

  it('does not add extra damage when no die rolls its maximum face', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 5, damageType: 'physical', source: char }];
    const { mutations } = runReviewAction(Brutal, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(5);
  });

  it('does not trigger for multi-die notation entries (only simple dN format)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // '2d6' with value 12 (max for 2d6) should NOT trigger — we can't tell per-die
    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 12, damageType: 'physical', source: char }];
    const { mutations } = runReviewAction(Brutal, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'attack' }),
        effects,
      },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: '2d6', value: 12 }] }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(12);
  });

  it('does not add damage when it is not the acting character', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [{ type: 'damage', target: { instanceId: 'adv-1' }, amount: 8, damageType: 'physical', source: char }];
    // Annotate feature so that owner is char-2; actor is char-1 → isActing is false
    const { mutations } = runReviewAction({ ...Brutal, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: {
        ...mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
        effects,
      },
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 8 }] }),
    });

    expect(mutations.filter((m) => m.type === 'rollDie')).toHaveLength(0);
    expect(effects[0].amount).toBe(8);
  });
});
