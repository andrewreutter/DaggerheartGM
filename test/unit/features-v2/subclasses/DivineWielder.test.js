import { describe, it, expect } from 'vitest';
import {
  SpiritWeapon,
  SparingTouch,
  Devout,
  SacredResonance,
} from '../../../../src/features-v2/subclasses/DivineWielder.js';
import { PrayerDice } from '../../../../src/features-v2/classes/Seraph.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, mockRoll } from '../helpers.js';

const meleeWeaponLoadout = {
  weapons: [{ id: 'w-melee', name: 'Mace', range: 'melee', damage: '1d6', trait: 'Strength' }],
};

describe('Divine Wielder — Spirit Weapon', () => {
  it('merges rangeOverrides for melee and very close → close', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const { rangeOverrides } = applyDeclarativeFeatures([{ ...SpiritWeapon, _ownerInstanceId: 'c1' }], char, {});
    expect(rangeOverrides).toEqual({ melee: 'close', veryClose: 'close' });
  });

  it('onReviewAction marks 1 Stress when attack has weaponId and 2+ adversary targets', () => {
    const char = mockCharacter({ instanceId: 'c1', ...meleeWeaponLoadout });
    const a1 = mockAdversary({ instanceId: 'adv-1' });
    const a2 = mockAdversary({ instanceId: 'adv-2' });
    const gs = mockGameState({
      activeElements: [char, a1, a2],
      _ownerInstanceId: 'c1',
      _featureKey: 'Spirit Weapon',
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1', 'adv-2'],
      weaponId: 'w-melee',
      trait: 'Strength',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1', 'adv-2'],
        weaponId: 'w-melee',
      }),
      [{ ...SpiritWeapon, _ownerInstanceId: 'c1' }]
    );
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });

  it('does not mark Stress when weapon base range is not Melee or Very Close (SRD Spirit Weapon scope)', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      weapons: [{ id: 'w-close', name: 'Whip', range: 'close', damage: '1d6', trait: 'Finesse' }],
    });
    const a1 = mockAdversary({ instanceId: 'adv-1' });
    const a2 = mockAdversary({ instanceId: 'adv-2' });
    const gs = mockGameState({
      activeElements: [char, a1, a2],
      _ownerInstanceId: 'c1',
      _featureKey: 'Spirit Weapon',
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1', 'adv-2'],
      weaponId: 'w-close',
      trait: 'Finesse',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1', 'adv-2'],
        weaponId: 'w-close',
      }),
      [{ ...SpiritWeapon, _ownerInstanceId: 'c1' }]
    );
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });

  it('does not mark Stress for a single adversary target', () => {
    const char = mockCharacter({ instanceId: 'c1', ...meleeWeaponLoadout });
    const a1 = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, a1],
      _ownerInstanceId: 'c1',
      _featureKey: 'Spirit Weapon',
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      weaponId: 'w-melee',
      trait: 'Strength',
      range: 'melee',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-melee',
      }),
      [{ ...SpiritWeapon, _ownerInstanceId: 'c1' }]
    );
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations.filter((m) => m.type === 'markStress')).toHaveLength(0);
  });
});

describe('Divine Wielder — Sparing Touch', () => {
  it('frequencyMaxUses is 1 below tier 3 and 2 at tier 3+', () => {
    const chip = SparingTouch.chips[0];
    const t1 = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1', tier: 2 })],
        _ownerInstanceId: 'c1',
        action: {
          type: 'free',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    expect(typeof chip.frequencyMaxUses).toBe('function');
    expect(chip.frequencyMaxUses(t1)).toBe(1);
    const t3 = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1', tier: 3 })],
        _ownerInstanceId: 'c1',
        action: {
          type: 'free',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
      })
    );
    expect(chip.frequencyMaxUses(t3)).toBe(2);
  });
});

describe('Divine Wielder — Devout', () => {
  // Devout.onSessionStart still uses table.rollDie (silent, inline) to roll n+1 d4s and set the
  // pool directly. Seraph's PrayerDice.onSessionStart was migrated to rollThenResume (physical
  // animated roll), so both features fire at session start but produce different mutation types.
  // At tier 3+: PrayerDice emits a sheetActionRoll; Devout still emits setPrayerDicePool directly.

  it('onSessionStart replaces Prayer Dice pool with (n+1) d4 drop lowest at tier 3+', () => {
    const char = mockCharacter({
      instanceId: 'dw-1',
      classId: 'srd-cls-seraph',
      subclassId: 'srd-sub-divine-wielder',
      tier: 3,
      spellcastTrait: 'strength',
      traits: { strength: 2, agility: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const rng = () => 0.499;
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], featureState: {}, _rng: rng }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'dw-1', targetInstanceIds: [] }),
      [
        { ...PrayerDice, _ownerInstanceId: 'dw-1' },
        { ...Devout, _ownerInstanceId: 'dw-1' },
      ]
    );
    const { mutations } = loop.runPhase('intent');
    // Devout's inline pool replacement is the authoritative setPrayerDicePool mutation.
    const pools = mutations.filter((m) => m.type === 'setPrayerDicePool');
    const last = pools[pools.length - 1];
    expect(last.payload.instanceId).toBe('dw-1');
    expect(last.payload.pool).toHaveLength(2);
    expect(last.payload.pool).toEqual([2, 2]);
    // PrayerDice also fires a sheetActionRoll (physical dice animation).
    const sheetRolls = mutations.filter((m) => m.type === 'sheetActionRoll');
    expect(sheetRolls.length).toBeGreaterThanOrEqual(1);
  });

  it('does not replace Prayer Dice pool below tier 3 — PrayerDice emits sheetActionRoll instead', () => {
    // Below tier 3, Devout.onSessionStart returns early (no pool override).
    // PrayerDice.onSessionStart now emits sheetActionRoll (physical die) rather than setPrayerDicePool.
    const char = mockCharacter({
      instanceId: 'dw-1',
      classId: 'srd-cls-seraph',
      tier: 2,
      spellcastTrait: 'strength',
      traits: { strength: 2, agility: 0, finesse: 0, instinct: 0, presence: 0, knowledge: 0 },
    });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], featureState: {} }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'dw-1', targetInstanceIds: [] }),
      [
        { ...PrayerDice, _ownerInstanceId: 'dw-1' },
        { ...Devout, _ownerInstanceId: 'dw-1' },
      ]
    );
    const { mutations } = loop.runPhase('intent');
    // No Devout pool override (tier < 3).
    const pools = mutations.filter((m) => m.type === 'setPrayerDicePool');
    expect(pools).toHaveLength(0);
    // PrayerDice emits the physical die roll instead.
    const sheetRolls = mutations.filter((m) => m.type === 'sheetActionRoll');
    expect(sheetRolls.length).toBe(1);
    expect(sheetRolls[0].payload.rollText).toBe('[2d4]');
  });
});

