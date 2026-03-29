import { createContext, useContext, useCallback, useMemo } from 'react';
import { putUserPreferences } from './api.js';

const AiUiPreferenceContext = createContext(null);

export function AiUiPreferenceProvider({ hideAiUi, setHideAiUi, children }) {
  const dismissAiUi = useCallback(async () => {
    await putUserPreferences({ hideAiUi: true });
    setHideAiUi(true);
  }, [setHideAiUi]);

  const turnOnAiUi = useCallback(async () => {
    await putUserPreferences({ hideAiUi: false });
    setHideAiUi(false);
  }, [setHideAiUi]);

  const value = useMemo(
    () => ({ hideAiUi, dismissAiUi, turnOnAiUi }),
    [hideAiUi, dismissAiUi, turnOnAiUi],
  );

  return <AiUiPreferenceContext.Provider value={value}>{children}</AiUiPreferenceContext.Provider>;
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
