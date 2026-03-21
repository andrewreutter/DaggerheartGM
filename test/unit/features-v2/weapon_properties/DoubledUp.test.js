import { describe, it, expect } from 'vitest';
import { DoubledUp } from '../../../../src/features-v2/weapon_properties/DoubledUp.js';
import { runReviewAction, mockAction, mockCharacter, mockAdversary, mockRoll, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

function buildDoubledUpTable({ charPos, advPos, adv2Pos } = {}) {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: charPos?.[0] ?? 0,
    tokenY: charPos?.[1] ?? 0,
  });
  const adv1 = mockAdversary({
    instanceId: 'adv-1',
    name: 'Orc A',
    tokenX: advPos?.[0] ?? 3,
    tokenY: advPos?.[1] ?? 0,
  });
  const adv2 = mockAdversary({
    instanceId: 'adv-2',
    name: 'Orc B',
    tokenX: adv2Pos?.[0] ?? 4,
    tokenY: adv2Pos?.[1] ?? 0,
  });

  return buildTableSnapshot(
    mockGameState({
      activeElements: [char, adv1, adv2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Doubled Up',
      rolls: mockRoll({
        damageDice: [{ name: 'weapon', die: 'd6', value: 5 }],
      }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    })
  );
}

describe('DoubledUp', () => {
  it('offers a reviewAction chip when acting on an attack', () => {
    const { chips } = runReviewAction(DoubledUp, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll(),
    });
    expect(chips.some((c) => c.placements?.includes('reviewAction'))).toBe(true);
    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip.isToggle).toBe(true);
    expect(typeof chip.isSelectTarget).toBe('function');
  });

  it('does not offer a chip on non-attack actions', () => {
    const { chips } = runReviewAction(DoubledUp, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll(),
    });
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer a chip when the character is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...DoubledUp, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('isSelectTarget returns adversaries in melee range, excluding primary target', () => {
    const table = buildDoubledUpTable();
    const chips = collectChips(
      [{ ...DoubledUp, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const targets = chip.isSelectTarget(table);

    expect(targets.map((t) => t.instanceId)).not.toContain('adv-1');
    expect(targets.map((t) => t.instanceId)).toContain('adv-2');
  });

  it('isSelectTarget excludes adversaries outside melee range', () => {
    const table = buildDoubledUpTable({ adv2Pos: [100, 0] });
    const chips = collectChips(
      [{ ...DoubledUp, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const targets = chip.isSelectTarget(table);
    expect(targets.map((t) => t.instanceId)).not.toContain('adv-2');
  });

  it('onUse queues an addDamageRoll mutation for the selected target', () => {
    const table = buildDoubledUpTable();
    const chips = collectChips(
      [{ ...DoubledUp, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const chipState = mockChipState();
    const mutations = activateChip(chip, table, chipState, {
      selectedTargetIds: ['adv-2'],
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Doubled Up (Orc B)',
          targetInstanceIds: ['adv-2'],
        }),
      })
    );
  });

  it('has no stressCost', () => {
    const { chips } = runReviewAction(DoubledUp, {
      action: mockAction({ type: 'attack' }),
      rolls: mockRoll(),
    });
    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip.stressCost).toBeUndefined();
  });

  it('does not queue damage roll when toggled off', () => {
    const table = buildDoubledUpTable();
    const chips = collectChips(
      [{ ...DoubledUp, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const chipState = mockChipState();

    activateChip(chip, table, chipState, { selectedTargetIds: ['adv-2'] });

    const offMutations = activateChip(chip, table, chipState, { selectedTargetIds: ['adv-2'] });
    const dmgRolls = offMutations.filter((m) => m.type === 'addDamageRoll');
    expect(dmgRolls).toHaveLength(0);
  });
});
