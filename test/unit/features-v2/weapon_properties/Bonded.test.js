import { describe, it, expect } from 'vitest';
import { Bonded } from '../../../../src/features-v2/weapon_properties/Bonded.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Bonded', () => {
  it('adds the character\'s level as a static bonus to the damage roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 4 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Bonded, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Bonded', value: 4 }),
      })
    );
  });

  it('defaults missing level to 1 for the bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    delete char.level;
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Bonded, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Bonded', value: 1 }),
      })
    );
  });

  it('does not add a bonus when level is explicitly 0', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Bonded, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Bonded')).toHaveLength(0);
  });

  it('does not add a bonus when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 5 });
    const other = mockCharacter({ instanceId: 'char-2', level: 9 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Bonded, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Bonded')).toHaveLength(0);
  });
});
