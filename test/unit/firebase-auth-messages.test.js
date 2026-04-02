import { describe, it, expect } from 'vitest';
import {
  messageForFirebaseAuthError,
  getEmailFromAuthError,
  ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL,
} from '../../src/client/lib/firebase-auth-messages.js';

describe('messageForFirebaseAuthError', () => {
  it('maps known codes', () => {
    expect(messageForFirebaseAuthError('auth/invalid-email')).toMatch(/valid email/i);
    expect(messageForFirebaseAuthError('auth/weak-password')).toBeTruthy();
    expect(messageForFirebaseAuthError(ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL)).toMatch(/password/i);
    expect(messageForFirebaseAuthError(undefined)).toMatch(/try again/i);
  });
});

describe('getEmailFromAuthError', () => {
  it('reads customData.email', () => {
    expect(getEmailFromAuthError({ customData: { email: 'a@b.com' } })).toBe('a@b.com');
  });
  it('falls back to error.email', () => {
    expect(getEmailFromAuthError({ email: 'x@y.com' })).toBe('x@y.com');
  });
});
