/**
 * Regression: CharacterAbilityList must call hooks (e.g. useMemo) before any early return
 * when abilities go from empty to non-empty — otherwise React #310 (hook count mismatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('CharacterDisplay CharacterAbilityList', () => {
  it('calls hasLoadoutActions useMemo before empty-abilities early return', () => {
    const path = join(__dirname, '../../src/client/components/CharacterDisplay.jsx');
    const src = readFileSync(path, 'utf8');
    const start = src.indexOf('export function CharacterAbilityList');
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('export function CharacterInventory', start);
    expect(end).toBeGreaterThan(start);
    const block = src.slice(start, end);
    const memoIdx = block.indexOf('const hasLoadoutActions = useMemo(');
    const earlyIdx = block.indexOf('if (!abilities.length) return null;');
    expect(memoIdx).toBeGreaterThan(-1);
    expect(earlyIdx).toBeGreaterThan(-1);
    expect(memoIdx).toBeLessThan(earlyIdx);
  });
});
