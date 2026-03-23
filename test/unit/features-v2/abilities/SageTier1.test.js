import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations as applyTableMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { GiftedTracker } from '../../../../src/features-v2/abilities/Sage/GiftedTracker.js';
import { NaturesTongue } from '../../../../src/features-v2/abilities/Sage/NaturesTongue.js';
import { ViciousEntangle } from '../../../../src/features-v2/abilities/Sage/ViciousEntangle.js';
import { ConjureSwarm } from '../../../../src/features-v2/abilities/Sage/ConjureSwarm.js';
import { NaturalFamiliar } from '../../../../src/features-v2/abilities/Sage/NaturalFamiliar.js';
import { CorrosiveProjectile } from '../../../../src/features-v2/abilities/Sage/CorrosiveProjectile.js';
import { ToweringStalk } from '../../../../src/features-v2/abilities/Sage/ToweringStalk.js';
import { WildFortress } from '../../../../src/features-v2/abilities/Sage/WildFortress.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  runReviewAction,
  mockAdversaryAttackRoll,
} from '../helpers.js';

function freeActionTable(charId, featureKey) {
  return buildTableSnapshot(
    mockGameState({
      activeElements: [mockCharacter({ instanceId: charId, spellcastTrait: 'presence', traits: { presence: 2 } })],
      _ownerInstanceId: charId,
      _featureKey: featureKey,
      action: {
        type: 'free',
        actorInstanceId: charId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    })
  );
}

function targetedDefenseTable(engaged = false) {
  const char = mockCharacter({ instanceId: 'char-1' });
  const adv = mockAdversary({ instanceId: 'adv-1' });
  return buildTableSnapshot(
    mockGameState({
      character: char,
      adversary: adv,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Gifted Tracker',
      featureState: engaged
        ? { 'Gifted Tracker': { giftedTrackerEngaged: true } }
        : {},
      rolls: mockRoll(),
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    })
  );
}

describe('Sage Tier 1 — Gifted Tracker', () => {
  it('main card queues actionLoop for tracking questions', () => {
    const tbl = freeActionTable('g1', 'Gifted Tracker');
    const chips = collectChips([{ ...GiftedTracker, _ownerInstanceId: 'g1' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Gifted Tracker');
    const m = activateChip(main, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Gifted Tracker' }),
      })
    );
  });

  it('reviewAction grants +1 evasion when engaged toggle is on and owner is targeted', () => {
    const tbl = targetedDefenseTable(true);
    const feat = { ...GiftedTracker, _ownerInstanceId: 'char-1' };
    const reviewChips = collectChips([feat], 'reviewAction', tbl);
    expect(reviewChips.length).toBeGreaterThanOrEqual(1);
    const evasionChip = reviewChips.find((c) => c.temporaryStatMods?.evasion === 1);
    expect(evasionChip?.temporaryStatMods).toEqual({ evasion: 1 });
    const m = activateChip(evasionChip, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({ instanceId: 'char-1', stat: 'evasion', value: 1 }),
      })
    );
  });

  it('reviewAction has no evasion chip when toggle is off', () => {
    const tbl = targetedDefenseTable();
    const feat = { ...GiftedTracker, _ownerInstanceId: 'char-1' };
    const reviewChips = collectChips([feat], 'reviewAction', tbl);
    expect(reviewChips).toHaveLength(0);
  });
});

