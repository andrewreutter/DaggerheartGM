import { describe, it, expect } from 'vitest';
import { scoreAdversaryVsEnvironmentSignals, scoreHotwordRules, ADVERSARY_HOTWORD_RULES } from '../../src/import-type-hotwords.js';

describe('import-type-hotwords', () => {
  it('scores adversary vs environment like legacy keyword gate', () => {
    const advText = 'HP 12\nAttack +5\nThresholds Major 3';
    const envText = 'Impulses\nPotential Adversaries: goblins';
    expect(scoreAdversaryVsEnvironmentSignals(advText).advSignals).toBeGreaterThanOrEqual(3);
    expect(scoreAdversaryVsEnvironmentSignals(envText).envSignals).toBeGreaterThanOrEqual(2);
  });

  it('scoreHotwordRules sums distinct rule hits', () => {
    expect(scoreHotwordRules('foo', ADVERSARY_HOTWORD_RULES)).toBe(0);
    expect(scoreHotwordRules('HP and ATK', ADVERSARY_HOTWORD_RULES)).toBeGreaterThanOrEqual(2);
  });
});
