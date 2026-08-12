import { describe, it, expect } from 'vitest';
import { buildTraitRollText } from '../../src/client/lib/trait-roll-text.js';

describe('buildTraitRollText', () => {
  it('builds a Duality Hope/Fear pair with a positive trait modifier', () => {
    expect(buildTraitRollText('Ada', 'agility', 2)).toBe(
      'Ada Agility Hope [d12] Fear [d12] Agility [2]',
    );
  });

  it('omits a zero trait modifier', () => {
    expect(buildTraitRollText('Bea', 'presence', 0)).toBe(
      'Bea Presence Hope [d12] Fear [d12]',
    );
  });

  it('includes a negative trait modifier', () => {
    expect(buildTraitRollText('Cal', 'strength', -1)).toBe(
      'Cal Strength Hope [d12] Fear [d12] Strength [-1]',
    );
  });

  it('appends an experience bonus when named', () => {
    expect(buildTraitRollText('Dee', 'knowledge', 1, 'Scholar', 3)).toBe(
      'Dee Knowledge Hope [d12] Fear [d12] Knowledge [1] Scholar [3]',
    );
  });
});
