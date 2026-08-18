import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * My Tables cards wrap 2–3 across inside each Owner/Player/Public section
 * based on that section's width (container queries), not a stacked column.
 */
describe('HomeAuthenticated table card grid', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(dir, '../../src/client/components/HomeAuthenticated.jsx'), 'utf8');

  it('marks each Owner/Player/Public section as a container and wraps cards at 2 then 3 columns', () => {
    expect(src).toContain("TABLE_SECTION_CLASS = '@container min-w-0");
    expect(src).toContain("TABLE_CARD_GRID_CLASS = 'grid grid-cols-1 @xs:grid-cols-2 @xl:grid-cols-3 gap-2'");
    expect(src.match(/className=\{TABLE_SECTION_CLASS\}/g)?.length).toBe(3);
    expect(src.match(/className=\{TABLE_CARD_GRID_CLASS\}/g)?.length).toBe(3);
  });

  it('does not stack Owner/Player/Public table cards in a space-y column', () => {
    expect(src).not.toMatch(/className="space-y-2"\s*>\s*\{myTables\.map/);
    expect(src).not.toMatch(/className="space-y-2"\s*>\s*\{myRooms\.map/);
    expect(src).not.toMatch(/className="space-y-2"\s*>\s*\{publicList\.map/);
  });

  it('resolves Player-column table ids instead of navigating to /table/undefined', () => {
    expect(src).toContain("import { resolveTableCardId } from '../lib/table-character-roster.js'");
    expect(src).toContain('const tableId = resolveTableCardId(room)');
    expect(src).not.toMatch(/onClick=\{\(\) => navigate\(`\/table\/\$\{room\.tableId\}`\)\}/);
  });

  it('uses the same red CTA for Create New Table as first-table mode', () => {
    expect(src).toContain("CREATE_TABLE_CTA_CLASS = 'inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white");
    expect(src.match(/className=\{CREATE_TABLE_CTA_CLASS\}/g)?.length).toBe(2);
    expect(src).not.toMatch(/Create New Table[\s\S]{0,80}text-dh-muted/);
  });
});
