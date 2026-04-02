/**
 * Firebase Auth helpers: email/password, Google popup, and linking Google to an
 * existing password account (same email → one UID). See README GCP/Firebase section.
 */
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  updateProfile,
} from 'firebase/auth';
import { auth } from './api.js';
import {
  ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL,
  messageForFirebaseAuthError,
  getEmailFromAuthError,
} from './firebase-auth-messages.js';

export { ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL, EMAIL_ALREADY_IN_USE } from './firebase-auth-messages.js';
export { messageForFirebaseAuthError, getEmailFromAuthError } from './firebase-auth-messages.js';

/**
 * @param {import('firebase/auth').Auth} authInstance
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export function signInWithGoogleAuth(authInstance = auth) {
  if (!authInstance) throw new Error('Firebase auth not initialized');
  const provider = new GoogleAuthProvider();
  return signInWithPopup(authInstance, provider);
}

/**
 * @param {import('firebase/auth').Auth} authInstance
 * @param {string} email
 * @param {string} password
 * @param {{ displayName?: string }} [opts]
 */
export async function registerWithEmailPassword(authInstance, email, password, opts = {}) {
  if (!authInstance) throw new Error('Firebase auth not initialized');
  const cred = await createUserWithEmailAndPassword(authInstance, email.trim(), password);
  if (opts.displayName?.trim()) {
    await updateProfile(cred.user, { displayName: opts.displayName.trim() });
  }
  return cred;
}

/**
 * @param {import('firebase/auth').Auth} authInstance
 * @param {string} email
 * @param {string} password
 */
export function signInWithEmailPasswordAuth(authInstance, email, password) {
  if (!authInstance) throw new Error('Firebase auth not initialized');
  return signInWithEmailAndPassword(authInstance, email.trim(), password);
}

/**
 * @param {import('firebase/auth').Auth} authInstance
 * @param {string} email
 */
export function sendPasswordResetForEmail(authInstance, email) {
  if (!authInstance) throw new Error('Firebase auth not initialized');
  return sendPasswordResetEmail(authInstance, email.trim());
}

/**
 * Pending Google OAuth credential from `auth/account-exists-with-different-credential`.
 * @param {import('firebase/auth').AuthError} error
 * @returns {import('firebase/auth').OAuthCredential | null}
 */
export function getPendingGoogleCredentialFromError(error) {
  if (!error || error.code !== ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL) return null;
  return GoogleAuthProvider.credentialFromError(error);
}

/**
 * After Google sign-in hits account-exists-with-different-credential: sign in with
 * email/password, then link the Google credential so both providers share one UID.
 *
 * @param {import('firebase/auth').Auth} authInstance
 * @param {string} email
 * @param {string} password
 * @param {import('firebase/auth').OAuthCredential} pendingGoogleCredential
 */
export async function linkGoogleCredentialAfterPasswordSignIn(
  authInstance,
  email,
  password,
  pendingGoogleCredential
) {
  if (!authInstance) throw new Error('Firebase auth not initialized');
  if (!pendingGoogleCredential) throw new Error('Missing Google credential');
  await signInWithEmailAndPassword(authInstance, email.trim(), password);
  const user = authInstance.currentUser;
  if (!user) throw new Error('Not signed in');
  await linkWithCredential(user, pendingGoogleCredential);
  return user;
}

/**
 * Best-effort hint for which providers exist for an email (may be empty if
 * enumeration protection is enabled in Firebase Console).
 * @param {import('firebase/auth').Auth} authInstance
 * @param {string} email
 * @returns {Promise<string[]>}
 */
export async function getSignInMethodsForEmail(authInstance, email) {
  if (!authInstance) throw new Error('Firebase auth not initialized');
  return fetchSignInMethodsForEmail(authInstance, email.trim());
}
