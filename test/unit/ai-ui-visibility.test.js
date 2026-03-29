import { describe, it, expect } from 'vitest';
import { shouldShowConceptAiUi, shouldShowImageGenAiUi } from '../../src/client/lib/ai-ui-visibility.js';

describe('ai-ui-visibility', () => {
  it('hides concept AI when user opted out', () => {
    expect(shouldShowConceptAiUi(true, false)).toBe(true);
    expect(shouldShowConceptAiUi(true, true)).toBe(false);
    expect(shouldShowConceptAiUi(false, false)).toBe(false);
  });

  it('hides image-gen AI when user opted out', () => {
    expect(shouldShowImageGenAiUi(true, false)).toBe(true);
    expect(shouldShowImageGenAiUi(true, true)).toBe(false);
    expect(shouldShowImageGenAiUi(false, false)).toBe(false);
  });
});
