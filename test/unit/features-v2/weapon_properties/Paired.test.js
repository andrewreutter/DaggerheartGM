import { describe, it, expect } from 'vitest';
import { Paired } from '../../../../src/features-v2/weapon_properties/Paired.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

const pairedMutations = (mutations) =>
  mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired');

describe('Paired', () => {
  it('adds a damage bonus based on secondary weapon tier at melee range', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      secondaryWeapon: { id: 'srd-wpn-paired-dagger', name: 'Paired Dagger', tier: 2, range: 'melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Paired', value: 3 }),
      })
    );
  });

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ])('tier %i secondary weapon gives +%i damage bonus', (tier, expectedBonus) => {
    const char = mockCharacter({
      instanceId: 'char-1',
      secondaryWeapon: { id: 'srd-wpn-paired', name: 'Paired Weapon', tier, range: 'melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    const pairedStatics = pairedMutations(mutations);
    expect(pairedStatics).toHaveLength(1);
    expect(pairedStatics[0].payload.value).toBe(expectedBonus);
  });

  it('defaults to tier 1 (+2 bonus) when secondary weapon is not found', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Paired', value: 2 }),
      })
    );
  });

  it('does not add bonus at non-melee range', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      secondaryWeapon: { id: 'srd-wpn-paired', name: 'Paired Weapon', tier: 2, range: 'melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'close' }),
      rolls: mockRoll(),
    });

    expect(pairedMutations(mutations)).toHaveLength(0);
  });

  it('does not add bonus when the owner is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Paired, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(pairedMutations(mutations)).toHaveLength(0);
  });

  it('does not add bonus on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    expect(pairedMutations(mutations)).toHaveLength(0);
  });
});
