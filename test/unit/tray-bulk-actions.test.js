import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const battleMapSrc = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');

function rightTraySource() {
  const start = battleMapSrc.indexOf('{/* Right tray');
  const end = battleMapSrc.indexOf('{/* Hidden right tray');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return battleMapSrc.slice(start, end);
}

describe('adversary tray bulk actions', () => {
  it('reserves place/return-all icons on the GM right tray even with no adversary tokens', () => {
    expect(battleMapSrc).toContain('data-testid={testId}');
    const src = rightTraySource();
    expect(src).toContain('testId="adversary-tray-bulk-actions"');
    expect(src).toContain('<TrayBulkActionsHeader');
    // Header is GM-only, but not gated on having adversary tokens — otherwise the GM
    // token jumps down when the first adversary is added.
    expect(src).toMatch(/\{\s*!isPlayer\s*&&\s*\(\s*<TrayBulkActionsHeader/);
    expect(src).not.toMatch(/advTrayTokens\.length\s*>\s*0/);
    expect(src).not.toMatch(/showRightAdversaryTray\s*&&\s*\n?\s*<TrayBulkActionsHeader/);
  });
});
