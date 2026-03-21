import { describe, it, expect } from 'vitest';
import { LockedOn } from '../../../../src/features-v2/weapon_properties/LockedOn.js';
import { runResolve, runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Locked On', () => {
  it('stores the target ID in feature state on successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: 'adv-1' }),
      })
    );
  });

  it('does not store target on failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const featureStateMutations = mutations.filter((m) => m.type === 'setFeatureState');
    expect(featureStateMutations).toHaveLength(0);
  });

  it('adds a large static bonus when attacking the locked target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations, narrations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ name: 'Locked On', value: 100 }),
      })
    );
    expect(narrations.some((n) => n.includes('automatically succeeds'))).toBe(true);
  });

  it('clears the locked target after using the bonus', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: null }),
      })
    );
  });

  it('does not add bonus when attacking a different target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv1 = mockAdversary({ instanceId: 'adv-1' });
    const adv2 = mockAdversary({ instanceId: 'adv-2' });

    const { mutations, narrations } = runIntent(LockedOn, {
      activeElements: [char, adv1, adv2],
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-2'] }),
    });

    const addStaticMuts = mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Locked On');
    expect(addStaticMuts).toHaveLength(0);
    expect(narrations.filter((n) => n.includes('automatically succeeds'))).toHaveLength(0);
  });

  it('does not trigger on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const featureStateMutations = mutations.filter((m) => m.type === 'setFeatureState');
    expect(featureStateMutations).toHaveLength(0);
  });
});
