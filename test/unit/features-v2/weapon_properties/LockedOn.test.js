import { describe, it, expect } from 'vitest';
import { LockedOn } from '../../../../src/features-v2/weapon_properties/LockedOn.js';
import { runResolve, runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Locked On', () => {
  it('stores target ID in feature state on successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-1'],
      }),
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
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-1'],
      }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const setFeatureMutations = mutations.filter(
      (m) => m.type === 'setFeatureState' && m.payload?.value === 'adv-1'
    );
    expect(setFeatureMutations).toHaveLength(0);
  });

  it('forces hope outcome on next attack against locked target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations, narrations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-1'],
      }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    expect(narrations.some((n) => n.includes('Locked On') && n.includes('automatically succeeds'))).toBe(true);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: null }),
      })
    );
  });

  it('clears the locked target after forcing success', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-1'],
      }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: null }),
      })
    );
  });

  it('does not force success when attacking a different target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv1 = mockAdversary({ instanceId: 'adv-1' });
    const adv2 = mockAdversary({ instanceId: 'adv-2' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [char, adv1, adv2],
      action: mockAction({
        type: 'attack',
        targetInstanceIds: ['adv-2'],
      }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    const setOutcomeMutations = mutations.filter((m) => m.type === 'setOutcome');
    expect(setOutcomeMutations).toHaveLength(0);
  });

  it('does not fire on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait' }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    const setOutcomeMutations = mutations.filter((m) => m.type === 'setOutcome');
    expect(setOutcomeMutations).toHaveLength(0);
  });

  it('does not store target on non-attack actions', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const setFeatureMutations = mutations.filter(
      (m) => m.type === 'setFeatureState' && m.payload?.key === 'lockedTargetId'
    );
    expect(setFeatureMutations).toHaveLength(0);
  });
});
