import { describe, it, expect } from 'vitest';
import {
  formatUnhandledRejectionReason,
  isCrossOriginScriptErrorEvent,
} from '../../src/client/lib/fatal-window-error.js';

describe('isCrossOriginScriptErrorEvent', () => {
  it('matches the sanitized browser event (no Error object)', () => {
    expect(isCrossOriginScriptErrorEvent({ message: 'Script error.', error: null })).toBe(true);
    expect(isCrossOriginScriptErrorEvent({ message: 'Script error.' })).toBe(true);
  });

  it('does not hide a same-origin Error or a real message', () => {
    expect(isCrossOriginScriptErrorEvent({ message: 'Script error.', error: new Error('real') })).toBe(false);
    expect(isCrossOriginScriptErrorEvent({ message: 'boom', error: null })).toBe(false);
    expect(isCrossOriginScriptErrorEvent(null)).toBe(false);
  });
});

describe('formatUnhandledRejectionReason', () => {
  it('reads Error and object messages', () => {
    expect(formatUnhandledRejectionReason(new Error('promise-exploded'))).toBe('promise-exploded');
    expect(formatUnhandledRejectionReason({ message: 'Script error.' })).toBe('Script error.');
    expect(formatUnhandledRejectionReason('plain')).toBe('plain');
  });
});
