import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const battleMapSrc = readFileSync(join(dir, '../../src/client/components/BattleMap.jsx'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const start = battleMapSrc.indexOf(startMarker);
  const end = battleMapSrc.indexOf(endMarker);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return battleMapSrc.slice(start, end);
}

function rightTraySource() {
  return sliceBetween('{/* Right tray', '{/* Hidden right tray');
}

function leftTraySource() {
  return sliceBetween('{/* Left tray', '{/* Hidden tray ref for drop detection even when left tray is empty */}');
}

function headerDefinition() {
  const start = battleMapSrc.indexOf('function TrayBulkActionsHeader');
  const end = battleMapSrc.indexOf('function TrayVisibilityActionsHeader');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return battleMapSrc.slice(start, end);
}

describe('tray bulk actions', () => {
  it('hides place/return-all icons unless showIcons is true, while still reserving the row', () => {
    const src = headerDefinition();
    expect(src).toContain('showIcons = true');
    expect(src).toContain('aria-label="Place all on map"');
    expect(src).toContain('aria-label="Return all to tray"');
    // Same button layout for players — `invisible` keeps height without showing icons.
    expect(src).toContain("showIcons ? '' : 'invisible'");
    expect(src).toContain("showIcons ? '' : 'pointer-events-none'");
    expect(src).toContain('MAP_CHROME_STRIP_ROW_CLASS');
    expect(src).toContain('MAP_CHROME_STRIP_MIN_HEIGHT_PX');
    expect(src).toContain('size={14}');
    expect(src).toContain('height: MAP_CHROME_STRIP_MIN_HEIGHT_PX');
  });

  it('shares map-draw strip height with the tray place/return headers', () => {
    expect(battleMapSrc).toContain('const MAP_CHROME_STRIP_MIN_HEIGHT_PX = 42');
    expect(battleMapSrc).toContain("const MAP_CHROME_STRIP_ROW_CLASS = 'box-border border-b border-dh-border shrink-0'");
    expect(battleMapSrc).toContain('style={{ minHeight: MAP_CHROME_STRIP_MIN_HEIGHT_PX }}');
  });

  it('reserves place/return-all space on both trays for players, with GM-only icons', () => {
    expect(battleMapSrc).toContain('data-testid={testId}');

    const left = leftTraySource();
    expect(left).toContain('<TrayBulkActionsHeader');
    expect(left).toContain('showIcons={!isPlayer}');
    expect(left).not.toMatch(/charTrayTokensMerged\.length\s*>\s*0\s*&&/);

    const right = rightTraySource();
    expect(right).toContain('testId="adversary-tray-bulk-actions"');
    expect(right).toContain('<TrayBulkActionsHeader');
    expect(right).toContain('showIcons={!isPlayer}');
    // Header is always mounted (player spacer + GM icons), not gated on isPlayer
    // or on having adversary tokens — otherwise the GM token jumps.
    expect(right).not.toMatch(/\{\s*!isPlayer\s*&&\s*\(\s*<TrayBulkActionsHeader/);
    expect(right).not.toMatch(/advTrayTokens\.length\s*>\s*0/);
    expect(right).not.toMatch(/showRightAdversaryTray\s*&&\s*\n?\s*<TrayBulkActionsHeader/);
  });
});
