import { describe, it, expect } from 'vitest';
import { Sharpwing } from '../../../../src/features-v2/weapon_properties/Sharpwing.js';
import { runIntent, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Sharpwing', () => {
  it('adds the character\'s Agility value as a static bonus to the damage roll', () => {
    const char = mockCharacter({ instanceId: 'char-1', traits: { agility: 3, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Sharpwing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Sharpwing', value: 3 }),
      })
    );
  });

  it('does not add a bonus when Agility is 0', () => {
    const char = mockCharacter({ instanceId: 'char-1', traits: { agility: 0, strength: 1, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Sharpwing, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Sharpwing')).toHaveLength(0);
  });

  it('does not add a bonus when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1', traits: { agility: 2, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } });
    const other = mockCharacter({ instanceId: 'char-2', traits: { agility: 4, strength: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 } });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Sharpwing, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Sharpwing')).toHaveLength(0);
  });
});
