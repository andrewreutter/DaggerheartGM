import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: CharacterDefenseRow used an undefined `ancestryBonus` in JSX (hover crash).
 * Threshold breakdown must use ancestryMajorBonus / ancestrySevereBonus; any `ancestryBonus`
 * substring in this file should only appear as part of `ancestryBonusSource`.
 */
describe('CharacterDefenseRow source', () => {
  it('only uses ancestryBonus as part of ancestryBonusSource', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/CharacterDisplay.jsx');
    const src = readFileSync(path, 'utf8');
    for (let i = 0; ; ) {
      const j = src.indexOf('ancestryBonus', i);
      if (j === -1) break;
      expect(
        src.slice(j, j + 'ancestryBonusSource'.length),
        `stray ancestryBonus at offset ${j} (undefined variable in JSX)`
      ).toBe('ancestryBonusSource');
      i = j + 1;
    }
  });
});
