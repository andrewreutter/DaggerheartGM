import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * Regression: Stress / Armor / HP defense chips share the same header structure (title + subtitle row)
 * so checkbox track tops align; Stress reserves an invisible subtitle line when needed.
 */
describe('CharacterStatBlockGraphic Stress/Armor/HP alignment', () => {
  it('uses CHIP_HEADER_BLOCK on all three stat chips', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/CharacterStatBlockGraphic.jsx');
    const src = readFileSync(path, 'utf8');
    expect(src).toContain('CHIP_HEADER_BLOCK');
    expect(src).toMatch(/const CHIP_HEADER_BLOCK\s*=/);
    expect(src).toContain('function ArmorStatChip');
    expect(src).toContain('function StressStatChip');
    expect(src).toContain('function HpStatChip');
    const armorBlock = src.slice(src.indexOf('function ArmorStatChip'), src.indexOf('function StressStatChip'));
    const stressBlock = src.slice(src.indexOf('function StressStatChip'), src.indexOf('function HpStatChip'));
    const hpBlock = src.slice(src.indexOf('function HpStatChip'), src.indexOf('function StressArmorHpChipRow'));
    for (const [name, block] of [
      ['ArmorStatChip', armorBlock],
      ['StressStatChip', stressBlock],
      ['HpStatChip', hpBlock],
    ]) {
      expect(block, name).toMatch(/className=\{CHIP_HEADER_BLOCK\}/);
    }
  });

  it('Stress chip reserves a subtitle row so track aligns with Armor/HP', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, '../../src/client/components/CharacterStatBlockGraphic.jsx');
    const src = readFileSync(path, 'utf8');
    const stressBlock = src.slice(src.indexOf('function StressStatChip'), src.indexOf('function HpStatChip'));
    expect(stressBlock).toMatch(/DEFENSE_TRACK_SUBTITLE.*invisible/);
  });
});
