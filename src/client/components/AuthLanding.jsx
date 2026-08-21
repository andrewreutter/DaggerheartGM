import React, { useState, useCallback, useEffect } from 'react';
import { auth, daggerheartWhitelistDisabled } from '../lib/api.js';
import {
  signInWithGoogleAuth,
  registerWithEmailPassword,
  signInWithEmailPasswordAuth,
  sendPasswordResetForEmail,
  getPendingGoogleCredentialFromError,
  linkGoogleCredentialAfterPasswordSignIn,
  getSignInMethodsForEmail,
  messageForFirebaseAuthError,
  ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL,
  EMAIL_ALREADY_IN_USE,
} from '../lib/firebase-account-linking.js';
import { getEmailFromAuthError } from '../lib/firebase-auth-messages.js';
import { NEW_SIGNUPS_DISABLED_MESSAGE } from '../lib/new-signups-gate.js';

const AUTH_FIELD_CLASS = 'w-full rounded-md border border-dh-border bg-dh-canvas px-3 py-2 text-sm text-dh';

/**
 * Login fields stay inert until a pointer or Tab reaches them so the browser
 * does not autofocus the email/name field on the homepage.
 */
function AuthField({ type, autoComplete, ...props }) {
  const [unlocked, setUnlocked] = useState(false);
  const unlock = () => setUnlocked(true);
  return (
    <input
      {...props}
      type={unlocked ? type : 'text'}
      autoComplete={unlocked ? autoComplete : 'off'}
      autoFocus={false}
      readOnly={!unlocked}
      onPointerDown={unlock}
      onKeyDown={(e) => {
        if (e.key === 'Tab' || e.key === 'Enter') unlock();
      }}
    />
  );
}

