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

describe('public table GET / GM SSE ownership', () => {
  const serverSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../server.js'), 'utf8');
  const dbSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../src/db.js'), 'utf8');

  it('GET table_state redacts spectators and 403s private non-members; never auto-creates for anonymous', () => {
    const start = serverSrc.indexOf("if (collection === 'table_state')");
    const block = serverSrc.slice(start, start + 4500);
    expect(block).toMatch(/classifyTableViewer/);
    expect(block).toMatch(/redactTableStateForSpectatorAudience/);
    expect(block).toMatch(/role === 'denied'/);
    expect(block).toMatch(/Never for anonymous/);
    expect(block).toMatch(/if \(!req\.uid\)/);
  });

  it('legacy includePublic merge skips table_state', () => {
    expect(serverSrc).toMatch(/COLLECTIONS\.filter\(\(col\) => col !== 'table_state'\)/);
  });

  it('GM SSE requires the requester to own the tableId', () => {
    const start = serverSrc.indexOf("app.get('/api/room/my/players'");
    const block = serverSrc.slice(start, start + 1800);
    expect(block).toMatch(/row\.userId !== user\.uid/);
    expect(block).toMatch(/tableId !== user\.uid/);
    expect(block.indexOf("res.setHeader('Content-Type', 'text/event-stream')")).toBeGreaterThan(block.indexOf('row.userId !== user.uid'));
  });

  it('upsertItem can preserve items.is_public across unrelated writes', () => {
    expect(dbSrc).toMatch(/is_public = CASE WHEN \$7::boolean THEN items\.is_public ELSE EXCLUDED\.is_public END/);
  });

  it('GET /api/public-tables does not exclude tables the viewer owns or is invited to', () => {
    const start = serverSrc.indexOf("app.get('/api/public-tables'");
    const block = serverSrc.slice(start, start + 800);
    expect(block).toMatch(/app\.get\('\/api\/public-tables',\s*optionalAuth/);
    expect(block).toMatch(/listPublicTables/);
    expect(block).not.toMatch(/excludeUserId/);
    expect(block).not.toMatch(/excludeEmail/);
    const fnStart = dbSrc.indexOf('export async function listPublicTables');
    const fn = dbSrc.slice(fnStart, fnStart + 1200);
    expect(fn).not.toMatch(/user_id !=/);
    expect(fn).not.toMatch(/playerEmails/);
  });
});
