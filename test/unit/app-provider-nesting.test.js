import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

/**
 * UnifiedImportProvider renders UnifiedImportModal as a sibling after `children`, so the modal
 * is only under AiUiPreferenceProvider if AiUi wraps UnifiedImport (not the reverse).
 */
describe('App provider nesting', () => {
  it('AiUiPreferenceProvider wraps UnifiedImportProvider so import modal can use useAiUiPreference', () => {
    const path = join(root, 'src/client/app.jsx');
    const src = readFileSync(path, 'utf8');
    const openAi = src.indexOf('<AiUiPreferenceProvider ');
    const openUni = src.indexOf('<UnifiedImportProvider');
    expect(openAi).toBeGreaterThanOrEqual(0);
    expect(openUni).toBeGreaterThan(openAi);
    const closeUni = src.lastIndexOf('</UnifiedImportProvider>');
    const closeAi = src.lastIndexOf('</AiUiPreferenceProvider>');
    expect(closeUni).toBeGreaterThan(0);
    expect(closeAi).toBeGreaterThan(closeUni);
  });
});