const spiritWeaponMeleeLoadout = {
  weapons: [
    { id: 'w1', name: 'Warhammer', range: 'melee', damage: '1d10', trait: 'Strength' },
  ],
};

describe('Divine Wielder — Sacred Resonance', () => {
  it('adds static damage equal to sum of matching die faces (tier 4+)', () => {
    const char = mockCharacter({ instanceId: 'c1', tier: 4, ...spiritWeaponMeleeLoadout });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Sacred Resonance',
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 5 },
          { name: 'weapon-b', die: 'd8', value: 5 },
        ],
      }),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      weaponId: 'w1',
      trait: 'Strength',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'c1', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      [{ ...SacredResonance, _ownerInstanceId: 'c1' }]
    );
    loop.setRolls(gs.rolls);
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Sacred Resonance',
          value: 10,
        }),
      })
    );
  });

  it('does not add static bonus below tier 4', () => {
    const char = mockCharacter({ instanceId: 'c1', tier: 3, ...spiritWeaponMeleeLoadout });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Sacred Resonance',
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 5 },
          { name: 'weapon-b', die: 'd8', value: 5 },
        ],
      }),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      weaponId: 'w1',
      trait: 'Strength',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'c1', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      [{ ...SacredResonance, _ownerInstanceId: 'c1' }]
    );
    loop.setRolls(gs.rolls);
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Sacred Resonance')).toHaveLength(
      0
    );
  });

  it('does not add static bonus when weapon is not Spirit Weapon–eligible (base range not Melee/Very Close)', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      tier: 4,
      weapons: [{ id: 'w-close', name: 'Whip', range: 'close', damage: '1d6', trait: 'Finesse' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Sacred Resonance',
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 5 },
          { name: 'weapon-b', die: 'd8', value: 5 },
        ],
      }),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      weaponId: 'w-close',
      trait: 'Finesse',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'c1', targetInstanceIds: ['adv-1'], weaponId: 'w-close' }),
      [{ ...SacredResonance, _ownerInstanceId: 'c1' }]
    );
    loop.setRolls(gs.rolls);
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Sacred Resonance')).toHaveLength(
      0
    );
  });

  it('does not add static bonus when no damage dice share a value', () => {
    const char = mockCharacter({ instanceId: 'c1', tier: 4, ...spiritWeaponMeleeLoadout });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Sacred Resonance',
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 3 },
          { name: 'weapon-b', die: 'd8', value: 7 },
        ],
      }),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      weaponId: 'w1',
      trait: 'Strength',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'c1', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      [{ ...SacredResonance, _ownerInstanceId: 'c1' }]
    );
    loop.setRolls(gs.rolls);
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Sacred Resonance')).toHaveLength(
      0
    );
  });

  it('does not add static bonus when the weapon base range is not Melee or Very Close (Spirit Weapon ineligible)', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      tier: 4,
      weapons: [{ id: 'w1', name: 'Spear', range: 'close', damage: '1d8', trait: 'Strength' }],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Sacred Resonance',
      rolls: mockRoll({
        damageDice: [
          { name: 'weapon', die: 'd8', value: 5 },
          { name: 'weapon-b', die: 'd8', value: 5 },
        ],
      }),
    });
    gs.action = {
      type: 'attack',
      actorInstanceId: 'c1',
      targetInstanceIds: ['adv-1'],
      weaponId: 'w1',
      trait: 'Strength',
      range: 'close',
      effects: [],
      appliedEffects: [],
    };
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'c1', targetInstanceIds: ['adv-1'], weaponId: 'w1' }),
      [{ ...SacredResonance, _ownerInstanceId: 'c1' }]
    );
    loop.setRolls(gs.rolls);
    const { mutations } = loop.runPhase('reviewAction');
    expect(mutations.filter((m) => m.type === 'addRollStatic' && m.payload?.name === 'Sacred Resonance')).toHaveLength(
      0
    );
  });
});
