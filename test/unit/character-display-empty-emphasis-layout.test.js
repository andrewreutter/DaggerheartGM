import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: empty Offense/Actions emphasis cards should not reserve a second row or space-y gap
 * when children is null (title + titleRight only).
 */
describe('CharacterSheetEmphasisCard empty body', () => {
  it('omits body wrapper and space-y when there is no children', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/CharacterStatBlockGraphic.jsx');
    const src = readFileSync(path, 'utf8');
    const start = src.indexOf('export function CharacterSheetEmphasisCard');
    expect(start).toBeGreaterThan(-1);
    const fn = src.slice(start);
    expect(fn).toContain('const hasBody = children != null && children !== false');
    expect(fn).toMatch(/hasBody \? 'space-y-2' : ''/);
    expect(fn).toMatch(/\{hasBody \? <div className="min-w-0">\{children\}<\/div> : null\}/);
  });
});

/**
 * Regression: collapsed character row with no weapons and no actions — name and combined message on one line.
 */
describe('PlayerAdversaryTargetAid bothEmpty row', () => {
  it('places combined empty message on the same row as the character title (flex, message right)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/PlayerAdversaryTargetAid.jsx');
    const src = readFileSync(path, 'utf8');
    const idx = src.indexOf('if (bothEmpty)');
    expect(idx).toBeGreaterThan(-1);
    const bothEmptyBlock = src.slice(idx, idx + 900);
    expect(bothEmptyBlock).toMatch(/flex items-start justify-between/);
    expect(bothEmptyBlock).toContain('{combinedMessage}');
    expect(bothEmptyBlock).toMatch(/text-right/);
  });
});
