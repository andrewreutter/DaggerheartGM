import { describe, it, expect } from 'vitest';
import { getFrequencyCycleWord } from '../../src/client/lib/frequency-cycle-ui.jsx';

describe('getFrequencyCycleWord', () => {
  it('maps known cycles to single words', () => {
    expect(getFrequencyCycleWord('session')).toBe('session');
    expect(getFrequencyCycleWord('longRest')).toBe('long');
    expect(getFrequencyCycleWord('shortRest')).toBe('short');
    expect(getFrequencyCycleWord('rest')).toBe('rest');
  });

  it('returns null for unknown or empty', () => {
    expect(getFrequencyCycleWord(null)).toBe(null);
    expect(getFrequencyCycleWord('')).toBe(null);
    expect(getFrequencyCycleWord('custom')).toBe(null);
  });
});
