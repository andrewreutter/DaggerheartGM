import { describe, it, expect } from 'vitest';
import { NaturalClimber } from '../../../../src/features-v2/ancestries/Simiah.js';

describe('Natural Climber', () => {
  it('provides advantage triggers for balancing and climbing', () => {
    expect(NaturalClimber.advantageTriggers).toBeDefined();
    expect(NaturalClimber.advantageTriggers).toHaveLength(1);
    expect(NaturalClimber.advantageTriggers[0]).toBe(
      'Agility Rolls that involve balancing and climbing'
    );
  });
});
