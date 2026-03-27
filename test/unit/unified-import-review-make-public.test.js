import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

/**
 * Unified import uses a single footer "Make public" toggle; forms must not duplicate it.
 */
describe('UnifiedImportReviewPane make public', () => {
  it('passes omitPublicCheckbox to forms that otherwise render Make Public in controlled mode', () => {
    const path = join(root, 'src/client/components/modals/UnifiedImportReviewPane.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/<AdversaryForm[\s\S]*?omitPublicCheckbox/);
    expect(src).toMatch(/<EnvironmentForm[\s\S]*?omitPublicCheckbox/);
    expect(src).toMatch(/<SceneForm[\s\S]*?omitPublicCheckbox/);
    expect(src).toMatch(/<AdventureForm[\s\S]*?omitPublicCheckbox/);
  });

  it('AdversaryForm supports omitPublicCheckbox prop', () => {
    const path = join(root, 'src/client/components/forms/AdversaryForm.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/omitPublicCheckbox\s*=\s*false/);
    expect(src).toMatch(/isControlled\s*&&\s*!omitPublicCheckbox/);
  });
});
