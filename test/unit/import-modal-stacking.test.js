import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('unified import nested overlays above Game Table layers', () => {
  it('nested FullPageOverlay editors use z-[10050] (above z-[9999] lightbox / z-[400] dice chrome)', () => {
    const path = join(root, 'src/client/components/modals/UnifiedImportModal.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/zIndexClass="z-\[10050\]"/);
    expect(src).toMatch(/zIndexClass="z-\[10051\]"/);
    expect(src).toMatch(/zIndexClass="z-\[10052\]"/);
  });
});
