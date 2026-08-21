import { describe, it, expect, afterEach } from 'vitest';
import {
  NEW_SIGNUPS_DISABLED_CODE,
  NEW_SIGNUPS_DISABLED_MESSAGE,
  beginRejectingNewGoogleUsers,
  endRejectingNewGoogleUsers,
  isGoogleSignInRejectingNewUsers,
  isLikelyBrandNewFirebaseUser,
  shouldSkipAuthAdmission,
  shouldRejectNewGoogleCredential,
  makeSignupsDisabledError,
} from '../../src/client/lib/new-signups-gate.js';
import { messageForFirebaseAuthError } from '../../src/client/lib/firebase-auth-messages.js';

describe('new-signups-gate', () => {
  afterEach(() => {
    endRejectingNewGoogleUsers();
  });

  it('tracks in-flight Google reject-new-users state', () => {
    expect(isGoogleSignInRejectingNewUsers()).toBe(false);
    beginRejectingNewGoogleUsers();
    expect(isGoogleSignInRejectingNewUsers()).toBe(true);
    endRejectingNewGoogleUsers();
    expect(isGoogleSignInRejectingNewUsers()).toBe(false);
  });

  it('treats matching creation and last-sign-in times as a brand-new user', () => {
    expect(isLikelyBrandNewFirebaseUser({
      metadata: { creationTime: 'Thu, 20 Aug 2026 01:00:00 GMT', lastSignInTime: 'Thu, 20 Aug 2026 01:00:00 GMT' },
    })).toBe(true);
    expect(isLikelyBrandNewFirebaseUser({
      metadata: { creationTime: 'Thu, 01 Jan 2026 01:00:00 GMT', lastSignInTime: 'Thu, 20 Aug 2026 01:00:00 GMT' },
    })).toBe(false);
    expect(isLikelyBrandNewFirebaseUser(null)).toBe(false);
    expect(isLikelyBrandNewFirebaseUser({})).toBe(false);
  });

  it('skips auth admission only while rejecting a brand-new Google user', () => {
    expect(shouldSkipAuthAdmission({ rejectingNewGoogleUsers: true, isBrandNew: true })).toBe(true);
    expect(shouldSkipAuthAdmission({ rejectingNewGoogleUsers: true, isBrandNew: false })).toBe(false);
    expect(shouldSkipAuthAdmission({ rejectingNewGoogleUsers: false, isBrandNew: true })).toBe(false);
  });

  it('rejects a Google credential only when both rejectNewUsers and isNewUser are set', () => {
    expect(shouldRejectNewGoogleCredential({ rejectNewUsers: true, isNewUser: true })).toBe(true);
    expect(shouldRejectNewGoogleCredential({ rejectNewUsers: true, isNewUser: false })).toBe(false);
    expect(shouldRejectNewGoogleCredential({ rejectNewUsers: false, isNewUser: true })).toBe(false);
  });

  it('builds a signups-disabled error with a stable code', () => {
    const err = makeSignupsDisabledError();
    expect(err.code).toBe(NEW_SIGNUPS_DISABLED_CODE);
    expect(err.message).toBe(NEW_SIGNUPS_DISABLED_MESSAGE);
    expect(messageForFirebaseAuthError(NEW_SIGNUPS_DISABLED_CODE)).toBe(NEW_SIGNUPS_DISABLED_MESSAGE);
  });
});
