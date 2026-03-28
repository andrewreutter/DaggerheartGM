import { describe, it, expect } from 'vitest';
import {
  RoguesDodge,
  Cloaked,
  SneakAttack,
  resolveRoguesDodgePassiveEvasion,
} from '../../../../src/features-v2/classes/Rogue.js';
import { activateChip, collectChips, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  mockAction,
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  runIntent,
  runResolve,
  runReviewAction,
} from '../helpers.js';
import { SRD_CLASS_ROGUE_SCOPE_KEY } from '../../../../src/features-v2/engine/feature-scope-keys.js';

const ROGUE_DODGE_KEY = "Rogue's Dodge";

describe("Rogue's Dodge", () => {
  it('card Use only sets roguesDodgeActive (evasion +2 comes from passiveStatMods when state is on)', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [rogue, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: ROGUE_DODGE_KEY,
        _activeFeature: {
          ...RoguesDodge,
          _ownerInstanceId: 'char-1',
          _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY,
        },
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
        featureState: {},
      })
    );
    const chips = collectChips([{ ...RoguesDodge, _ownerInstanceId: 'char-1', _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations.filter((m) => m.type === 'appendActiveModifier')).toHaveLength(0);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: SRD_CLASS_ROGUE_SCOPE_KEY,
          key: 'roguesDodgeActive',
          value: true,
        }),
      })
    );
  });

  it('applyDeclarativeFeatures adds +2 evasion while roguesDodgeActive', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', evasion: 10 });
    const { stats } = applyDeclarativeFeatures(
      [{ ...RoguesDodge, _ownerInstanceId: 'char-1', _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY }],
      {
        ...rogue,
        featureState: { [SRD_CLASS_ROGUE_SCOPE_KEY]: { roguesDodgeActive: true } },
      },
      {},
      null
    );
    expect(stats.evasion).toBe(12);
  });

  it('resolveRoguesDodgePassiveEvasion matches passiveStatMods', () => {
    expect(
      resolveRoguesDodgePassiveEvasion({
        instanceId: 'c1',
        featureState: { [SRD_CLASS_ROGUE_SCOPE_KEY]: { roguesDodgeActive: true } },
      })
    ).toBe(2);
    expect(resolveRoguesDodgePassiveEvasion({ instanceId: 'c1', featureState: {} })).toBe(0);
  });

  it('does not queue addTemporaryStatMod on intent (evasion comes from card Use only)', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...RoguesDodge, _ownerInstanceId: 'char-1', _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY },
      {
        activeElements: [rogue, adv],
        featureState: { [SRD_CLASS_ROGUE_SCOPE_KEY]: { roguesDodgeActive: true } },
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addTemporaryStatMod')).toHaveLength(0);
  });

  it('clears roguesDodgeActive on resolve when the attack against you succeeds', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(
      { ...RoguesDodge, _ownerInstanceId: 'char-1', _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY },
      {
        activeElements: [rogue, adv],
        featureState: { [SRD_CLASS_ROGUE_SCOPE_KEY]: { roguesDodgeActive: true } },
        rolls: mockRoll({ action: { isSuccess: true } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: SRD_CLASS_ROGUE_SCOPE_KEY,
          key: 'roguesDodgeActive',
          value: false,
        }),
      })
    );
    expect(mutations.filter((m) => m.type === 'removeActiveModifier')).toHaveLength(0);
  });

  it('does not clear roguesDodgeActive when the attack misses', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runResolve(
      { ...RoguesDodge, _ownerInstanceId: 'char-1', _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY },
      {
        activeElements: [rogue, adv],
        featureState: { [SRD_CLASS_ROGUE_SCOPE_KEY]: { roguesDodgeActive: true } },
        rolls: mockRoll({ action: { isSuccess: false } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(
      mutations.filter(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.key === 'roguesDodgeActive' &&
          m.payload?.value === false
      )
    ).toHaveLength(0);
    expect(mutations.filter((m) => m.type === 'removeActiveModifier')).toHaveLength(0);
  });

  it('clears roguesDodgeActive on a short rest', () => {
    const rogue = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runIntent(
      { ...RoguesDodge, _ownerInstanceId: 'char-1', _sourceScopeKey: SRD_CLASS_ROGUE_SCOPE_KEY },
      {
        activeElements: [rogue, adv],
        featureState: { [SRD_CLASS_ROGUE_SCOPE_KEY]: { roguesDodgeActive: true } },
        actionType: 'shortRest',
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: SRD_CLASS_ROGUE_SCOPE_KEY,
          key: 'roguesDodgeActive',
          value: false,
        }),
      })
    );
    expect(mutations.filter((m) => m.type === 'removeActiveModifier')).toHaveLength(0);
  });
});

