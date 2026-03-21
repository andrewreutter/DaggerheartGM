import { describe, it, expect } from 'vitest';
import { LockedOn } from '../../../../src/features-v2/weapon_properties/LockedOn.js';
import { runResolve, runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Locked On', () => {
  it('stores the target instanceId in feature state on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedOnTarget', value: 'adv-1' }),
      })
    );
  });

  it('does not store target on a failed attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('does not store target on a non-attack action', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'trait', actorInstanceId: 'char-1' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('sets outcome to hope and adds narration when attacking the locked-on target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations, narrations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      featureState: { 'Locked On': { lockedOnTarget: 'adv-1' } },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'setRollOutcome', payload: expect.objectContaining({ outcome: 'hope' }) })
    );
    expect(narrations.length).toBeGreaterThan(0);
  });

  it('clears the locked-on target after triggering', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [char, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      featureState: { 'Locked On': { lockedOnTarget: 'adv-1' } },
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedOnTarget', value: null }),
      })
    );
  });

  it('does not trigger auto-success when attacking a different target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv1 = mockAdversary({ instanceId: 'adv-1' });
    const adv2 = mockAdversary({ instanceId: 'adv-2' });

    const { mutations, narrations } = runIntent(LockedOn, {
      activeElements: [char, adv1, adv2],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-2'] }),
      featureState: { 'Locked On': { lockedOnTarget: 'adv-1' } },
    });

    expect(mutations.filter((m) => m.type === 'setRollOutcome')).toHaveLength(0);
    expect(narrations).toHaveLength(0);
  });
});
