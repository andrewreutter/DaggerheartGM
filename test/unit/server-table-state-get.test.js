import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: GET /api/data/table_state?tableId= must use getResolvedTableState so the client
 * receives the same `top` (idle sessionPaused, lastPlayActivityAt seed) as SSE table_state events.
 */
describe('GET /api/data/table_state single-table', () => {
  it('resolves state via getResolvedTableState, not raw row + resolveCharacterElementsDb only', () => {
    const serverPath = join(dirname(fileURLToPath(import.meta.url)), '../../server.js');
    const src = readFileSync(serverPath, 'utf8');
    const start = src.indexOf("if (collection === 'table_state')");
    expect(start).toBeGreaterThan(-1);
    const tableIdBlockStart = src.indexOf('if (tableId) {', start);
    expect(tableIdBlockStart).toBeGreaterThan(-1);
    const block = src.slice(tableIdBlockStart, tableIdBlockStart + 2000);
    expect(block).toMatch(/getResolvedTableState\s*\(\s*APP_ID\s*,\s*tableId\s*\)/);
    expect(block).not.toMatch(/const state = row\.data \|\| \{\};\s*\n\s*const elements = await resolveCharacterElementsDb/);
  });
});

describe('GET /api/data/table_state list (no tableId)', () => {
  it('applies attachDerivedMapConfig after character resolution for each owned table', () => {
    const serverPath = join(dirname(fileURLToPath(import.meta.url)), '../../server.js');
    const src = readFileSync(serverPath, 'utf8');
    const start = src.indexOf("if (collection === 'table_state')");
    expect(start).toBeGreaterThan(-1);
    const listBlockStart = src.indexOf('const rows = await listTableStates', start);
    expect(listBlockStart).toBeGreaterThan(-1);
    const block = src.slice(listBlockStart, listBlockStart + 1200);
    expect(block).toMatch(/attachDerivedMapConfig\s*\(/);
    expect(block).toMatch(/resolveCharacterElementsDb/);
  });
});
