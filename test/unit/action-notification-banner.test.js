import { describe, it, expect } from 'vitest';
import {
  computeActionAckTouchesTableState,
  shouldSuppressActionBanner,
  withActionBannerSuppression,
} from '../../src/client/lib/action-notification-banner.js';

describe('computeActionAckTouchesTableState', () => {
  it('Start Session: never suppressed; compute stays false so Ack-only / no Cancel in ActionBanner', () => {
    const roll = {
      _action: true,
      _sessionStart: true,
      actionName: 'Start Session',
      actionText: 'Acknowledge to start.',
    };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(false);
    expect(shouldSuppressActionBanner(roll, { actionAdversaryTargets: [] })).toBe(false);
    const out = withActionBannerSuppression(roll, { actionAdversaryTargets: [] });
    expect(out._suppressActionBanner).toBeUndefined();
  });

  it('returns false for informational _v2ActionLoop-only shape', () => {
    const roll = {
      _action: true,
      _v2ActionLoop: true,
      actionName: 'Hook',
      actionText: 'Something happened.',
    };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(false);
  });

  it('returns true when deferring toggle until banner ack', () => {
    const roll = {
      _action: true,
      _v2DeferUntilBannerAck: true,
      _v2DeferToggleNext: true,
      _attackerInstanceId: 'c1',
    };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(true);
  });

  it('returns true for _featureUse', () => {
    const roll = { _action: true, _featureUse: true, _attackerInstanceId: 'c1' };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(true);
  });

  it('returns true for _cardToggle', () => {
    const roll = { _action: true, _cardToggle: { instanceId: 'c1', nextActive: true } };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(true);
  });

  it('returns true when life support targets need selection', () => {
    const roll = { _action: true, _lifeSupportTargets: [{ instanceId: 'a' }] };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(true);
  });

  it('returns false when _lifeSupportTargets is empty array (no selection)', () => {
    const roll = { _action: true, _lifeSupportTargets: [] };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(false);
  });

  it('returns true when adversary action needs target pick and adversaries exist', () => {
    const roll = { _action: true, _targetType: 'adversary' };
    expect(
      computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [{ instanceId: 'adv1' }] })
    ).toBe(true);
  });

  it('returns false for adversary type with no adversaries on table', () => {
    const roll = { _action: true, _targetType: 'adversary' };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(false);
  });

  it('returns true when tags + attacker imply resource ack', () => {
    const roll = {
      _action: true,
      _attackerInstanceId: 'c1',
      tags: [{ name: 'HopeCost', text: 'Spend 1 Hope' }],
    };
    expect(computeActionAckTouchesTableState(roll, { actionAdversaryTargets: [] })).toBe(true);
  });
});

describe('shouldSuppressActionBanner', () => {
  it('is true only for _action when ack does not touch state', () => {
    expect(
      shouldSuppressActionBanner(
        { _action: true, _v2ActionLoop: true, actionText: 'x' },
        { actionAdversaryTargets: [] }
      )
    ).toBe(true);
    expect(shouldSuppressActionBanner({ _action: false, _v2ActionLoop: true }, {})).toBe(false);
  });
});

describe('withActionBannerSuppression', () => {
  it('adds _suppressActionBanner when appropriate', () => {
    const out = withActionBannerSuppression(
      { _action: true, _v2ActionLoop: true, actionText: 'x' },
      { actionAdversaryTargets: [] }
    );
    expect(out._suppressActionBanner).toBe(true);
  });

  it('leaves non-_action payloads unchanged', () => {
    const n = { rollUser: 'A', actionText: 'x' };
    expect(withActionBannerSuppression(n, {})).toBe(n);
  });
});
