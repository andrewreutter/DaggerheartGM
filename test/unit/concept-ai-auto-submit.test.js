import { describe, it, expect } from 'vitest';
import { shouldAttemptConceptAiAutoSubmit } from '../../src/client/lib/concept-ai-auto-submit.js';

describe('shouldAttemptConceptAiAutoSubmit', () => {
  const base = {
    autoSubmitKey: 'session-1',
    aiConceptTrimmed: 'a swamp hag',
    gateReady: true,
    prerequisitesReady: true,
    aiLoading: false,
    alreadyFiredForKey: null,
  };

  it('returns true when keyed pending concept is ready and not yet fired', () => {
    expect(shouldAttemptConceptAiAutoSubmit(base)).toBe(true);
  });

  it('returns false while SRD gate or prerequisites are not ready (stale form)', () => {
    expect(shouldAttemptConceptAiAutoSubmit({ ...base, gateReady: false })).toBe(false);
    expect(shouldAttemptConceptAiAutoSubmit({ ...base, prerequisitesReady: false })).toBe(false);
  });

  it('returns false until the textarea is seeded from initialConcept', () => {
    expect(shouldAttemptConceptAiAutoSubmit({ ...base, aiConceptTrimmed: '' })).toBe(false);
  });

  it('returns false after one fire for the same key', () => {
    expect(
      shouldAttemptConceptAiAutoSubmit({
        ...base,
        alreadyFiredForKey: 'session-1',
      }),
    ).toBe(false);
  });

  it('allows another auto-submit when the key includes a new pending concept (same session id)', () => {
    const compositeFirst = 'session-1:a swamp hag';
    const compositeSecond = 'session-1:a different concept';
    expect(
      shouldAttemptConceptAiAutoSubmit({
        ...base,
        autoSubmitKey: compositeSecond,
        alreadyFiredForKey: compositeFirst,
      }),
    ).toBe(true);
  });

  it('returns false while a build is in flight', () => {
    expect(shouldAttemptConceptAiAutoSubmit({ ...base, aiLoading: true })).toBe(false);
  });
});