describe('Sage Tier 1 — Nature\'s Tongue', () => {
  it('speak-with-nature card queues actionLoop', () => {
    const tbl = freeActionTable('n1', "Nature's Tongue");
    const chips = collectChips([{ ...NaturesTongue, _ownerInstanceId: 'n1' }], 'card', tbl);
    const speak = chips.find((c) => c.name === "Nature's Tongue — Speak with nature");
    const m = activateChip(speak, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: "Nature's Tongue", trait: 'Instinct', difficulty: 12 }),
      })
    );
  });

  it('intent chip spends 1 Hope and adds +2 static when natural environment is on and action is Spellcast', () => {
    const char = mockCharacter({ instanceId: 'n1', spellcastTrait: 'presence', traits: { presence: 2 } });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        character: char,
        adversary: adv,
        _ownerInstanceId: 'n1',
        _featureKey: "Nature's Tongue",
        featureState: { "Nature's Tongue": { naturalEnvironment: true } },
        rolls: mockRoll(),
        action: {
          type: 'spellcast',
          actorInstanceId: 'n1',
          targetInstanceIds: ['adv-1'],
          trait: 'Presence',
          range: 'close',
          effects: [],
          appliedEffects: [],
        },
      })
    );
    const feat = { ...NaturesTongue, _ownerInstanceId: 'n1' };
    const intentChips = collectChips([feat], 'intent', tbl);
    const intentChip = intentChips.find((c) => c.placements?.includes('intent'));
    expect(intentChip?.hopeCost).toBe(1);
    const fromUse = activateChip(intentChip, tbl, makeChipState());
    deductChipCosts(intentChip, tbl);
    const mutations = [...fromUse, ...applyTableMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'n1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: "Nature's Tongue", value: 2 }),
      })
    );
  });
});

describe('Sage Tier 1 — Vicious Entangle', () => {
  it('card queues Spellcast actionLoop with trait', () => {
    const tbl = freeActionTable('v1', 'Vicious Entangle');
    const chips = collectChips([{ ...ViciousEntangle, _ownerInstanceId: 'v1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Vicious Entangle', trait: 'Presence' }),
      })
    );
  });
});

describe('Sage Tier 1 — Conjure Swarm', () => {
  it('Tekaira Armored Beetles queues actionLoop', () => {
    const tbl = freeActionTable('cs1', 'Conjure Swarm');
    const chips = collectChips([{ ...ConjureSwarm, _ownerInstanceId: 'cs1' }], 'card', tbl);
    const beetle = chips.find((c) => c.name === 'Tekaira Armored Beetles');
    const m = activateChip(beetle, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Conjure Swarm — Tekaira Armored Beetles' }),
      })
    );
  });

  it('Tekaira Armored Beetles sets conjureSwarmBeetlesAwaiting in feature state', () => {
    const tbl = freeActionTable('cs1', 'Conjure Swarm');
    const chips = collectChips([{ ...ConjureSwarm, _ownerInstanceId: 'cs1' }], 'card', tbl);
    const beetle = chips.find((c) => c.name === 'Tekaira Armored Beetles');
    const m = [...activateChip(beetle, tbl, makeChipState()), ...applyTableMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Conjure Swarm',
          key: 'conjureSwarmBeetlesAwaiting',
          value: true,
        }),
      })
    );
  });

  it('onReviewAction reduces incoming physical damage once while beetle shield is awaiting', () => {
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 3, damageType: 'physical' },
    ];
    runReviewAction(
      { ...ConjureSwarm, _ownerInstanceId: 'char-1' },
      {
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects,
        },
        featureState: { 'Conjure Swarm': { conjureSwarmBeetlesAwaiting: true } },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(effects[0].amount).toBe(2);
  });

  it('onReviewAction does not reduce damage when beetle shield is not awaiting', () => {
    const effects = [
      { type: 'damage', target: { instanceId: 'char-1' }, amount: 3, damageType: 'physical' },
    ];
    runReviewAction(
      { ...ConjureSwarm, _ownerInstanceId: 'char-1' },
      {
        action: {
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects,
        },
        featureState: { 'Conjure Swarm': { conjureSwarmBeetlesAwaiting: false } },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(effects[0].amount).toBe(3);
  });

  it('onRest clears beetle feature state', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Conjure Swarm',
        featureState: {
          'Conjure Swarm': { conjureSwarmBeetlesAwaiting: true, conjureSwarmBeetlesActive: true },
        },
        action: {
          type: 'shortRest',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    ConjureSwarm.hooks.onRest(tbl);
    const m = applyTableMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Conjure Swarm',
          key: 'conjureSwarmBeetlesAwaiting',
          value: false,
        }),
      })
    );
  });

  it('Fire Flies queues Spellcast actionLoop with trait', () => {
    const tbl = freeActionTable('cs2', 'Conjure Swarm');
    const chips = collectChips([{ ...ConjureSwarm, _ownerInstanceId: 'cs2' }], 'card', tbl);
    const fire = chips.find((c) => c.name === 'Fire Flies');
    const m = activateChip(fire, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Conjure Swarm — Fire Flies', trait: 'Presence' }),
      })
    );
  });
});

