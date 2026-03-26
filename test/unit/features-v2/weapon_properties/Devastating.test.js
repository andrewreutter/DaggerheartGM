import { describe, it, expect } from 'vitest';
import { Devastating } from '../../../../src/features-v2/weapon_properties/Devastating.js';
import { runIntent, mockAction, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';
import { collectChips, activateChip } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockRoll } from '../helpers.js';

describe('Devastating', () => {
  it('computeWeaponRenderHints hides duplicate card toggle for VTT intent surface', () => {
    const hints = Devastating.computeWeaponRenderHints({
      source: { id: 'w-mace' },
    });
    expect(hints['w-mace']).toEqual({ hideDevastatingCardToggle: true });
  });

  it('offers an intent toggle chip when acting', () => {
    const { chips } = runIntent(Devastating, {
      action: mockAction({ type: 'attack' }),
    });
    expect(chips.some((c) => c.placements?.includes('intent'))).toBe(true);
    const chip = chips.find((c) => c.placements?.includes('intent'));
    expect(chip.stressCost).toBe(1);
    expect(chip.isToggle).toBe(true);
  });

  it('does not offer intent chip on non-attack actions (e.g. trait rolls)', () => {
    const { chips } = runIntent(Devastating, {
      action: mockAction({ type: 'trait' }),
    });
    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('does not offer intent chip when not acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent({ ...Devastating, _ownerInstanceId: 'char-2' }, {
      activeElements: [char, other, adv],
      action: mockAction({ type: 'attack', actorInstanceId: 'char-1' }),
    });

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });

  it('toggle on replaces damage dice with d20 and toggle off restores snapshot', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        rolls: mockRoll({
          damageDice: [
            { name: 'weapon', die: 'd8', value: 3 },
            { name: 'bonus', die: 'd4', value: 2 },
          ],
        }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...Devastating, _ownerInstanceId: 'char-1' }], 'intent', table);
    const chip = chips.find((c) => c.placements?.includes('intent'));
    expect(chip).toBeDefined();

    const chipState = mockChipState();
    const onMutations = activateChip(chip, table, chipState);
    expect(onMutations).toContainEqual(
      expect.objectContaining({ type: 'removeRollDie', payload: expect.objectContaining({ name: 'weapon' }) })
    );
    expect(onMutations).toContainEqual(
      expect.objectContaining({ type: 'removeRollDie', payload: expect.objectContaining({ name: 'bonus' }) })
    );
    expect(onMutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'weapon', die: 'd20' }),
      })
    );

    const offMutations = activateChip(chip, table, chipState);
    expect(offMutations).toContainEqual(
      expect.objectContaining({
        type: 'removeRollDie',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'weapon' }),
      })
    );
    expect(offMutations.filter((m) => m.type === 'addRollDie')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'addRollDie',
          payload: expect.objectContaining({ name: 'weapon', die: 'd8' }),
        }),
        expect.objectContaining({
          type: 'addRollDie',
          payload: expect.objectContaining({ name: 'bonus', die: 'd4' }),
        }),
      ])
    );
  });
});
