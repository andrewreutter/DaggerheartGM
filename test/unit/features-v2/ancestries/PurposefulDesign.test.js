import { describe, it, expect } from 'vitest';
import { PurposefulDesign } from '../../../../src/features-v2/ancestries/Clank.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { mockTable, mockCharacter, mockGameState } from '../helpers.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';

describe('PurposefulDesign', () => {
  it('has the correct name and description', () => {
    expect(PurposefulDesign.name).toBe('Purposeful Design');
    expect(PurposefulDesign.description).toMatch(/character creation/i);
    expect(PurposefulDesign.description).toMatch(/experience/i);
  });

  it('has a create-phase chip for choosing an Experience', () => {
    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const table = mockTable({ _ownerInstanceId: 'char-1' });

    const chips = collectChips(features, 'create', table);
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Purposeful Design');
    expect(chips[0].placements).toContain('create');
  });

  it('does not show a chip during the review phase', () => {
    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const table = mockTable({ _ownerInstanceId: 'char-1' });

    const chips = collectChips(features, 'reviewOutcome', table);
    expect(chips).toHaveLength(0);
  });

  it('chip has isSelect that returns experiences from table.me', () => {
    const experiences = [
      { id: 'exp-1', name: 'Scholar' },
      { id: 'exp-2', name: 'Soldier' },
    ];
    const char = mockCharacter({ instanceId: 'char-1', experiences });
    const gameState = mockGameState({
      character: char,
      _ownerInstanceId: 'char-1',
    });
    const table = buildTableSnapshot(gameState);

    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const chips = collectChips(features, 'create', table);
    expect(chips).toHaveLength(1);

    const chip = chips[0];
    expect(typeof chip.isSelect).toBe('function');
    const options = chip.isSelect(table);
    expect(options).toEqual([
      { id: 'exp-1', name: 'Scholar' },
      { id: 'exp-2', name: 'Soldier' },
    ]);
  });

  it('isSelect returns empty array when character has no experiences', () => {
    const table = mockTable({ _ownerInstanceId: 'char-1' });

    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const chips = collectChips(features, 'create', table);
    const chip = chips[0];

    const options = chip.isSelect(table);
    expect(options).toEqual([]);
  });

  it('activating the chip with selectedId queues addExperienceBonus mutation', () => {
    const experiences = [
      { id: 'exp-1', name: 'Scholar' },
      { id: 'exp-2', name: 'Soldier' },
    ];
    const char = mockCharacter({ instanceId: 'char-1', experiences });
    const gameState = mockGameState({
      character: char,
      _ownerInstanceId: 'char-1',
    });
    const table = buildTableSnapshot(gameState);

    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const chips = collectChips(features, 'create', table);
    const chip = chips[0];
    const chipState = makeChipState();

    const mutations = activateChip(chip, table, chipState, { selectedId: 'exp-1' });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addExperienceBonus',
        payload: expect.objectContaining({ instanceId: 'char-1', experienceId: 'exp-1', amount: 1 }),
      })
    );
  });

  it('activating the chip without selectedId queues no mutations', () => {
    const experiences = [{ id: 'exp-1', name: 'Scholar' }];
    const char = mockCharacter({ instanceId: 'char-1', experiences });
    const gameState = mockGameState({
      character: char,
      _ownerInstanceId: 'char-1',
    });
    const table = buildTableSnapshot(gameState);

    const features = [{ ...PurposefulDesign, _ownerInstanceId: 'char-1' }];
    const chips = collectChips(features, 'create', table);
    const chip = chips[0];
    const chipState = makeChipState();

    const mutations = activateChip(chip, table, chipState);

    expect(mutations.filter(m => m.type === 'addExperienceBonus')).toHaveLength(0);
  });
});
