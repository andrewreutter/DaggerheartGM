import { describe, it, expect } from 'vitest';
import { NotThisTime, Prestidigitation, StrangePatterns } from '../../../../src/features-v2/classes/Wizard.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  mockGameState,
  mockCharacter,
  mockAdversary,
  mockRoll,
  mockAdversaryAttackRoll,
  runIntent,
} from '../helpers.js';

describe('Wizard — Prestidigitation', () => {
  it('is narrative-only (name + description)', () => {
    expect(Prestidigitation.hooks).toBeUndefined();
    expect(Prestidigitation.chips).toBeUndefined();
    expect(Prestidigitation.name).toBe('Prestidigitation');
  });
});

describe('Wizard — Not This Time', () => {
  it('exposes a reviewAction chip when an adversary attacks and is within Far of the wizard', () => {
    const wiz = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const target = mockCharacter({ instanceId: 'char-2', tokenX: 20, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, adv, target],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Not This Time',
        featureState: { 'Not This Time': {} },
        rolls: mockAdversaryAttackRoll(),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-2'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...NotThisTime, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.some((c) => c.name === 'Not This Time — reroll attack')).toBe(true);
  });

  it('does not offer the chip when the adversary is at Very Far range', () => {
    const wiz = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 400, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Not This Time',
        featureState: { 'Not This Time': {} },
        rolls: mockAdversaryAttackRoll(),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...NotThisTime, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.filter((c) => c.name === 'Not This Time — reroll attack')).toHaveLength(0);
  });

  it('does not offer the chip when tokens are not on the map (range unknown)', () => {
    const wiz = mockCharacter({ instanceId: 'char-1', tokenX: null, tokenY: null });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Not This Time',
        featureState: { 'Not This Time': {} },
        rolls: mockAdversaryAttackRoll(),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...NotThisTime, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.filter((c) => c.name === 'Not This Time — reroll attack')).toHaveLength(0);
  });

  it('onUse queues rerollDie for the GM die (adversary attack)', () => {
    const wiz = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const target = mockCharacter({ instanceId: 'char-2', tokenX: 10, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, adv, target],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Not This Time',
        featureState: { 'Not This Time': {} },
        rolls: mockAdversaryAttackRoll(),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-2'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...NotThisTime, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    const chip = chips.find((c) => c.name === 'Not This Time — reroll attack');
    expect(chip).toBeDefined();

    const mutations = activateChip(chip, table, makeChipState());
    expect(mutations.filter((m) => m.type === 'rerollDie')).toHaveLength(1);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'gmDie' }),
      })
    );
  });

  it('offers reroll damage chip when only the damage pool is present (no GM attack die)', () => {
    const wiz = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Not This Time',
        featureState: { 'Not This Time': {} },
        rolls: {
          damage: {
            dice: [
              { name: 'weapon', die: 'd8', value: 3 },
              { name: 'fire', die: 'd6', value: 2 },
            ],
            statics: [],
          },
        },
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...NotThisTime, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.some((c) => c.name === 'Not This Time — reroll damage')).toBe(true);
    expect(chips.filter((c) => c.name === 'Not This Time — reroll attack')).toHaveLength(0);
  });

  it('onUse (damage chip) queues rerollDie for each damage die', () => {
    const wiz = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [wiz, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Not This Time',
        featureState: { 'Not This Time': {} },
        rolls: {
          damage: {
            dice: [
              { name: 'weapon', die: 'd8', value: 3 },
              { name: 'fire', die: 'd6', value: 2 },
            ],
            statics: [],
          },
        },
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      })
    );

    const chips = collectChips([{ ...NotThisTime, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    const chip = chips.find((c) => c.name === 'Not This Time — reroll damage');
    expect(chip).toBeDefined();

    const mutations = activateChip(chip, table, makeChipState());
    expect(mutations.filter((m) => m.type === 'rerollDie')).toHaveLength(2);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          dieType: 'damageDie',
          dieName: 'weapon',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          dieType: 'damageDie',
          dieName: 'fire',
        }),
      })
    );
  });
});

describe('Wizard — Strange Patterns', () => {
  it('has a create-phase chip for choosing 1–12', () => {
    const features = [{ ...StrangePatterns, _ownerInstanceId: 'char-1' }];
    const table = buildTableSnapshot(mockGameState({ _ownerInstanceId: 'char-1', _featureKey: 'Strange Patterns' }));

    const chips = collectChips(features, 'create', table);
    expect(chips.length).toBeGreaterThanOrEqual(1);
    const createChip = chips.find((c) => c.placements?.includes('create'));
    expect(createChip).toBeDefined();
    expect(typeof createChip.isSelect).toBe('function');
    expect(createChip.isSelect(table)).toHaveLength(12);
  });

  it('create chip stores patternNumber via setFeatureState', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const table = buildTableSnapshot(
      mockGameState({
        character: char,
        _ownerInstanceId: 'char-1',
        _featureKey: 'Strange Patterns',
        featureState: { 'Strange Patterns': {} },
      })
    );

    const features = [{ ...StrangePatterns, _ownerInstanceId: 'char-1' }];
    const chips = collectChips(features, 'create', table);
    const createChip = chips.find((c) => c.placements?.includes('create'));

    const mutations = activateChip(createChip, table, makeChipState(), { selectedId: '7' });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Strange Patterns',
          key: 'patternNumber',
          value: 7,
        }),
      })
    );
  });

  it('offers Hope or Stress chips when a Duality die matches the chosen number', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Strange Patterns',
        featureState: { 'Strange Patterns': { patternNumber: 7 } },
        rolls: mockRoll({
          action: {
            hopeDie: { value: 7 },
            fearDie: { value: 4 },
            dice: [],
            statics: [],
            isSuccess: true,
            isCritical: false,
          },
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

    const chips = collectChips([{ ...StrangePatterns, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.some((c) => c.name === 'Strange Patterns — gain Hope')).toBe(true);
    expect(chips.some((c) => c.name === 'Strange Patterns — clear Stress')).toBe(true);
  });

  it('does not offer pattern chips when no die matches', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Strange Patterns',
        featureState: { 'Strange Patterns': { patternNumber: 12 } },
        rolls: mockRoll({
          action: {
            hopeDie: { value: 7 },
            fearDie: { value: 4 },
            dice: [],
            statics: [],
            isSuccess: true,
            isCritical: false,
          },
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

    const chips = collectChips([{ ...StrangePatterns, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.filter((c) => c.name === 'Strange Patterns — gain Hope')).toHaveLength(0);
  });

  it('gain Hope chip queues gainHope', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Strange Patterns',
        featureState: { 'Strange Patterns': { patternNumber: 7 } },
        rolls: mockRoll({
          action: {
            hopeDie: { value: 7 },
            fearDie: { value: 4 },
            dice: [],
            statics: [],
            isSuccess: true,
            isCritical: false,
          },
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

    const chips = collectChips([{ ...StrangePatterns, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    const chip = chips.find((c) => c.name === 'Strange Patterns — gain Hope');
    const mutations = activateChip(chip, table, makeChipState());

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('sets restChangeAvailable on a long rest', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...StrangePatterns, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { 'Strange Patterns': { patternNumber: 5 } },
        actionType: 'longRest',
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Strange Patterns',
          key: 'restChangeAvailable',
          value: true,
        }),
      })
    );
  });
});
