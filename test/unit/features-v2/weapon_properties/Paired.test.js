import { describe, it, expect } from 'vitest';
import { Paired } from '../../../../src/features-v2/weapon_properties/Paired.js';
import { runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Paired', () => {
  it('adds damage bonus on melee attack scaled by secondary weapon tier', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      secondaryWeapon: { id: 'srd-wpn-shortsword', name: 'Shortsword', tier: 2, range: 'melee' },
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

  it('defaults to tier 1 (+2 bonus) when no secondary weapon is found', () => {
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

  it('does not add bonus on non-melee attacks', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      secondaryWeapon: { id: 'srd-wpn-shortsword', name: 'Shortsword', tier: 2, range: 'melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'close' }),
      rolls: mockRoll(),
    });

    const pairedMutation = mutations.find(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired'
    );
    expect(pairedMutation).toBeUndefined();
  });

  it('does not add bonus on non-attack actions', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      secondaryWeapon: { id: 'srd-wpn-shortsword', name: 'Shortsword', tier: 2, range: 'melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(Paired, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    const pairedMutation = mutations.find(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired'
    );
    expect(pairedMutation).toBeUndefined();
  });

  it('does not trigger when not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({
      instanceId: 'char-2',
      secondaryWeapon: { id: 'srd-wpn-shortsword', name: 'Shortsword', tier: 2, range: 'melee' },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent({ ...Paired, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', range: 'melee' }),
      rolls: mockRoll(),
    });

    const pairedMutation = mutations.find(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Paired'
    );
    expect(pairedMutation).toBeUndefined();
  });
});
