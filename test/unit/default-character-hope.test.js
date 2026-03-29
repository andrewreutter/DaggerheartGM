import { describe, it, expect } from 'vitest';
import { DEFAULT_CHARACTER_STARTING_HOPE } from '../../src/game-constants.js';

describe('DEFAULT_CHARACTER_STARTING_HOPE', () => {
  it('matches intended new-PC starting filled Hope boxes', () => {
    expect(DEFAULT_CHARACTER_STARTING_HOPE).toBe(2);
  });
});
