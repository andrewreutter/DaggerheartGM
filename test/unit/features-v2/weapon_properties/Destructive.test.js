import { describe, it, expect } from 'vitest';
import { Destructive } from '../../../../src/features-v2/weapon_properties/Destructive.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Destructive', () => {
  it('has correct passive stat mods', () => {
    expect(Destructive.passiveStatMods).toEqual({
      agility: -1
    });
  });

  it('marks stress on adversaries within Very Close range on successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 }); // melee
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 10, tokenY: 0 }); // veryClose
    const adv3 = mockAdversary({ instanceId: 'adv-3', tokenX: 30, tokenY: 0 }); // close

    const { mutations } = runResolve(Destructive, {
      activeElements: [char, adv1, adv2, adv3],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true })
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'adv-1', amount: 1 } })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'markStress', payload: { instanceId: 'adv-2', amount: 1 } })
    );
    expect(mutations.filter(m => m.payload.instanceId === 'adv-3')).toHaveLength(0);
  });

  it('does not mark stress on failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runResolve(Destructive, {
      activeElements: [char, adv1],
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false })
    });

    expect(mutations).toHaveLength(0);
  });
});
