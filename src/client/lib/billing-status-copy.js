/**
 * User-facing copy for table billing status (`GET /api/campaign-pass/status` reasons).
 * Never treat `never_started` as an expired trial/pass — prep is normal until a session begins.
 * T14 banner is shown whenever `!isLive` (including `never_started`).
 */

/** @typedef {'never_started' | 'trial_used_on_other_table' | 'trial_expired' | 'pass_expired' | string} BillingReason */

/**
 * T14 banner body — always shown when the table is not live.
 * @param {BillingReason | null | undefined} reason
 */
export function billingDowngradeBannerCopy(reason) {
  if (reason === 'never_started') {
    return 'Trial not yet started — starts when you begin a session with a player';
  }
  if (reason === 'trial_used_on_other_table') {
    return 'Free trial already used on another table — this table is read-only. New sessions cannot be started.';
  }
  if (reason === 'trial_expired') {
    return 'Free trial has ended — this table is read-only. New sessions cannot be started.';
  }
  return 'Campaign Pass has expired — this table is read-only. New sessions cannot be started.';
}

/**
 * Support modal status pill when `!isLive`.
 * @param {BillingReason | null | undefined} reason
 * @returns {{ text: string, tone: 'muted' | 'alert' }}
 */
export function billingSupportPillCopy(reason) {
  if (reason === 'never_started') {
    return {
      text: 'Trial not yet started — starts when you begin a session with a player',
      tone: 'muted',
    };
  }
  if (reason === 'trial_used_on_other_table') {
    return { text: 'Free trial already used on another table', tone: 'alert' };
  }
  if (reason === 'trial_expired') {
    return { text: 'Free trial has ended', tone: 'alert' };
  }
  return { text: 'Pass expired — sessions are paused', tone: 'alert' };
}

/**
 * T15 ambient nav indicator when `!isLive`.
 * @param {BillingReason | null | undefined} reason
 */
export function billingNavIndicatorCopy(reason) {
  if (reason === 'never_started') return 'Free plan';
  if (reason === 'trial_used_on_other_table') return 'Trial used';
  if (reason === 'trial_expired') return 'Trial ended';
  return 'Pass expired';
}

/**
 * T11 session-start error body under "Session cannot start".
 * @param {BillingReason | null | undefined} reason
 */
export function billingSessionBlockedCopy(reason) {
  if (reason === 'never_started') {
    return 'Trial starts when you begin a session with a player.';
  }
  if (reason === 'trial_used_on_other_table') {
    return 'Free trial already used on another table.';
  }
  if (reason === 'trial_expired') {
    return 'Your free trial has ended.';
  }
  if (reason === 'pass_expired') {
    return 'Your Campaign Pass has expired.';
  }
  return 'This table needs a Campaign Pass to start new sessions.';
}
