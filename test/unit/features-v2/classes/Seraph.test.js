import { describe, it, expect } from 'vitest';
import { PrayerDice } from '../../../../src/features-v2/classes/Seraph.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, mockRoll } from '../helpers.js';

describe('Seraph — Prayer Dice', () => {
  it('onSessionStart rolls d4s equal to Spellcast trait and sets pool', () => {
    const seraph = mockCharacter({
      instanceId: 's1',
      classId: 'srd-cls-seraph',
      spellcastTrait: 'presence',
      traits: { presence: 2, agility: 0, strength: 0, finesse: 0, instinct: 0, knowledge: 0 },
    });
    const loop = createActionLoop(
      mockGameState({ activeElements: [seraph], featureState: {} }),
      mockAction({ type: 'sessionStart', actorInstanceId: 's1', targetInstanceIds: [] }),
      [{ ...PrayerDice, _ownerInstanceId: 's1' }]
    );
    const { mutations } = loop.runPhase('intent');
    const pools = mutations.filter((m) => m.type === 'setPrayerDicePool');
    expect(pools.length).toBeGreaterThanOrEqual(1);
    const last = pools[pools.length - 1];
    expect(last.payload.instanceId).toBe('s1');
    expect(last.payload.pool).toHaveLength(2);
    expect(last.payload.pool.every((n) => n >= 1 && n <= 4)).toBe(true);
    const rolls = mutations.filter((m) => m.type === 'rollDie');
    expect(rolls.length).toBe(2);
  });

  it('reviewAction chip adds Prayer Die static to action roll and removes die from pool', () => {
    const seraph = mockCharacter({
      instanceId: 's1',
      prayerDice: { pool: [3] },
      traits: { presence: 1 },
      spellcastTrait: 'presence',
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [seraph, adv],
      _ownerInstanceId: 's1',
      _featureKey: 'Prayer Dice',
      rolls: mockRoll(),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 's1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 's1', targetInstanceIds: ['adv-1'] }),
      [{ ...PrayerDice, _ownerInstanceId: 's1' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    const chip = ra.chips.find((c) => c.name === 'Prayer Die — Action');
    expect(chip).toBeDefined();
    const state = makeChipState();
    const mut = activateChip(chip, buildTableSnapshot({ ...gs, _rng: () => 0.5 }), state, { selectedId: '0' });
    expect(mut.some((m) => m.type === 'addRollStatic' && m.payload.name === 'Prayer Die' && m.payload.value === 3)).toBe(
      true
    );
    expect(mut.some((m) => m.type === 'removePrayerDieAt' && m.payload.index === 0)).toBe(true);
  });

  it('reviewAction Prayer Die — Damage chip applies when only the damage roll is present', () => {
    const seraph = mockCharacter({
      instanceId: 's1',
      prayerDice: { pool: [2] },
      traits: { presence: 1 },
      spellcastTrait: 'presence',
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [seraph, adv],
      _ownerInstanceId: 's1',
      _featureKey: 'Prayer Dice',
      rolls: mockRoll({ rolls: { action: null } }),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 's1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 's1', targetInstanceIds: ['adv-1'] }),
      [{ ...PrayerDice, _ownerInstanceId: 's1' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    expect(ra.chips.find((c) => c.name === 'Prayer Die — Action')).toBeUndefined();
    const chip = ra.chips.find((c) => c.name === 'Prayer Die — Damage');
    expect(chip).toBeDefined();
    const mut = activateChip(chip, buildTableSnapshot({ ...gs, _rng: () => 0.5 }), makeChipState(), { selectedId: '0' });
    expect(mut.some((m) => m.type === 'addRollStatic' && m.payload.rollKey === 'damage' && m.payload.value === 2)).toBe(
      true
    );
  });

  it('reduce damage chip uses reducePendingDamageForTarget for ally within Far', () => {
    const seraph = mockCharacter({
      instanceId: 's1',
      tokenX: 0,
      tokenY: 0,
      prayerDice: { pool: [4] },
      spellcastTrait: 'presence',
      traits: { presence: 1 },
    });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 30, tokenY: 0 });
    const effects = [{ type: 'damage', target: { instanceId: 'ally-1' }, amount: 8, damageType: 'physical' }];
    const gs = mockGameState({
      activeElements: [seraph, ally],
      _ownerInstanceId: 's1',
      _featureKey: 'Prayer Dice',
      rolls: mockRoll(),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'adv-1',
      targetInstanceIds: ['ally-1'],
      trait: 'Agility',
      range: 'melee',
      effects,
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'adv-1', targetInstanceIds: ['ally-1'] }),
      [{ ...PrayerDice, _ownerInstanceId: 's1' }]
    );
    loop.setEffects(effects);
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    const chip = ra.chips.find((c) => c.name === 'Prayer Die — reduce damage');
    expect(chip).toBeDefined();
    const mut = activateChip(chip, buildTableSnapshot({ ...gs, _rng: () => 0.5 }), makeChipState(), { selectedId: '0' });
    expect(effects[0].amount).toBe(4);
    expect(mut.some((m) => m.type === 'removePrayerDieAt')).toBe(true);
  });

  it('gain Hope chip queues gainHope', () => {
    const seraph = mockCharacter({
      instanceId: 's1',
      prayerDice: { pool: [2] },
      spellcastTrait: 'presence',
      traits: { presence: 1 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [seraph, adv],
      _ownerInstanceId: 's1',
      _featureKey: 'Prayer Dice',
      rolls: mockRoll(),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 's1',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 's1', targetInstanceIds: ['adv-1'] }),
      [{ ...PrayerDice, _ownerInstanceId: 's1' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    const chip = ra.chips.find((c) => c.name === 'Prayer Die — gain Hope');
    expect(chip).toBeDefined();
    const table = buildTableSnapshot({ ...gs, _rng: () => 0.5 });
    const mut = activateChip(chip, table, makeChipState(), { selectedId: '0' });
    expect(mut.some((m) => m.type === 'gainHope' && m.payload.amount === 2)).toBe(true);
  });
});
