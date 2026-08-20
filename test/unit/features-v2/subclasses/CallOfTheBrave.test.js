import { describe, it, expect } from 'vitest';
import {
  Courage,
  BattleRitual,
  RiseToTheChallenge,
  Camaraderie,
} from '../../../../src/features-v2/subclasses/CallOfTheBrave.js';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { runResolve, runIntent, mockAction } from '../helpers.js';
import { mockGameState, mockRoll, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';

describe('Call of the Brave — Courage', () => {
  it('onResolve queues gainHope when the acting PC fails with Fear higher than Hope', () => {
    const { mutations } = runResolve(
      { ...Courage, _ownerInstanceId: 'char-1' },
      {
        rolls: mockRoll({ isSuccess: false, hopeValue: 3, fearValue: 9 }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('does not grant Hope on a successful roll', () => {
    const { mutations } = runResolve(
      { ...Courage, _ownerInstanceId: 'char-1' },
      {
        rolls: mockRoll({ isSuccess: true, hopeValue: 3, fearValue: 10 }),
      }
    );
    expect(mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });

  it('does not grant Hope when Fear is not higher than Hope', () => {
    const { mutations } = runResolve(
      { ...Courage, _ownerInstanceId: 'char-1' },
      {
        rolls: mockRoll({ isSuccess: false, hopeValue: 8, fearValue: 4 }),
      }
    );
    expect(mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });
});

describe('Call of the Brave — Battle Ritual', () => {
  it('default card clears 2 Stress and gains 2 Hope (long rest frequency on chip)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Battle Ritual',
      })
    );
    const annotated = { ...BattleRitual, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotated], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');

    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
  });
});

describe('Call of the Brave — Rise to the Challenge', () => {
  const feature = { ...RiseToTheChallenge, _ownerInstanceId: 'char-1' };

  it('queues setDie d20 on intent when ≤2 HP remain (currentHp = remaining)', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 2, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feature, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'hopeDie', die: 'd20' }),
      })
    );
  });

  it('queues setDie d20 at 0 HP remaining', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 0, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feature, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setDie',
        payload: expect.objectContaining({ die: 'd20' }),
      })
    );
  });

  it('does not change Hope die when more than 2 HP remain', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 3, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feature, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });
    expect(mutations.filter((m) => m.type === 'setDie')).toHaveLength(0);
  });

  it('does not throw when hopeDie is absent (e.g. GM die roll)', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentHp: 1, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(feature, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({
        action: { gmDie: { value: 10 }, hopeDie: null, fearDie: null, dice: [], statics: [] },
      }),
    });
    expect(mutations.filter((m) => m.type === 'setDie')).toHaveLength(0);
  });
});

describe('Call of the Brave — Camaraderie', () => {
  it('declares an extra Tag Team initiation and a partner Hope discount', () => {
    expect(Camaraderie.extraTagTeamInitiationsPerSession).toBe(1);
    expect(Camaraderie.tagTeamPartnerHopeDiscount).toBe(1);
  });
});
