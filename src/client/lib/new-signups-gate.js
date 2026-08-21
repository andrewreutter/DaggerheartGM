/**
 * Closed new-account gate used when `DAGGERHEART_WHITELIST_DISABLED=1`.
 * Pure helpers plus an in-flight flag so `onAuthStateChanged` can skip admitting
 * a brand-new Google user before `signInWithPopup` returns.
 */

export const NEW_SIGNUPS_DISABLED_CODE = 'auth/signups-disabled';
export const NEW_SIGNUPS_DISABLED_MESSAGE = "Sorry, we're not accepting new users right now.";

let rejectingNewGoogleUsers = false;

export function beginRejectingNewGoogleUsers() {
  rejectingNewGoogleUsers = true;
}

export function endRejectingNewGoogleUsers() {
  rejectingNewGoogleUsers = false;
}

export function isGoogleSignInRejectingNewUsers() {
  return rejectingNewGoogleUsers;
}

/** True when Firebase reports the same creation and last-sign-in timestamps. */
export function isLikelyBrandNewFirebaseUser(user) {
  const created = user?.metadata?.creationTime;
  const last = user?.metadata?.lastSignInTime;
  return Boolean(created && last && created === last);
}

export function shouldSkipAuthAdmission({ rejectingNewGoogleUsers: rejecting, isBrandNew }) {
  return !!(rejecting && isBrandNew);
}

export function shouldRejectNewGoogleCredential({ rejectNewUsers, isNewUser }) {
  return !!(rejectNewUsers && isNewUser);
}

export function makeSignupsDisabledError(message = NEW_SIGNUPS_DISABLED_MESSAGE) {
  const err = new Error(message);
  err.code = NEW_SIGNUPS_DISABLED_CODE;
  return err;
}
