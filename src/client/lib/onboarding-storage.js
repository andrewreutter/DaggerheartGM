/**
 * localStorage keys for dismissible onboarding / first-run UI.
 * Add new keys here and they will be cleared by resetOnboardingState().
 */
export const CHARACTER_EDITOR_AUTOSAVE_HINT_KEY = 'dh_characterEditorAutosaveHintDismissed';
/** Game Map tooltip: `'1'` / missing = show instruction lines (default); `'0'` = hide. */
export const MAP_SHOW_INSTRUCTIONS_KEY = 'dh_mapShowInstructions';

const ONBOARDING_KEYS = [CHARACTER_EDITOR_AUTOSAVE_HINT_KEY, MAP_SHOW_INSTRUCTIONS_KEY];

export const ONBOARDING_RESET_EVENT = 'dh-onboarding-reset';

export function isCharacterEditorAutosaveHintDismissed() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(CHARACTER_EDITOR_AUTOSAVE_HINT_KEY) === '1';
  } catch {
    return true;
  }
}

/** Default on. Only `'0'` hides Game Map instruction lines. */
export function isMapShowInstructionsEnabled() {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(MAP_SHOW_INSTRUCTIONS_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * Clears onboarding flags so tips (e.g. character editor "first time here?") show again.
 * Dispatches {@link ONBOARDING_RESET_EVENT} so open components can sync React state.
 */
export function resetOnboardingState() {
  if (typeof localStorage === 'undefined') return;
  for (const key of ONBOARDING_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ONBOARDING_RESET_EVENT));
  }
}
