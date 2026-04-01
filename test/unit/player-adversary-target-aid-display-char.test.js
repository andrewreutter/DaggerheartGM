import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: map-pin Actions must build selectTargets slots from merged sheet data (displayChar),
 * not raw table elements — otherwise V2 card chips (e.g. Arcane Barrage) match the hover sheet in slot count 0 vs N.
 */
describe('PlayerAdversaryTargetAid uses displayChar for collectSelectTargetSlots', () => {
  it('calls collectSelectTargetSlots with displayChar', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/PlayerAdversaryTargetAid.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/collectSelectTargetSlots\(\s*displayChar\s*,/);
    expect(src).not.toMatch(/collectSelectTargetSlots\(\s*el\s*,/);
  });

  it('passes pinned adversary id so single-target selectTargets render as one chip', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/PlayerAdversaryTargetAid.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/pinSelectTargetInstanceId=\{adversaryInstanceId\}/);
  });
});
