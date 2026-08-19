import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CHARACTER_EDITOR_AUTOSAVE_HINT_KEY,
  MAP_SHOW_INSTRUCTIONS_KEY,
  resetOnboardingState,
  isCharacterEditorAutosaveHintDismissed,
  isMapShowInstructionsEnabled,
} from '../../src/client/lib/onboarding-storage.js';

describe('onboarding-storage', () => {
  beforeEach(() => {
    const store = {};
    globalThis.localStorage = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
      removeItem: (k) => {
        delete store[k];
      },
    };
    globalThis.dispatchEvent = vi.fn();
    globalThis.window = globalThis;
  });

  it('resetOnboardingState clears the character editor hint flag and dispatches an event', () => {
    localStorage.setItem(CHARACTER_EDITOR_AUTOSAVE_HINT_KEY, '1');
    expect(isCharacterEditorAutosaveHintDismissed()).toBe(true);
    resetOnboardingState();
    expect(isCharacterEditorAutosaveHintDismissed()).toBe(false);
    expect(globalThis.dispatchEvent).toHaveBeenCalledTimes(1);
    const ev = globalThis.dispatchEvent.mock.calls[0][0];
    expect(ev.type).toBe('dh-onboarding-reset');
  });

  it('clears the Game Map show-instructions flag so Enable onboarding restores the full copy', () => {
    localStorage.setItem(MAP_SHOW_INSTRUCTIONS_KEY, '0');
    expect(isMapShowInstructionsEnabled()).toBe(false);
    resetOnboardingState();
    expect(isMapShowInstructionsEnabled()).toBe(true);
  });
});
