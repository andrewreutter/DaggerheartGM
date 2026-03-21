import { describe, it, expect } from 'vitest';
import { Burning } from '../../../../src/features-v2/weapon_properties/Burning.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Burning', () => {
  it('marks 1 Stress on target when one damage die rolls a 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Burning, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 6 }] }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'adv-1', amount: 1 } })
    );
  });

  it('marks 2 Stress when two damage dice each roll a 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Burning, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 6 },
          { name: 'bonus', die: 'd6', value: 6 },
        ],
      }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'adv-1', amount: 2 } })
    );
  });

  it('does not mark Stress when no damage die rolls a 6', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Burning, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 5 }] }),
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not mark Stress on a non-attack action even when a damage die shows 6 (CONV-025)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(Burning, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 6 }] }),
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not trigger when the character is not the acting entity', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // Annotate feature so owner is char-2; actor is char-1 → isActing is false
    const { mutations } = runResolve({ ...Burning, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ damageDice: [{ name: 'weapon', die: 'd8', value: 6 }] }),
    });

    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});
