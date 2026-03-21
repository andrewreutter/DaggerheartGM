import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { Efficient } from '../../../../src/features-v2/ancestries/Clank.js';
import { CelestialTrance } from '../../../../src/features-v2/ancestries/Elf.js';
import { mockCharacter, mockGameState } from '../helpers.js';

describe('applyDeclarativeFeatures', () => {
  it('accumulates CONV-011 rest slot passiveStatMods into stats', () => {
    const character = { traits: {} };
    const table = {};
    const { stats } = applyDeclarativeFeatures(
      [Efficient, CelestialTrance],
      character,
      table
    );
    expect(stats.numLongMovesInShortRest).toBe(1);
    expect(stats.numShortRestSlots).toBe(1);
    expect(stats.numLongRestSlots).toBe(1);
  });

  it('supports function values in passiveStatMods (e.g. (table) => table.me.proficiency)', () => {
    const char = mockCharacter({ instanceId: 'c1', proficiency: 2, armorThresholds: { major: 5, severe: 10 } });
    const table = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'c1' }));

    const feature = {
      name: 'DynamicMod',
      passiveStatMods: {
        majorThreshold: (t) => t.me?.proficiency ?? 1,
        severeThreshold: (t) => t.me?.proficiency ?? 1,
      },
      _ownerInstanceId: 'c1',
    };

    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.majorThreshold).toBe(7);   // 5 + 2
    expect(stats.severeThreshold).toBe(12); // 10 + 2
  });

  it('passes feature as second arg to passiveStatMods functions (e.g. for _weaponId lookup)', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      armorScore: 0,
      primaryWeapon: { id: 'w-test', name: 'Test Weapon', tier: 3, range: 'melee' },
    });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const feature = {
      name: 'TieredTest',
      passiveStatMods: {
        armorScore: (t, self) => {
          const weapon = t.me?.weapons?.find((w) => w.id === self?._weaponId);
          return (weapon?.tier ?? 1) + 1;
        },
      },
      _ownerInstanceId: 'c1',
      _weaponId: 'w-test',
    };
    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.armorScore).toBe(4); // tier 3 + 1
  });

  it('returns rangeOverrides from features that declare them', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const feature = {
      name: 'RangeTest',
      rangeOverrides: { melee: 'veryClose' },
      _ownerInstanceId: 'c1',
    };
    const { rangeOverrides } = applyDeclarativeFeatures([feature], char, table);
    expect(rangeOverrides).toEqual({ melee: 'veryClose' });
  });

  it('handles majorThreshold and severeThreshold as static passiveStatMods', () => {
    const char = mockCharacter({ instanceId: 'c1', armorThresholds: { major: 7, severe: 12 } });
    const table = {};

    const feature = {
      name: 'StaticThresholds',
      passiveStatMods: { majorThreshold: 3, severeThreshold: 3 },
      _ownerInstanceId: 'c1',
    };

    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.majorThreshold).toBe(10); // 7 + 3
    expect(stats.severeThreshold).toBe(15); // 12 + 3
  });
});
