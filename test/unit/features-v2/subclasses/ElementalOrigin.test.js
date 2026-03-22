import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { Elementalist, NaturalEvasion, Transcendence } from '../../../../src/features-v2/subclasses/ElementalOrigin.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewAction,
} from '../helpers.js';

const EO_ROW = { sourceScopeKey: 'ElementalOrigin' };

describe('Elemental Origin — Elementalist', () => {
  const ann = { ...Elementalist, _ownerInstanceId: 's1', _sourceObject: EO_ROW };

  it('create chip stores chosen element in shared feature state', () => {
    const c = mockCharacter({ instanceId: 's1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [c],
        _ownerInstanceId: 's1',
        _featureKey: 'Elementalist',
        _activeFeature: ann,
        featureState: {},
        action: {
          type: 'free',
          actorInstanceId: 's1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([ann], 'create', tbl);
    expect(chips.length).toBeGreaterThan(0);
    const createChip = chips.find((ch) => ch.placements?.includes('create'));
    expect(createChip).toBeDefined();
    const fromUse = activateChip(createChip, tbl, makeChipState(), { selectedId: 'fire' });
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'ElementalOrigin',
          key: 'element',
          value: 'fire',
        }),
      })
    );
  });

  it('intent: +2 to action roll spends 1 Hope and queues addStatic on action', () => {
    const w = mockCharacter({ instanceId: 's1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [w, adv],
      _ownerInstanceId: 's1',
      _featureKey: 'Elementalist',
      _activeFeature: ann,
      action: mockAction({ type: 'attack', actorInstanceId: 's1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'intent', tbl);
    const plus2 = chips.find((c) => c.description?.includes('+2'));
    expect(plus2).toBeDefined();
    const fromUse = activateChip(plus2, tbl, makeChipState());
    deductChipCosts(plus2, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Elementalist',
          value: 2,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 's1', amount: 1 }),
      })
    );
  });
});

describe('Elemental Origin — Natural Evasion', () => {
  const ann = { ...NaturalEvasion, _ownerInstanceId: 'c1', _sourceObject: EO_ROW };

  it('reviewAction: on a successful hit, Stress + d6 temporary Evasion', () => {
    const w = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [w, adv],
        _ownerInstanceId: 'c1',
        _featureKey: 'Natural Evasion',
        _activeFeature: ann,
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['c1'],
          effects: [],
          appliedEffects: [],
        },
        rolls: { action: { isSuccess: true }, damage: {} },
      })
    );
    const chips = collectChips([ann], 'reviewAction', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({ instanceId: 'c1', stat: 'evasion' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'rollDie',
        payload: expect.objectContaining({ notation: 'd6' }),
      })
    );
  });

  it('does not offer the chip when the attack roll did not succeed', () => {
    const w = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(ann, {
      activeElements: [w, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['c1'],
        effects: [],
      },
      rolls: { action: { isSuccess: false }, damage: {} },
    });
    expect(chips.filter((c) => c.placements?.includes('reviewAction'))).toHaveLength(0);
  });
});

describe('Elemental Origin — Transcendence', () => {
  const ann = { ...Transcendence, _ownerInstanceId: 'c1', _sourceObject: EO_ROW };

  it('passiveStatMods apply Severe +4 and +2 Evasion when active in feature state', () => {
    const char = {
      ...mockCharacter({
        instanceId: 'c1',
        armorThresholds: { major: 4, severe: 7 },
        evasion: 10,
      }),
      featureState: {
        ElementalOrigin: {
          transcendence: { active: true, severe4: true, evasion2: true, prof1: false, traitKey: null },
        },
      },
    };
    const { stats } = applyDeclarativeFeatures([Transcendence], char, {
      featureState: char.featureState,
    });
    expect(stats.severeThreshold).toBe(11);
    expect(stats.evasion).toBe(12);
  });

  it('card multiSelect stores transcendence payload on use', () => {
    const c = mockCharacter({ instanceId: 'c1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [c],
        _ownerInstanceId: 'c1',
        _featureKey: 'Transcendence',
        _activeFeature: ann,
        featureState: {},
        action: {
          type: 'free',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([ann], 'card', tbl);
    const card = chips.find((ch) => ch.frequency === 'longRest');
    expect(card).toBeDefined();
    const fromUse = activateChip(card, tbl, makeChipState(), {
      selectedIds: ['severe4', 'traitInstinct'],
    });
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'ElementalOrigin',
          key: 'transcendence',
          value: expect.objectContaining({
            active: true,
            severe4: true,
            traitKey: 'instinct',
          }),
        }),
      })
    );
  });

  it('hooks.onRest clears transcendence', () => {
    const c = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [c],
      _ownerInstanceId: 'c1',
      _featureKey: 'Transcendence',
      _activeFeature: ann,
      featureState: {
        ElementalOrigin: {
          transcendence: { active: true, severe4: true, evasion2: false, prof1: false, traitKey: null },
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
    });
    const tbl = buildTableSnapshot(gs);
    Transcendence.hooks.onRest(tbl);
    expect(applyMutations(tbl)).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'ElementalOrigin',
          key: 'transcendence',
          value: null,
        }),
      })
    );
  });

  it('Proficiency benefit adds +1 to damage during Intent when active', () => {
    const w = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [w, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Transcendence',
      _activeFeature: ann,
      featureState: {
        ElementalOrigin: {
          transcendence: { active: true, prof1: true, severe4: false, evasion2: false, traitKey: null },
        },
      },
      action: mockAction({ type: 'attack', actorInstanceId: 'c1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const hookFn = unwrap(Transcendence.hooks.onIntent, tbl);
    hookFn(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', value: 1 }),
      })
    );
  });
});
