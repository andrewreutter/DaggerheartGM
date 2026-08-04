import { describe, it, expect } from 'vitest';
import { Rally, MakeAScene } from '../../../../src/features-v2/classes/Bard.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import {
  activateChip,
  makeChipState,
  collectChips,
  collectChipsForOtherCharacterSheets,
  deductChipCosts,
} from '../../../../src/features-v2/engine/chip-system.js';
import registry from '../../../../src/features-v2/registry.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, mockRoll } from '../helpers.js';

describe('Bard — Make a Scene', () => {
  it('card chip: activateChip with selectedTargetIds queues runtimeStatMod (difficulty −2) and spendHope 3', () => {
    const bard = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0, hope: 5, classId: 'srd-cls-bard' });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0, difficulty: 14 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, adv],
        _ownerInstanceId: 'b1',
        _featureKey: 'Make a Scene',
        action: {
          type: 'free',
          actorInstanceId: 'b1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...MakeAScene, _ownerInstanceId: 'b1' }], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(3);
    expect(chips[0].disabled).toBe(false);

    const fromUse = activateChip(chips[0], table, makeChipState(), { selectedTargetIds: ['adv-1'] });
    deductChipCosts(chips[0], table);
    const fromCost = applyMutations(table);
    const mutations = [...fromUse, ...fromCost];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'runtimeStatMod',
        payload: { instanceId: 'adv-1', stat: 'difficulty', delta: -2 },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'b1', amount: 3 }),
      })
    );
  });

  it('card chip is disabled when no adversary is within Melee / Very Close / Close', () => {
    const bard = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0, hope: 5, classId: 'srd-cls-bard' });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 200, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, adv],
        _ownerInstanceId: 'b1',
        _featureKey: 'Make a Scene',
        action: {
          type: 'free',
          actorInstanceId: 'b1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...MakeAScene, _ownerInstanceId: 'b1' }], 'card', table);
    expect(chips[0].disabled).toBe(true);
    expect(chips[0].selectTargets(table)).toHaveLength(0);
  });
});

