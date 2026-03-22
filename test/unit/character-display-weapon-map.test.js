/**
 * Regression: CharacterWeaponList "Normal weapon cards" map must pass (w, i) when using key={i}.
 * A missing index caused ReferenceError: Can't find variable: i (Safari) when rendering the hover card.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('CharacterDisplay CharacterWeaponList', () => {
  it('normal weapon cards .map uses (w, i) alongside key that references i', () => {
    const path = join(__dirname, '../../src/client/components/CharacterDisplay.jsx');
    const src = readFileSync(path, 'utf8');
    const marker = '{/* Normal weapon cards (skip Otherworldly originals) */}';
    const start = src.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, start + 900);
    expect(block).toMatch(/\.map\(\(w,\s*i\)\s*=>/);
  });
});
