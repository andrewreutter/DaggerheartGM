import { describe, it, expect } from 'vitest';
import { Channeling } from '../../../../src/features-v2/armor_properties/Channeling.js';
import { runIntent, mockCharacter, mockAdversary } from '../helpers.js';

describe('Channeling', () => {
  it('adds +1 static to spellcast rolls when the owner is acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Channeling, {
      activeElements: [char, adv],
      actionType: 'spellcast',
      action: {
        type: 'spellcast',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        effects: [],
      },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Channeling', value: 1 }),
      })
    );
  });

  it('does not add bonus for non-spellcast action types', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Channeling, {
      activeElements: [char, adv],
      actionType: 'attack',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        range: 'melee',
        effects: [],
      },
    });

    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });

  it('does not add bonus when a different character is acting', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...Channeling, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char1, char2, adv],
        actionType: 'spellcast',
        action: {
          type: 'spellcast',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
        },
      }
    );

    expect(mutations.filter((m) => m.type === 'addRollStatic')).toHaveLength(0);
  });
});
