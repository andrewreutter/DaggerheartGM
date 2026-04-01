import { describe, it, expect } from 'vitest';
import { playerEncounterInstanceRowVisible } from '../../src/client/lib/encounter-adversary-player-summary.js';

describe('playerEncounterInstanceRowVisible', () => {
  const base = { hp_max: 10 };

  it('is false when full HP, no stress, no vuln/conditions', () => {
    expect(playerEncounterInstanceRowVisible(base, { currentHp: 10, currentStress: 0 })).toBe(false);
  });

  it('is true when HP damage', () => {
    expect(playerEncounterInstanceRowVisible(base, { currentHp: 8, currentStress: 0 })).toBe(true);
  });

  it('is true when stress', () => {
    expect(playerEncounterInstanceRowVisible(base, { currentHp: 10, currentStress: 1 })).toBe(true);
  });

  it('is true when vulnerable', () => {
    expect(playerEncounterInstanceRowVisible(base, { currentHp: 10, currentStress: 0, vulnerable: true })).toBe(true);
  });

  it('is true when conditions text', () => {
    expect(playerEncounterInstanceRowVisible(base, { currentHp: 10, currentStress: 0, conditions: 'Slowed' })).toBe(true);
  });
});
