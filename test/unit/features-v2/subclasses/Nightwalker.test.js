import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  ShadowStepper,
  DarkCloud,
  Adrenaline,
  FleetingShadow,
  VanishingAct,
} from '../../../../src/features-v2/subclasses/Nightwalker.js';
import { activateChip, collectChips, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  mockCharacter,
  mockAdversary,
  mockAction,
  mockRoll,
  mockGameState,
  mockChipState,
  runReviewAction,
  runResolve,
} from '../helpers.js';

const vanishingActWithScope = {
  ...VanishingAct,
  _sourceScopeKey: 'Nightwalker',
};

describe('Nightwalker — Fleeting Shadow', () => {
  it('adds +1 Evasion via passiveStatMods', () => {
    const char = mockCharacter({ instanceId: 'n1', evasion: 12 });
    const { stats } = applyDeclarativeFeatures(
      [{ ...FleetingShadow, _ownerInstanceId: 'n1' }],
      char,
      {}
    );
    expect(stats.evasion).toBe(13);
  });
});

describe('Nightwalker — Adrenaline', () => {
  it('adds level to damage roll statics on a successful attack while Vulnerable', () => {
    const char = mockCharacter({
      instanceId: 'n1',
      level: 4,
      conditions: ['Vulnerable'],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...Adrenaline, _ownerInstanceId: 'n1' },
      {
        activeElements: [char, adv],
        rolls: mockRoll({
          action: { isSuccess: true },
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'n1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Adrenaline',
          value: 4,
        }),
      })
    );
  });

  it('does not add Adrenaline when not Vulnerable', () => {
    const char = mockCharacter({ instanceId: 'n1', level: 4, conditions: [] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...Adrenaline, _ownerInstanceId: 'n1' },
      {
        activeElements: [char, adv],
        rolls: mockRoll({
          action: { isSuccess: true },
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'n1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.payload?.name === 'Adrenaline')).toHaveLength(0);
  });

  it('does not add Adrenaline on a failed attack', () => {
    const char = mockCharacter({
      instanceId: 'n1',
      level: 4,
      conditions: ['Vulnerable'],
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...Adrenaline, _ownerInstanceId: 'n1' },
      {
        activeElements: [char, adv],
        rolls: mockRoll({
          action: { isSuccess: false },
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'n1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.payload?.name === 'Adrenaline')).toHaveLength(0);
  });
});

describe('Nightwalker — Shadow Stepper', () => {
  it('card Stress + actionLoop (Far) + Cloaked when Fleeting Shadow not merged', () => {
    const char = mockCharacter({ instanceId: 'n1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'n1',
        _featureKey: 'Shadow Stepper',
        action: {
          type: 'free',
          actorInstanceId: 'n1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ShadowStepper, _ownerInstanceId: 'n1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, mockChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'n1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Shadow Stepper',
          description: expect.stringContaining('Far range'),
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ condition: 'Cloaked' }),
      })
    );
  });

  it('actionLoop uses Very Far when shadowStepperVeryFarUnlocked is set (Fleeting Shadow)', () => {
    const char = mockCharacter({ instanceId: 'n1', shadowStepperVeryFarUnlocked: true });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'n1',
        _featureKey: 'Shadow Stepper',
        action: {
          type: 'free',
          actorInstanceId: 'n1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ShadowStepper, _ownerInstanceId: 'n1' }], 'card', tbl);
    const fromUse = activateChip(chips[0], tbl, mockChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Shadow Stepper',
          description: expect.stringContaining('Very Far range'),
        }),
      })
    );
  });
});

describe('Nightwalker — Dark Cloud', () => {
  it('card queues Spellcast (Finesse) vs 15 via actionLoop', () => {
    const char = mockCharacter({ instanceId: 'n1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'n1',
        _featureKey: 'Dark Cloud',
        action: {
          type: 'free',
          actorInstanceId: 'n1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...DarkCloud, _ownerInstanceId: 'n1' }], 'card', tbl);
    const fromUse = activateChip(chips[0], tbl, mockChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    const al = mutations.find((m) => m.type === 'actionLoop');
    expect(al?.payload?.trait).toBe('Finesse');
    expect(al?.payload?.difficulty).toBe(15);
  });
});

describe('Nightwalker — Vanishing Act', () => {
  it('Stress + Cloaked + clears Restrained + tracks featureState', () => {
    const char = mockCharacter({ instanceId: 'n1', conditions: ['Restrained'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'n1',
        _featureKey: 'Vanishing Act',
        _activeFeature: { ...vanishingActWithScope, _ownerInstanceId: 'n1' },
        featureState: {},
        action: {
          type: 'free',
          actorInstanceId: 'n1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...vanishingActWithScope, _ownerInstanceId: 'n1' }], 'card', tbl);
    const fromUse = activateChip(chips[0], tbl, mockChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ condition: 'Restrained' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ condition: 'Cloaked' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Nightwalker',
          key: 'vanishingActCloak',
          value: true,
        }),
      })
    );
  });

  it('onResolve drops Cloaked when Fear dominates a duality roll', () => {
    const char = mockCharacter({ instanceId: 'n1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runResolve(
      { ...vanishingActWithScope, _ownerInstanceId: 'n1' },
      {
        activeElements: [char, adv],
        rolls: {
          action: {
            hopeDie: { value: 2 },
            fearDie: { value: 11 },
            isSuccess: true,
          },
          damage: mockRoll().damage,
        },
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'n1',
          targetInstanceIds: ['adv-1'],
        }),
        featureState: { Nightwalker: { vanishingActCloak: true } },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ condition: 'Cloaked' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'vanishingActCloak', value: false }),
      })
    );
  });

  it('onResolve does not clear when Hope dominates', () => {
    const char = mockCharacter({ instanceId: 'n1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runResolve(
      { ...vanishingActWithScope, _ownerInstanceId: 'n1' },
      {
        activeElements: [char, adv],
        rolls: {
          action: {
            hopeDie: { value: 11 },
            fearDie: { value: 2 },
            isSuccess: true,
          },
          damage: mockRoll().damage,
        },
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'n1',
          targetInstanceIds: ['adv-1'],
        }),
        featureState: { Nightwalker: { vanishingActCloak: true } },
      }
    );
    expect(mutations.filter((m) => m.type === 'removeCondition')).toHaveLength(0);
  });

  it('onRest clears vanishing-act Cloaked', () => {
    const char = mockCharacter({ instanceId: 'n1', conditions: ['Cloaked'] });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'n1',
      _featureKey: 'Vanishing Act',
      _activeFeature: { ...vanishingActWithScope, _ownerInstanceId: 'n1' },
      featureState: { Nightwalker: { vanishingActCloak: true } },
      action: {
        type: 'longRest',
        actorInstanceId: 'n1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    VanishingAct.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({ key: 'vanishingActCloak', value: false }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ condition: 'Cloaked' }),
      })
    );
  });
});
