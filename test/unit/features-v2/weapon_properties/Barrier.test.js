import { describe, it, expect } from 'vitest';
import { Barrier } from '../../../../src/features-v2/weapon_properties/Barrier.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockCharacter } from '../helpers.js';

const WEAPON_ID = 'srd-wpn-tower-shield';

function makeFeature() {
  return { ...Barrier, _ownerInstanceId: 'c1', _weaponId: WEAPON_ID };
}

function makeCharWithWeapon(tier) {
  return mockCharacter({
    instanceId: 'c1',
    armorScore: 0,
    evasion: 10,
    primaryWeapon: { id: WEAPON_ID, name: 'Tower Shield', tier: String(tier), range: 'melee' },
  });
}

describe('Barrier', () => {
  it('has evasion: -1 as a static stat mod', () => {
    expect(Barrier.passiveStatMods.evasion).toBe(-1);
  });

  it('has an armorScore function that reads tier from table.me.weapons', () => {
    expect(typeof Barrier.passiveStatMods.armorScore).toBe('function');
  });

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
  ])('tier %i weapon gives +%i armorScore', (tier, expected) => {
    const char = makeCharWithWeapon(tier);
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const { stats } = applyDeclarativeFeatures([makeFeature()], char, table);
    expect(stats.armorScore).toBe(expected);
    expect(stats.evasion).toBe(9); // 10 - 1
  });

  it('defaults to tier 1 (+2 armorScore) when weapon is not found', () => {
    // Feature has _weaponId but character has no weapons — fallback to tier 1
    const char = mockCharacter({ instanceId: 'c1', armorScore: 0 });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const feature = { ...Barrier, _ownerInstanceId: 'c1', _weaponId: 'missing-id' };
    const { stats } = applyDeclarativeFeatures([feature], char, table);
    expect(stats.armorScore).toBe(2); // tier 1 default: 1 + 1
  });
});
