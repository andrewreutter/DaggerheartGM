import { describe, it, expect } from 'vitest';
import { Paired } from '../../../../src/features-v2/weapon_properties/Paired.js';
import { runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

const pairedMutations = (mutations) =>
  mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired');

describe('Paired', () => {
  it('adds damage bonus on melee attack (tier 1 = +2)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w1', name: 'Shortsword', tier: 1, feature: ['Paired'], range: 'Melee', trait: 'Agility', damage: 'd6 phy' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Paired', value: 2 }),
      })
    );
  });

  it('scales bonus with tier (tier 3 = +4)', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w2', name: 'Advanced Shortsword', tier: 3, feature: ['Paired'], range: 'Melee', trait: 'Agility', damage: 'd6 phy' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Paired', value: 4 }),
      })
    );
  });

  it('does not add bonus when attack is not melee', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w1', name: 'Shortsword', tier: 1, feature: ['Paired'], range: 'Melee', trait: 'Agility', damage: 'd6 phy' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'close' }),
    });

    expect(pairedMutations(mutations)).toHaveLength(0);
  });

  it('does not add bonus on non-attack actions', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      weapons: [{ id: 'w1', name: 'Shortsword', tier: 1, feature: ['Paired'], range: 'Melee', trait: 'Agility', damage: 'd6 phy' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
    });

    expect(pairedMutations(mutations)).toHaveLength(0);
  });

  it('does not add bonus when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({
      instanceId: 'char-2',
      weapons: [{ id: 'w1', name: 'Shortsword', tier: 1, feature: ['Paired'], range: 'Melee', trait: 'Agility', damage: 'd6 phy' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Paired, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
    });

    expect(pairedMutations(mutations)).toHaveLength(0);
  });
});
