import { describe, it, expect } from 'vitest';
import { DoubleDuty } from '../../../../src/features-v2/weapon_properties/DoubleDuty.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

describe('Double Duty', () => {
  it('declares +1 Armor Score', () => {
    expect(DoubleDuty.passiveStatMods).toEqual({ armorScore: 1 });
  });

  it('adds +1 damage static on melee attacks when acting', () => {
    const { mutations } = runIntent(DoubleDuty, {
      action: mockAction({ type: 'attack', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Double Duty', value: 1 }),
      })
    );
  });

  it('does not add static when attack is not melee range', () => {
    const { mutations } = runIntent(DoubleDuty, {
      action: mockAction({ type: 'attack', range: 'close' }),
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('does not add static when another character owns the feature', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...DoubleDuty, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