describe('Bard — Rally', () => {
  it('card phase exposes Grant Rally Dice (engine chip list; root onUse alone is not collected when chips[] exists)', () => {
    const bard = mockCharacter({ instanceId: 'b1', level: 1, classId: 'srd-cls-bard' });
    const t = buildTableSnapshot(
      mockGameState({ activeElements: [bard], _ownerInstanceId: 'b1', _featureKey: 'Rally' })
    );
    const chips = collectChips([{ ...Rally, _ownerInstanceId: 'b1' }], 'card', t);
    expect(chips.some((c) => c.name === 'Grant Rally Dice')).toBe(true);
  });

  it('default card onUse sets partyDice for every character (d6 below level 5), no appendActiveModifier', () => {
    const bard = mockCharacter({ instanceId: 'b1', level: 1, classId: 'srd-cls-bard' });
    const ally = mockCharacter({ instanceId: 'c2', level: 1 });
    const t = buildTableSnapshot(
      mockGameState({ activeElements: [bard, ally], _ownerInstanceId: 'b1', _featureKey: 'Rally' })
    );
    Rally.onUse(t);
    const mut = applyMutations(t);
    expect(mut.filter((m) => m.type === 'appendActiveModifier')).toHaveLength(0);
    expect(mut.some((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice')).toBe(true);
    const party = mut.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party.payload.value).toEqual({
      b1: { dice: 'd6' },
      c2: { dice: 'd6' },
    });
    expect(party.payload.featureKey).toBe('Rally');
  });

  it('Troubadour: Rally onUse also sets maestroRallyChoices for allies (not the Bard)', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      level: 1,
      classId: 'srd-cls-bard',
      subclassId: 'srd-sub-troubadour',
    });
    const ally = mockCharacter({ instanceId: 'c2', level: 1 });
    const t = buildTableSnapshot(
      mockGameState({ activeElements: [bard, ally], _ownerInstanceId: 'b1', _featureKey: 'Rally' })
    );
    Rally.onUse(t);
    const mut = applyMutations(t);
    const m = mut.find((x) => x.type === 'setFeatureState' && x.payload.key === 'maestroRallyChoices');
    expect(m).toBeDefined();
    expect(m.payload.featureKey).toBe('Rally');
    expect(m.payload.value).toEqual({ c2: null });
  });

  it('non-Troubadour: Rally onUse does not set maestroRallyChoices', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      level: 1,
      classId: 'srd-cls-bard',
      subclassId: 'srd-sub-wordsmith',
    });
    const ally = mockCharacter({ instanceId: 'c2', level: 1 });
    const t = buildTableSnapshot(
      mockGameState({ activeElements: [bard, ally], _ownerInstanceId: 'b1', _featureKey: 'Rally' })
    );
    Rally.onUse(t);
    const mut = applyMutations(t);
    expect(mut.some((x) => x.type === 'setFeatureState' && x.payload.key === 'maestroRallyChoices')).toBe(
      false
    );
  });

  it('uses d8 when Bard is level 5+', () => {
    const bard = mockCharacter({ instanceId: 'b1', level: 5, classId: 'srd-cls-bard' });
    const t = buildTableSnapshot(
      mockGameState({ activeElements: [bard], _ownerInstanceId: 'b1', _featureKey: 'Rally' })
    );
    Rally.onUse(t);
    const mut = applyMutations(t);
    const party = mut.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party.payload.value).toEqual({ b1: { dice: 'd8' } });
  });

  it('uses d10 for Wordsmith (Epic Poetry)', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      level: 1,
      classId: 'srd-cls-bard',
      subclassId: 'srd-sub-wordsmith',
    });
    const t = buildTableSnapshot(
      mockGameState({ activeElements: [bard], _ownerInstanceId: 'b1', _featureKey: 'Rally' })
    );
    Rally.onUse(t);
    const mut = applyMutations(t);
    const party = mut.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party.payload.value).toEqual({ b1: { dice: 'd10' } });
  });

  it('Spend Rally Die — Action adds static to action roll and clears partyDice', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [bard, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Rally',
      featureState: { Rally: { partyDice: { b1: { dice: 'd6' } } } },
      rolls: mockRoll(),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'b1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] }),
      [{ ...Rally, _ownerInstanceId: 'b1' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    const rallyChip = ra.chips.find((c) => c.name === 'Spend Rally Die — Action');
    expect(rallyChip).toBeDefined();
    const state = makeChipState();
    const mut = activateChip(rallyChip, buildTableSnapshot({ ...gs, _rng: () => 0.99 }), state);
    expect(mut.some((m) => m.type === 'addRollStatic' && m.payload.name === 'Rally Die' && m.payload.rollKey === 'action')).toBe(true);
    expect(mut.some((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice')).toBe(true);
    const party = mut.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party.payload.value).toEqual({});
  });

  it('Spend Rally Die — Damage adds static to damage roll and clears partyDice', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [bard, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Rally',
      featureState: { Rally: { partyDice: { b1: { dice: 'd6' } } } },
      rolls: {
        action: undefined,
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 5 }],
          statics: [],
        },
        other: {},
      },
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'b1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'b1', targetInstanceIds: ['adv-1'] }),
      [{ ...Rally, _ownerInstanceId: 'b1' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    const dmgChip = ra.chips.find((c) => c.name === 'Spend Rally Die — Damage');
    expect(dmgChip).toBeDefined();
    expect(ra.chips.filter((c) => c.name?.startsWith('Spend Rally Die'))).toHaveLength(1);
    const mut = activateChip(dmgChip, buildTableSnapshot({ ...gs, _rng: () => 0.99 }), makeChipState());
    expect(mut.some((m) => m.type === 'addRollStatic' && m.payload.name === 'Rally Die' && m.payload.rollKey === 'damage')).toBe(true);
    const party = mut.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party.payload.value).toEqual({});
  });

  it('Spend Rally Die — Action uses action actor (ally) when ally is attacking', () => {
    const bard = mockCharacter({ instanceId: 'b1', level: 1, classId: 'srd-cls-bard' });
    const ally = mockCharacter({
      instanceId: 'c2',
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [bard, ally, adv],
      _ownerInstanceId: 'b1',
      _featureKey: 'Rally',
      featureState: { Rally: { partyDice: { b1: { dice: 'd6' }, c2: { dice: 'd6' } } } },
      rolls: mockRoll(),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c2',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'c2', targetInstanceIds: ['adv-1'] }),
      [{ ...Rally, _ownerInstanceId: 'b1' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    const rallyChip = ra.chips.find((c) => c.name === 'Spend Rally Die — Action');
    expect(rallyChip).toBeDefined();
    const state = makeChipState();
    const mut = activateChip(rallyChip, buildTableSnapshot({ ...gs, _rng: () => 0.99 }), state);
    expect(mut.some((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice')).toBe(true);
    const party = mut.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party.payload.value).toEqual({ b1: { dice: 'd6' } });
  });

  // After the rollThenResume migration, "Spend Rally Die — Clear Stress" now queues a physical
  // (animated, GM-acknowledged) die roll via sheetActionRoll instead of silently calling rollDie
  // + clearStress. The Stress clear happens in Rally.hooks.onPhysicalRollResolved after GM ack.

  it('Spend Rally Die — Clear Stress emits sheetActionRoll with _v2PhysicalRollResume', () => {
    const ally = mockCharacter({ instanceId: 'c2', currentStress: 4 });
    const bard = mockCharacter({ instanceId: 'b1', classId: 'srd-cls-bard' });
    const gs = mockGameState({
      activeElements: [bard, ally],
      _ownerInstanceId: 'c2',
      _featureKey: 'Rally',
      featureState: { Rally: { partyDice: { c2: { dice: 'd6' } } } },
    });
    const t = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Rally, _ownerInstanceId: 'b1' }], 'card', t);
    const stressChip = chips.find((c) => c.name === 'Spend Rally Die — Clear Stress');
    expect(stressChip).toBeDefined();
    const mut = activateChip(stressChip, t, makeChipState());
    // Should emit sheetActionRoll, not clearStress + rollDie.
    const roll = mut.find((m) => m.type === 'sheetActionRoll');
    expect(roll).toBeDefined();
    expect(roll.payload.rollText).toBe('[d6]');
    expect(roll.payload.rollMeta?._v2PhysicalRollResume).toBeDefined();
    expect(roll.payload.rollMeta._v2PhysicalRollResume.resumeState?.spenderInstanceId).toBe('c2');
    // No silent clearStress or rollDie in this phase.
    expect(mut.some((m) => m.type === 'clearStress')).toBe(false);
    expect(mut.some((m) => m.type === 'rollDie')).toBe(false);
  });

  it('Rally.hooks.onPhysicalRollResolved clears Stress and removes spender from partyDice', () => {
    const bard = mockCharacter({ instanceId: 'b1', classId: 'srd-cls-bard' });
    const ally = mockCharacter({ instanceId: 'c2', currentStress: 4 });
    const gs = mockGameState({
      activeElements: [bard, ally],
      _ownerInstanceId: 'c2',  // table.me = ally (spender)
      _featureKey: 'Rally',
      _activeFeature: { ...Rally, _ownerInstanceId: 'b1' },
      featureState: { Rally: { partyDice: { c2: { dice: 'd6' }, b1: { dice: 'd6' } } } },
    });
    const table = buildTableSnapshot(gs);
    Rally.hooks.onPhysicalRollResolved(table, { total: 5, values: [5], notation: 'd6' }, { spenderInstanceId: 'c2' });
    const mutations = applyMutations(table);
    // Stress should be cleared on the ally (table.me = c2).
    expect(mutations.some((m) => m.type === 'clearStress' && m.payload.instanceId === 'c2' && m.payload.amount === 5)).toBe(true);
    // Only the spender's Rally Die should be removed.
    const party = mutations.find((m) => m.type === 'setFeatureState' && m.payload.key === 'partyDice');
    expect(party).toBeDefined();
    expect(party.payload.value).toEqual({ b1: { dice: 'd6' } });
  });

  it('collectChipsForOtherCharacterSheets surfaces Rally stress chip for allies (Bard not viewer)', () => {
    const bard = mockCharacter({ instanceId: 'b1', classId: 'srd-cls-bard' });
    const ally = mockCharacter({
      instanceId: 'c2',
    });
    const base = mockGameState({
      activeElements: [bard, ally],
      featureState: { Rally: { partyDice: { c2: { dice: 'd6' } } } },
    });
    const cross = collectChipsForOtherCharacterSheets('c2', [bard, ally], registry, 'card', base);
    const stress = cross.find((c) => c.name === 'Spend Rally Die — Clear Stress');
    expect(stress).toBeDefined();
    expect(stress._crossSheetFromOwnerInstanceId).toBe('b1');
    expect(stress._ownerInstanceId).toBe('b1');
    expect(cross.some((c) => c.name === 'Make a Scene')).toBe(false);
  });

  it('collectChipsForOtherCharacterSheets surfaces Rally stress chip for the Bard when Bard is viewer', () => {
    const bard = mockCharacter({ instanceId: 'b1', classId: 'srd-cls-bard' });
    const ally = mockCharacter({
      instanceId: 'c2',
    });
    const base = mockGameState({
      activeElements: [bard, ally],
      featureState: { Rally: { partyDice: { b1: { dice: 'd6' } } } },
    });
    const cross = collectChipsForOtherCharacterSheets('b1', [bard, ally], registry, 'card', base);
    const stress = cross.find((c) => c.name === 'Spend Rally Die — Clear Stress');
    expect(stress).toBeDefined();
    expect(stress._crossSheetFromOwnerInstanceId).toBe('b1');
    expect(stress._ownerInstanceId).toBe('b1');
  });
});
