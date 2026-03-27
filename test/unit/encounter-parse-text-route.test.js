import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: a global JSON body parser already reads req and sets req.body. Stacking
 * express.json() on this route caused "stream is not readable" / HTTP 500 for every request.
 */
describe('POST /api/import/encounter-parse-text', () => {
  it('does not use express.json middleware (global parser already consumed the body stream)', () => {
    const serverPath = join(dirname(fileURLToPath(import.meta.url)), '../../server.js');
    const src = readFileSync(serverPath, 'utf8');
    const key = "app.post('/api/import/encounter-parse-text'";
    const idx = src.indexOf(key);
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 500);
    expect(block).not.toMatch(/express\.json\s*\(/);
  });
});
