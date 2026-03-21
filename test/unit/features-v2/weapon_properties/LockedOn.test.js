import { describe, it, expect } from 'vitest';
import { LockedOn } from '../../../../src/features-v2/weapon_properties/LockedOn.js';
import { runResolve, runIntent, mockRoll, mockAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Locked On', () => {
  it('sets lockedTargetId on successful attack in onResolve', () => {
    const { mutations } = runResolve(LockedOn, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: true }),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'lockedTargetId', value: 'adv-1' }),
      })
    );
  });

  it('does not set lockedTargetId on failed attack', () => {
    const { mutations } = runResolve(LockedOn, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll({ isSuccess: false }),
    });

    const featureStateMuts = mutations.filter((m) => m.type === 'setFeatureState');
    expect(featureStateMuts).toHaveLength(0);
  });

  it('sets outcome to hope on next attack against same target', () => {
    const { mutations } = runIntent(LockedOn, {
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setRollOutcome',
        payload: expect.objectContaining({ outcome: 'hope' }),
      })
    );
  });

  it('does not set outcome when attacking a different target', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv1 = mockAdversary({ instanceId: 'adv-1' });
    const adv2 = mockAdversary({ instanceId: 'adv-2' });

    const { mutations } = runIntent(LockedOn, {
      activeElements: [char, adv1, adv2],
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
      action: mockAction({ type: 'attack', targetInstanceIds: ['adv-2'] }),
      rolls: mockRoll(),
    });

    const outcomeMuts = mutations.filter((m) => m.type === 'setRollOutcome');
    expect(outcomeMuts).toHaveLength(0);
  });

  it('does not set outcome on non-attack actions', () => {
    const { mutations } = runIntent(LockedOn, {
      featureState: { 'Locked On': { lockedTargetId: 'adv-1' } },
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll(),
    });

    const outcomeMuts = mutations.filter((m) => m.type === 'setRollOutcome');
    expect(outcomeMuts).toHaveLength(0);
  });
});
