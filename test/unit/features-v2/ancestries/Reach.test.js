import { describe, it, expect } from 'vitest';
import { Reach } from '../../../../src/features-v2/ancestries/Giant.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockCharacter } from '../helpers.js';

describe('Reach', () => {
  it('has correct name and description', () => {
    expect(Reach.name).toBe('Reach');
    expect(typeof Reach.description).toBe('string');
  });

  it('declares rangeOverrides: { melee: veryClose }', () => {
    expect(Reach.rangeOverrides).toEqual({ melee: 'veryClose' });
  });

  it('applyDeclarativeFeatures returns melee→veryClose in rangeOverrides', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    const { rangeOverrides } = applyDeclarativeFeatures(
      [{ ...Reach, _ownerInstanceId: 'c1' }],
      char,
      table
    );
    expect(rangeOverrides).toEqual({ melee: 'veryClose' });
  });

  it('weapon range is overridden from melee to veryClose when _rangeOverrides is applied', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      primaryWeapon: { id: 'w1', name: 'Sword', tier: 1, range: 'melee' },
      _rangeOverrides: { melee: 'veryClose' },
    });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    expect(table.me.primaryWeapon.range).toBe('veryClose');
    expect(table.me.weapons[0].range).toBe('veryClose');
  });

  it('close-range weapon is unaffected by Reach', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      primaryWeapon: { id: 'w2', name: 'Bow', tier: 1, range: 'close' },
      _rangeOverrides: { melee: 'veryClose' },
    });
    const table = buildTableSnapshot(mockGameState({ character: char, _ownerInstanceId: 'c1' }));
    expect(table.me.primaryWeapon.range).toBe('close');
  });
});
