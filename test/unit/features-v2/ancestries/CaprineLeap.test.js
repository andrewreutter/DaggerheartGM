import { describe, it, expect } from 'vitest';
import { CaprineLeap } from '../../../../src/features-v2/ancestries/Faun.js';

describe('Caprine Leap', () => {
  it('is a purely narrative feature with name and description', () => {
    expect(CaprineLeap.name).toBe('Caprine Leap');
    expect(CaprineLeap.description).toBeDefined();
    expect(typeof CaprineLeap.description).toBe('string');
  });

  it('has no chips or hooks (purely narrative)', () => {
    expect(CaprineLeap.chips).toBeUndefined();
    expect(CaprineLeap.hooks).toBeUndefined();
  });
});