/** @param {{ disabled?: boolean, initialMode?: string }} props */
export function AuthLanding({ disabled = false, initialMode }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [linkPending, setLinkPending] = useState(null); // { email: string, credential: OAuthCredential } | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  useEffect(() => setMode(initialMode || 'signin'), [initialMode]);

  const resetMessages = useCallback(() => {
    setError('');
    setInfo('');
  }, []);

  const clearLink = useCallback(() => {
    setLinkPending(null);
    setPassword('');
    resetMessages();
  }, [resetMessages]);

  const onGoogle = useCallback(async () => {
    if (!auth || disabled) return;
    resetMessages();
    setBusy(true);
    try {
      await signInWithGoogleAuth(auth, { rejectNewUsers: daggerheartWhitelistDisabled });
    } catch (err) {
      const code = err?.code;
      if (code === ACCOUNT_EXISTS_DIFFERENT_CREDENTIAL) {
        const credential = getPendingGoogleCredentialFromError(err);
        const em = getEmailFromAuthError(err) || email;
        if (credential && em) {
          setLinkPending({ email: em, credential });
          setEmail(em);
          setInfo('Enter your password for this email to link Google Sign-In to your account.');
        } else {
          setError(messageForFirebaseAuthError(code));
        }
      } else {
        setError(messageForFirebaseAuthError(code));
      }
    } finally {
      setBusy(false);
    }
  }, [auth, disabled, email, resetMessages, daggerheartWhitelistDisabled]);

  const onLinkGoogle = useCallback(async () => {
    if (!auth || !linkPending) return;
    resetMessages();
    setBusy(true);
    try {
      await linkGoogleCredentialAfterPasswordSignIn(auth, linkPending.email, password, linkPending.credential);
      setLinkPending(null);
      setPassword('');
    } catch (err) {
      setError(messageForFirebaseAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  }, [auth, linkPending, password, resetMessages]);

  const onEmailSignIn = useCallback(async (e) => {
    e.preventDefault();
    if (!auth || disabled) return;
    resetMessages();
    setBusy(true);
    try {
      await signInWithEmailPasswordAuth(auth, email, password);
    } catch (err) {
      setError(messageForFirebaseAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  }, [auth, disabled, email, password, resetMessages]);

  const onEmailSignUp = useCallback(async (e) => {
    e.preventDefault();
    if (!auth || disabled || daggerheartWhitelistDisabled) return;
    resetMessages();
    setBusy(true);
    try {
      await registerWithEmailPassword(auth, email, password, { displayName });
    } catch (err) {
      const code = err?.code;
      if (code === EMAIL_ALREADY_IN_USE) {
        try {
          const methods = await getSignInMethodsForEmail(auth, email);
          if (methods.includes('google.com') && !methods.includes('password')) {
            setError('This email is registered with Google. Use “Sign in with Google” below.');
          } else if (methods.includes('password')) {
            setError('An account with this email already exists. Try signing in instead.');
          } else {
            setError(messageForFirebaseAuthError(code));
          }
        } catch {
          setError(messageForFirebaseAuthError(code));
        }
      } else {
        setError(messageForFirebaseAuthError(code));
      }
    } finally {
      setBusy(false);
    }
  }, [auth, disabled, email, password, displayName, resetMessages, daggerheartWhitelistDisabled]);

  const onForgotPassword = useCallback(async (e) => {
    e.preventDefault();
    if (!auth || disabled) return;
    resetMessages();
    setBusy(true);
    try {
      await sendPasswordResetForEmail(auth, email);
      setInfo('Check your inbox for a reset link.');
      setMode('signin');
    } catch (err) {
      setError(messageForFirebaseAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  }, [auth, disabled, email, resetMessages]);

  if (!auth) {
    return (
      <p className="text-dh-muted text-sm text-center max-w-md">
        Firebase is not configured. Set FIREBASE_* in <code className="text-xs">.env</code> and restart the server.
      </p>
    );
  }

  return (
    <div className="w-full max-w-sm flex flex-col gap-6">
      {linkPending ? (
        <div className="rounded-lg border border-dh-strong bg-dh-raised/50 p-4 space-y-3">
          <p className="text-sm text-dh">{info || 'Link Google to your existing account.'}</p>
          <label className="block text-xs text-dh-muted uppercase tracking-wide">Password</label>
          <AuthField
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={AUTH_FIELD_CLASS}
            placeholder="Your account password"
            disabled={busy}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLinkGoogle}
              disabled={busy || !password}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
            >
              {busy ? 'Linking…' : 'Link Google'}
            </button>
            <button
              type="button"
              onClick={clearLink}
              disabled={busy}
              className="px-4 py-2.5 border border-dh-border rounded-lg text-sm text-dh hover:bg-dh-hover"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      ) : (
        <>
          {mode === 'forgot' ? (
            <form onSubmit={onForgotPassword} className="space-y-3">
              <p className="text-sm text-dh-muted">We’ll send a password reset link to your email.</p>
              <label className="block text-xs text-dh-muted uppercase tracking-wide">Email</label>
              <AuthField
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_FIELD_CLASS}
                disabled={busy}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold"
                >
                  Send reset link
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signin'); resetMessages(); }}
                  className="px-3 py-2 text-sm text-dh-muted hover:text-dh"
                >
                  Back
                </button>
              </div>
            </form>
          ) : mode === 'signup' && daggerheartWhitelistDisabled ? (
            <div data-testid="new-signups-closed" className="space-y-4 text-center">
              <p className="text-sm text-dh-muted">{NEW_SIGNUPS_DISABLED_MESSAGE}</p>
              <button
                type="button"
                onClick={() => { setMode('signin'); resetMessages(); }}
                className="text-sky-400 hover:underline text-sm"
              >
                Sign in
              </button>
            </div>
          ) : (
            <form onSubmit={mode === 'signup' ? onEmailSignUp : onEmailSignIn} className="space-y-3">
              {mode === 'signup' && (
                <>
                  <label className="block text-xs text-dh-muted uppercase tracking-wide">Display name (optional)</label>
                  <AuthField
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={AUTH_FIELD_CLASS}
                    disabled={busy}
                  />
                </>
              )}
              <label className="block text-xs text-dh-muted uppercase tracking-wide">Email</label>
              <AuthField
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={AUTH_FIELD_CLASS}
                disabled={busy}
              />
              <label className="block text-xs text-dh-muted uppercase tracking-wide">Password</label>
              <AuthField
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={AUTH_FIELD_CLASS}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full px-4 py-2.5 bg-dh-hover hover:bg-dh-strong border border-dh-border text-dh rounded-lg text-sm font-semibold"
              >
                {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
              <div className="flex justify-between text-xs">
                {!(daggerheartWhitelistDisabled && mode === 'signin') && (
                  <button
                    type="button"
                    data-testid="auth-create-account"
                    onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); resetMessages(); setInfo(''); }}
                    className="text-sky-400 hover:underline"
                  >
                    {mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in'}
                  </button>
                )}
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); resetMessages(); setInfo(''); }}
                    className={`text-dh-muted hover:text-dh ${daggerheartWhitelistDisabled ? 'ml-auto' : ''}`}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </form>
          )}

          {!(mode === 'signup' && daggerheartWhitelistDisabled) && (
          <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dh-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wide">
              <span className="bg-gradient-to-b from-dh-surface to-dh-canvas px-2 text-dh-muted">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy || disabled}
            className="w-full flex items-center justify-center gap-3 rounded border border-[#747775] bg-white px-3 py-2.5 text-sm font-medium text-[#1f1f1f] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-[box-shadow,background-color] hover:shadow-[0_1px_3px_rgba(0,0,0,0.12)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Sign in with Google"
          >
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="tracking-[0.25px]">Sign in with Google</span>
          </button>
          </>
          )}

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          {info && !error && <p className="text-sm text-green-400 text-center">{info}</p>}
        </>
      )}
    </div>
  );
}
