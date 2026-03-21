import { describe, it, expect } from 'vitest';
import { LockedOn } from '../../../../src/features-v2/weapon_properties/LockedOn.js';
import { runResolve, runIntent, mockAction, mockCharacter, mockAdversary, mockRoll } from '../helpers.js';

describe('Locked On', () => {
  it('stores target ID on successful attack', () => {
    const { mutations } = runResolve(LockedOn, {
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: 'adv-1' }),
      })
    );
  });

  it('does not store target ID on failed attack', () => {
    const { mutations } = runResolve(LockedOn, {
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const featureStateMutations = mutations.filter(
      (m) => m.type === 'setFeatureState' && m.payload?.key === 'lockedTargetId'
    );
    expect(featureStateMutations).toHaveLength(0);
  });

  it('adds large static bonus on intent when attacking locked target', () => {
    const { mutations, narrations } = runIntent(LockedOn, {
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'] }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Locked On', value: 100 }),
      })
    );
    expect(narrations.length).toBeGreaterThan(0);
  });

  it('clears locked target after applying auto-success', () => {
    const { mutations } = runIntent(LockedOn, {
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'] }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: null }),
      })
    );
  });

  it('does not add bonus when attacking a different target', () => {
    const adv2 = mockAdversary({ instanceId: 'adv-2' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [mockCharacter(), mockAdversary(), adv2],
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-2'] }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    const staticMutations = mutations.filter(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Locked On'
    );
    expect(staticMutations).toHaveLength(0);
  });

  it('does not add bonus on non-attack actions', () => {
    const { mutations } = runIntent(LockedOn, {
      action: mockAction({ type: 'trait', targetInstanceIds: ['adv-1'] }),
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
    });

    const staticMutations = mutations.filter(
      (m) => m.type === 'addRollStatic' && m.payload?.name === 'Locked On'
    );
    expect(staticMutations).toHaveLength(0);
  });

  it('does not store target on non-attack action', () => {
    const { mutations } = runResolve(LockedOn, {
      action: mockAction({ type: 'trait', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll({ isSuccess: true }),
    });

    const featureStateMutations = mutations.filter(
      (m) => m.type === 'setFeatureState' && m.payload?.key === 'lockedTargetId'
    );
    expect(featureStateMutations).toHaveLength(0);
  });
});
