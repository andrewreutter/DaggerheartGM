import { describe, it, expect } from 'vitest';
import { Eruptive } from '../../../../src/features-v2/weapon_properties/Eruptive.js';
import { runResolve, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Eruptive', () => {
  it('triggers action loops on nearby adversaries on successful melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', range: 'melee', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const actionLoopMuts = mutations.filter(
      (m) => m.type === 'actionLoop' && m.payload.instanceId === 'adv-2'
    );
    expect(actionLoopMuts).toHaveLength(1);
    expect(actionLoopMuts[0].payload).toEqual(
      expect.objectContaining({
        title: 'Eruptive',
        trait: 'Instinct',
        difficulty: 14,
      })
    );
  });

  it('does not trigger on failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', range: 'melee', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(mutations).toHaveLength(0);
  });

  it('does not trigger on non-melee attack', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 50, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', range: 'far', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toHaveLength(0);
  });

  it('does not trigger on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const adv2 = mockAdversary({ instanceId: 'adv-2', tokenX: 8, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'trait', range: 'melee', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toHaveLength(0);
  });

  it('does not affect the primary target', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv1 = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runResolve(Eruptive, {
      activeElements: [char, adv1],
      action: mockAction({ type: 'attack', range: 'melee', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const actionLoopMuts = mutations.filter((m) => m.type === 'actionLoop');
    expect(actionLoopMuts).toHaveLength(0);
  });
});
