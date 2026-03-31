import { createContext, useContext, useCallback, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { putUserPreferences } from './api.js';

const AiUiPreferenceContext = createContext(null);

export function AiUiPreferenceProvider({ hideAiUi, setHideAiUi, children }) {
  const [aiHiddenInfoOpen, setAiHiddenInfoOpen] = useState(false);

  const dismissAiUi = useCallback(async () => {
    await putUserPreferences({ hideAiUi: true });
    setHideAiUi(true);
    setAiHiddenInfoOpen(true);
  }, [setHideAiUi]);

  const turnOnAiUi = useCallback(async () => {
    await putUserPreferences({ hideAiUi: false });
    setHideAiUi(false);
  }, [setHideAiUi]);

  const closeAiHiddenInfo = useCallback(() => setAiHiddenInfoOpen(false), []);

  useEffect(() => {
    if (!aiHiddenInfoOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeAiHiddenInfo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aiHiddenInfoOpen, closeAiHiddenInfo]);

  const value = useMemo(
    () => ({ hideAiUi, dismissAiUi, turnOnAiUi }),
    [hideAiUi, dismissAiUi, turnOnAiUi],
  );

  return (
    <AiUiPreferenceContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && aiHiddenInfoOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
          onClick={closeAiHiddenInfo}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-hidden-info-title"
        >
          <div
            className="bg-dh-raised border border-dh-strong rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ai-hidden-info-title" className="text-lg font-semibold text-dh mb-2">
              AI features turned off
            </h2>
            <p className="text-dh text-sm mb-4">
              Build with AI, Generate with AI, and related controls are hidden for this account. To turn them back on, open the user menu (your name in the top bar) and choose <strong className="text-dh">Turn on AI Features</strong>.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                tabIndex={0}
                onClick={closeAiHiddenInfo}
                className="px-4 py-2 rounded-md bg-dh-hover text-dh hover:opacity-90 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AiUiPreferenceContext.Provider>
  );
}

export function useAiUiPreference() {
  const ctx = useContext(AiUiPreferenceContext);
  if (!ctx) {
    throw new Error('useAiUiPreference must be used within AiUiPreferenceProvider');
  }
  return ctx;
}

/** Safe for components that may render outside the provider (returns defaults). */
export function useAiUiPreferenceOptional() {
  return useContext(AiUiPreferenceContext);
}
