import { describe, it, expect } from 'vitest';
import {
  billingDowngradeBannerCopy,
  billingSupportPillCopy,
  billingNavIndicatorCopy,
  billingSessionBlockedCopy,
} from '../../src/client/lib/billing-status-copy.js';

describe('billing-status-copy', () => {
  it('maps never_started Support pill to muted trial-not-started copy', () => {
    const pill = billingSupportPillCopy('never_started');
    expect(pill.tone).toBe('muted');
    expect(pill.text).toMatch(/Trial not yet started/i);
    expect(pill.text).not.toMatch(/expired|ended/i);
  });

  it('maps T15 never_started to Free plan, not Trial ended', () => {
    expect(billingNavIndicatorCopy('never_started')).toBe('Free plan');
    expect(billingNavIndicatorCopy('trial_expired')).toBe('Trial ended');
    expect(billingNavIndicatorCopy('trial_used_on_other_table')).toBe('Trial used');
    expect(billingNavIndicatorCopy('pass_expired')).toBe('Pass expired');
  });

  it('uses trial / pass expired wording only for real lapses', () => {
    expect(billingDowngradeBannerCopy('never_started')).toMatch(/Trial not yet started/);
    expect(billingDowngradeBannerCopy('trial_expired')).toMatch(/Free trial has ended/);
    expect(billingDowngradeBannerCopy('trial_used_on_other_table')).toMatch(/already used on another table/);
    expect(billingDowngradeBannerCopy('pass_expired')).toMatch(/Campaign Pass has expired/);
  });

  it('branches T11 session-blocked copy by reason', () => {
    expect(billingSessionBlockedCopy('never_started')).toMatch(/session with a player/i);
    expect(billingSessionBlockedCopy('trial_used_on_other_table')).toMatch(/another table/i);
    expect(billingSessionBlockedCopy('trial_expired')).toBe('Your free trial has ended.');
    expect(billingSessionBlockedCopy('pass_expired')).toBe('Your Campaign Pass has expired.');
  });
});
