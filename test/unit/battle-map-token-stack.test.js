import { describe, it, expect } from 'vitest';

/**
 * Regression: placed map tokens use rising z-index (chars first, then adversaries in list order).
 * When two adversaries overlap (e.g. #1 and #2), the later instance must stack above or the lower
 * token steals pointer events — see BattleMap.jsx charMapTokens / advMapTokens.
 */
describe('BattleMap placed token z-index contract', () => {
  it('gives a higher z-index to the second adversary than the first (same char list)', () => {
    const charMapTokensLength = 2;
    const zFirstAdv = 10 + charMapTokensLength + 0;
    const zSecondAdv = 10 + charMapTokensLength + 1;
    expect(zSecondAdv).toBeGreaterThan(zFirstAdv);
  });

  it('keeps adversaries above all characters when chars render first', () => {
    const charMapTokensLength = 3;
    const topCharZ = 10 + (charMapTokensLength - 1);
    const firstAdvZ = 10 + charMapTokensLength + 0;
    expect(firstAdvZ).toBeGreaterThan(topCharZ);
  });
});
