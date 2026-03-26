import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentPath = join(__dirname, '../../src/client/components/TierShieldBadge.jsx');

describe('TierShieldBadge', () => {
  it('does not pass style as a string (React minified error #62)', () => {
    const src = readFileSync(componentPath, 'utf8');
    expect(src).not.toMatch(/style\s*=\s*["'`]/);
  });
});