describe('Cloaked', () => {
  it('card chip queues addCondition Cloaked', () => {
    const rogue = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [rogue, adv],
        _ownerInstanceId: 'c1',
        _featureKey: 'Cloaked',
        _activeFeature: { ...Cloaked, _ownerInstanceId: 'c1' },
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
    const chips = collectChips([{ ...Cloaked, _ownerInstanceId: 'c1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'c1', condition: 'Cloaked' },
      })
    );
  });
});

describe('Sneak Attack', () => {
  it('adds tier d6 to damage on a successful attack while Cloaked', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', level: 5, conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({
          action: { isSuccess: true },
          damageDice: [{ name: 'weapon', die: 'd6', value: 3 }],
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );
    const sa = chips.find((c) => c.name === 'Sneak Attack');
    expect(sa).toBeDefined();
    expect(sa.placements).toContain('reviewAction');

    const gs = mockGameState({
      activeElements: [rogue, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Sneak Attack',
      _activeFeature: { ...SneakAttack, _ownerInstanceId: 'char-1' },
      rolls: mockRoll({
        action: { isSuccess: true },
        damageDice: [{ name: 'weapon', die: 'd6', value: 3 }],
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
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(sa, tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Sneak Attack',
          die: '3d6',
        }),
      })
    );
  });

  it('does not add dice when not Cloaked and no ally is in melee of the target', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 30, tokenY: 0 });

    const { chips } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({ action: { isSuccess: true } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(chips.filter((c) => c.name === 'Sneak Attack')).toHaveLength(0);
  });

  it('adds dice when an ally is in melee of the target (without Cloaked)', () => {
    const rogue = mockCharacter({ instanceId: 'r1', tokenX: 40, tokenY: 0, level: 2 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 8, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });

    const { chips } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'r1' },
      {
        activeElements: [rogue, ally, adv],
        rolls: mockRoll({
          action: { isSuccess: true },
          damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
        }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'r1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );
    const sa = chips.find((c) => c.name === 'Sneak Attack');
    expect(sa).toBeDefined();

    const gs = mockGameState({
      activeElements: [rogue, ally, adv],
      _ownerInstanceId: 'r1',
      _featureKey: 'Sneak Attack',
      _activeFeature: { ...SneakAttack, _ownerInstanceId: 'r1' },
      rolls: mockRoll({
        action: { isSuccess: true },
        damageDice: [{ name: 'weapon', die: 'd8', value: 4 }],
      }),
      action: {
        type: 'attack',
        actorInstanceId: 'r1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(sa, tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Sneak Attack',
          die: '2d6',
        }),
      })
    );
  });

  it('does not add dice on a failed attack', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({ action: { isSuccess: false } }),
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(chips.filter((c) => c.name === 'Sneak Attack')).toHaveLength(0);
  });

  it('does not fire on a successful trait roll (CONV-025)', () => {
    const rogue = mockCharacter({ instanceId: 'char-1', conditions: ['Cloaked'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runReviewAction(
      { ...SneakAttack, _ownerInstanceId: 'char-1' },
      {
        activeElements: [rogue, adv],
        rolls: mockRoll({ action: { isSuccess: true } }),
        action: mockAction({
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
        }),
      }
    );

    expect(chips.filter((c) => c.name === 'Sneak Attack')).toHaveLength(0);
  });
});
