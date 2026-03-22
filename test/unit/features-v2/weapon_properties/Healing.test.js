import { describe, it, expect } from 'vitest';
import { Healing } from '../../../../src/features-v2/weapon_properties/Healing.js';
import { runIntent, mockCharacter, mockAdversary } from '../helpers.js';

describe('Healing', () => {
  it('clears 1 HP from the weapon owner during a short rest', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 3, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Healing, {
      activeElements: [char, adv],
      actionType: 'shortRest',
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('clears 1 HP from the weapon owner during a long rest', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Healing, {
      activeElements: [char, adv],
      actionType: 'longRest',
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'clearHP', payload: { instanceId: 'char-1', amount: 1 } })
    );
  });

  it('does not clear HP on a regular attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Healing, {
      activeElements: [char, adv],
      actionType: 'attack',
    });

    expect(mutations.filter((m) => m.type === 'clearHP')).toHaveLength(0);
  });
});