describe('Sage Tier 1 — Natural Familiar', () => {
  it('Summon familiar (flying) sets naturalFamiliarFlying', () => {
    const tbl = freeActionTable('nf1', 'Natural Familiar');
    const chips = collectChips([{ ...NaturalFamiliar, _ownerInstanceId: 'nf1' }], 'card', tbl);
    const summon = chips.find((c) => c.name === 'Summon familiar');
    const m = [
      ...activateChip(summon, tbl, makeChipState(), { selectedId: 'flying' }),
      ...applyTableMutations(tbl),
    ];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Natural Familiar',
          key: 'naturalFamiliarFlying',
          value: true,
        }),
      })
    );
  });

  it('Summon familiar queues actionLoop with trait', () => {
    const tbl = freeActionTable('nf1', 'Natural Familiar');
    const chips = collectChips([{ ...NaturalFamiliar, _ownerInstanceId: 'nf1' }], 'card', tbl);
    const summon = chips.find((c) => c.name === 'Summon familiar');
    const m = activateChip(summon, tbl, makeChipState(), { selectedId: 'ground' });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Natural Familiar — Summon', trait: 'Presence' }),
      })
    );
  });

  it('Summon familiar sets naturalFamiliarActive in feature state', () => {
    const tbl = freeActionTable('nf1', 'Natural Familiar');
    const chips = collectChips([{ ...NaturalFamiliar, _ownerInstanceId: 'nf1' }], 'card', tbl);
    const summon = chips.find((c) => c.name === 'Summon familiar');
    const m = [
      ...activateChip(summon, tbl, makeChipState(), { selectedId: 'ground' }),
      ...applyTableMutations(tbl),
    ];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Natural Familiar',
          key: 'naturalFamiliarActive',
          value: true,
        }),
      })
    );
  });

  it('Summon ground spends 1 Hope; flying spends 2 Hope total', () => {
    const tbl = freeActionTable('nf1', 'Natural Familiar');
    const chips = collectChips([{ ...NaturalFamiliar, _ownerInstanceId: 'nf1' }], 'card', tbl);
    const summon = chips.find((c) => c.name === 'Summon familiar');
    activateChip(summon, tbl, makeChipState(), { selectedId: 'ground' });
    deductChipCosts(summon, tbl);
    let m = applyTableMutations(tbl);
    let hopeSum = m
      .filter((x) => x.type === 'spendHope')
      .reduce((s, x) => s + (x.payload?.amount ?? 0), 0);
    expect(hopeSum).toBe(1);

    const tbl2 = freeActionTable('nf2', 'Natural Familiar');
    const chips2 = collectChips([{ ...NaturalFamiliar, _ownerInstanceId: 'nf2' }], 'card', tbl2);
    const summon2 = chips2.find((c) => c.name === 'Summon familiar');
    activateChip(summon2, tbl2, makeChipState(), { selectedId: 'flying' });
    deductChipCosts(summon2, tbl2);
    m = applyTableMutations(tbl2);
    hopeSum = m.filter((x) => x.type === 'spendHope').reduce((s, x) => s + (x.payload?.amount ?? 0), 0);
    expect(hopeSum).toBe(2);
  });

  it('onReviewAction queues d6 when no map tokens (range band unknown)', () => {
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 2, damageType: 'physical' },
    ];
    const { mutations } = runReviewAction(
      { ...NaturalFamiliar, _ownerInstanceId: 'char-1' },
      {
        actionType: 'attack',
        action: {
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects,
        },
        featureState: {
          'Natural Familiar': { naturalFamiliarActive: true },
        },
        rolls: mockRoll({
          action: { isSuccess: true, hopeDie: { value: 8 }, fearDie: { value: 3 } },
          damage: { dice: [], statics: [] },
        }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Natural Familiar',
          die: 'd6',
        }),
      })
    );
  });

  it('onReviewAction does not add d6 when familiar is inactive', () => {
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 2, damageType: 'physical' },
    ];
    const { mutations } = runReviewAction(
      { ...NaturalFamiliar, _ownerInstanceId: 'char-1' },
      {
        actionType: 'attack',
        action: {
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects,
        },
        featureState: { 'Natural Familiar': { naturalFamiliarActive: false } },
        rolls: mockRoll({
          action: { isSuccess: true, hopeDie: { value: 8 }, fearDie: { value: 3 } },
          damage: { dice: [], statics: [] },
        }),
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollDie' && m.payload?.name === 'Natural Familiar')).toHaveLength(0);
  });

  it('onReviewAction does not add d6 at Far range for a ground familiar when tokens are set', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 80, tokenY: 0 });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 2, damageType: 'physical' },
    ];
    const { mutations } = runReviewAction(
      { ...NaturalFamiliar, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        actionType: 'attack',
        action: {
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects,
        },
        featureState: {
          'Natural Familiar': { naturalFamiliarActive: true, naturalFamiliarFlying: false },
        },
        rolls: mockRoll({
          action: { isSuccess: true, hopeDie: { value: 8 }, fearDie: { value: 3 } },
          damage: { dice: [], statics: [] },
        }),
      }
    );
    expect(mutations.filter((m) => m.type === 'addRollDie' && m.payload?.name === 'Natural Familiar')).toHaveLength(0);
  });

  it('onReviewAction adds d6 at Melee range when tokens are set (ground familiar)', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });
    const effects = [
      { type: 'damage', target: { instanceId: 'adv-1' }, amount: 2, damageType: 'physical' },
    ];
    const { mutations } = runReviewAction(
      { ...NaturalFamiliar, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        actionType: 'attack',
        action: {
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects,
        },
        featureState: {
          'Natural Familiar': { naturalFamiliarActive: true, naturalFamiliarFlying: false },
        },
        rolls: mockRoll({
          action: { isSuccess: true, hopeDie: { value: 8 }, fearDie: { value: 3 } },
          damage: { dice: [], statics: [] },
        }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Natural Familiar',
          die: 'd6',
        }),
      })
    );
  });

  it('onRest clears familiar feature state', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Natural Familiar',
        featureState: {
          'Natural Familiar': {
            naturalFamiliarActive: true,
            naturalFamiliarFlying: true,
            _summonHopeCost: 2,
          },
        },
        action: {
          type: 'longRest',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    NaturalFamiliar.hooks.onRest(tbl);
    const m = applyTableMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Natural Familiar',
          key: 'naturalFamiliarActive',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Natural Familiar',
          key: 'naturalFamiliarFlying',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Natural Familiar',
          key: '_summonHopeCost',
          value: undefined,
        }),
      })
    );
  });
});

