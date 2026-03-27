import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: only the table GM may POST a new personal map camera; players already get
 * unsynced pan/zoom via shared map + free explore (client localStorage).
 */
describe('POST /api/room/:tableId/personal-cameras', () => {
  it('rejects non-GM before database insert', () => {
    const serverPath = join(dirname(fileURLToPath(import.meta.url)), '../../server.js');
    const src = readFileSync(serverPath, 'utf8');
    const start = src.indexOf("app.post('/api/room/:tableId/personal-cameras'");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, start + 900);
    expect(block).toMatch(/req\.uid\s*!==\s*ctx\.gmUid/);
    expect(block).toMatch(/403/);
  });
});
