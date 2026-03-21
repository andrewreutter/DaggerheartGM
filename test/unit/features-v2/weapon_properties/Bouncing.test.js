import { describe, it, expect } from 'vitest';
import { Bouncing } from '../../../../src/features-v2/weapon_properties/Bouncing.js';
import { runReviewAction, mockAction, mockCharacter, mockAdversary, mockRoll, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

function buildBouncingTable({ charPos, advPos, adv2Pos, adv3Pos, attackRange } = {}) {
  const char = mockCharacter({
    instanceId: 'char-1',
    tokenX: charPos?.[0] ?? 0,
    tokenY: charPos?.[1] ?? 0,
  });
  const adv1 = mockAdversary({
    instanceId: 'adv-1',
    name: 'Goblin A',
    tokenX: advPos?.[0] ?? 5,
    tokenY: advPos?.[1] ?? 0,
  });
  const adv2 = mockAdversary({
    instanceId: 'adv-2',
    name: 'Goblin B',
    tokenX: adv2Pos?.[0] ?? 10,
    tokenY: adv2Pos?.[1] ?? 0,
  });
  const elements = [char, adv1, adv2];
  if (adv3Pos) {
    elements.push(
      mockAdversary({
        instanceId: 'adv-3',
        name: 'Goblin C',
        tokenX: adv3Pos[0],
        tokenY: adv3Pos[1],
      })
    );
  }

  return buildTableSnapshot(
    mockGameState({
      activeElements: elements,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Bouncing',
      rolls: mockRoll({
        damageDice: [{ name: 'weapon', die: 'd6', value: 4 }],
      }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: attackRange ?? 'far',
        effects: [],
        appliedEffects: [],
      },
    })
  );
}

describe('Bouncing', () => {
  it('offers a reviewAction chip when acting on an attack', () => {
    const { chips } = runReviewAction(Bouncing, {
      action: mockAction({ type: 'attack', range: 'far' }),
      rolls: mockRoll(),
    });
    expect(chips.some((c) => c.placements?.includes('reviewAction'))).toBe(true);
    const chip = chips.find((c) => c.placements?.includes('reviewAction'));
    expect(chip.isToggle).toBe(true);
    expect(chip.multiSelect).toBe(true);
    expect(typeof chip.isSelectTarget).toBe('function');
  });

  it('does not offer a chip on non-attack actions', () => {
    const { chips } = runReviewAction(Bouncing, {
      action: mockAction({ type: 'trait' }),
      rolls: mockRoll(),
    });
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('does not offer a chip when the character is not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction({ ...Bouncing, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
      rolls: mockRoll(),
    });
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });

  it('isSelectTarget returns adversaries in range, excluding primary target', () => {
    const table = buildBouncingTable({ attackRange: 'far' });
    const chips = collectChips(
      [{ ...Bouncing, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const targets = chip.isSelectTarget(table);

    expect(targets.map((t) => t.instanceId)).not.toContain('adv-1');
    expect(targets.map((t) => t.instanceId)).toContain('adv-2');
  });

  it('isSelectTarget excludes targets out of range', () => {
    const table = buildBouncingTable({
      attackRange: 'melee',
      adv2Pos: [100, 0],
    });
    const chips = collectChips(
      [{ ...Bouncing, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const targets = chip.isSelectTarget(table);
    expect(targets.map((t) => t.instanceId)).not.toContain('adv-2');
  });

  it('onUse queues addDamageRoll mutations for each selected target', () => {
    const table = buildBouncingTable();
    const chips = collectChips(
      [{ ...Bouncing, _ownerInstanceId: 'char-1' }],
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
          name: 'Bouncing (Goblin B)',
          targetInstanceIds: ['adv-2'],
        }),
      })
    );
  });

  it('stressCost equals the number of selected targets', () => {
    const table = buildBouncingTable({
      adv3Pos: [20, 0],
    });
    const chips = collectChips(
      [{ ...Bouncing, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const chipState = mockChipState();

    activateChip(chip, table, chipState, {
      selectedTargetIds: ['adv-2', 'adv-3'],
    });

    expect(typeof chip.stressCost).toBe('function');
    expect(chip.stressCost(table)).toBe(2);
  });

  it('queues damage rolls for multiple targets', () => {
    const table = buildBouncingTable({
      adv3Pos: [20, 0],
    });
    const chips = collectChips(
      [{ ...Bouncing, _ownerInstanceId: 'char-1' }],
      'reviewAction',
      table
    );
    const chip = chips[0];
    const chipState = mockChipState();
    const mutations = activateChip(chip, table, chipState, {
      selectedTargetIds: ['adv-2', 'adv-3'],
    });

    const dmgRolls = mutations.filter((m) => m.type === 'addDamageRoll');
    expect(dmgRolls).toHaveLength(2);
    expect(dmgRolls[0].payload.targetInstanceIds).toEqual(['adv-2']);
    expect(dmgRolls[1].payload.targetInstanceIds).toEqual(['adv-3']);
  });
});
