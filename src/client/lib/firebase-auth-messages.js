/** User-facing strings and small helpers — no firebase/auth import (safe for unit tests). */

export const ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL = 'auth/account-exists-with-different-credential';
export const EMAIL_ALREADY_IN_USE = 'auth/email-already-in-use';

/**
 * @param {string} [code]
 * @returns {string}
 */
export function messageForFirebaseAuthError(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered. Try signing in or use Google if you used it before.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL:
      return 'An account with this email already exists. Enter your password below to link Google.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

/**
 * @param {{ customData?: { email?: string }, email?: string }} [error]
 * @returns {string | undefined}
 */
export function getEmailFromAuthError(error) {
  return error?.customData?.email ?? error?.email;
}