describe('Sage Tier 1 — Corrosive Projectile', () => {
  it('card queues Spellcast actionLoop with trait', () => {
    const tbl = freeActionTable('cp1', 'Corrosive Projectile');
    const chips = collectChips([{ ...CorrosiveProjectile, _ownerInstanceId: 'cp1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Corrosive Projectile', trait: 'Presence' }),
      })
    );
  });
});

describe('Sage Tier 1 — Towering Stalk', () => {
  it('Conjure climbing stalk queues rest actionLoop with trait', () => {
    const tbl = freeActionTable('ts1', 'Towering Stalk');
    const chips = collectChips([{ ...ToweringStalk, _ownerInstanceId: 'ts1' }], 'card', tbl);
    const climb = chips.find((c) => c.name === 'Conjure climbing stalk');
    const m = activateChip(climb, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Towering Stalk — Climbing stalk', trait: 'Presence' }),
      })
    );
  });

  it('Erupting stalk queues attack actionLoop with trait', () => {
    const tbl = freeActionTable('ts2', 'Towering Stalk');
    const chips = collectChips([{ ...ToweringStalk, _ownerInstanceId: 'ts2' }], 'card', tbl);
    const erupt = chips.find((c) => c.name === 'Erupting stalk');
    const m = activateChip(erupt, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Towering Stalk — Erupting attack', trait: 'Presence' }),
      })
    );
  });
});

describe('Sage Tier 1 — Wild Fortress', () => {
  it('card queues Spellcast (13) actionLoop with trait', () => {
    const tbl = freeActionTable('wf1', 'Wild Fortress');
    const chips = collectChips([{ ...WildFortress, _ownerInstanceId: 'wf1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Wild Fortress',
          trait: 'Presence',
          difficulty: 13,
        }),
      })
    );
  });
});
