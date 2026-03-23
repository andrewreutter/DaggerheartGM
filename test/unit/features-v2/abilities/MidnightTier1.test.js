import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { unwrapAll } from '../../../../src/features-v2/engine/when.js';
import { PickAndPull } from '../../../../src/features-v2/abilities/Midnight/PickAndPull.js';
import { RainOfBlades } from '../../../../src/features-v2/abilities/Midnight/RainOfBlades.js';
import { UncannyDisguise } from '../../../../src/features-v2/abilities/Midnight/UncannyDisguise.js';
import { MidnightSpirit } from '../../../../src/features-v2/abilities/Midnight/MidnightSpirit.js';
import { Shadowbind } from '../../../../src/features-v2/abilities/Midnight/Shadowbind.js';
import { Chokehold } from '../../../../src/features-v2/abilities/Midnight/Chokehold.js';
import { VeilOfNight } from '../../../../src/features-v2/abilities/Midnight/VeilOfNight.js';
import { GlyphOfNightfall } from '../../../../src/features-v2/abilities/Midnight/GlyphOfNightfall.js';
import { Hush } from '../../../../src/features-v2/abilities/Midnight/Hush.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runResolve, runReviewAction, mockTable } from '../helpers.js';

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

describe('Midnight Tier 1 — Pick and Pull', () => {
  it('declares advantage on locks, traps, and stealing', () => {
    const table = mockTable();
    const resolved = unwrapAll(PickAndPull.advantageTriggers, table);
    expect(resolved.some((s) => String(s).includes('nonmagical locks'))).toBe(true);
  });

  it('accumulates advantageTriggers via applyDeclarativeFeatures', () => {
    const char = { traits: {} };
    const { advantageTriggers } = applyDeclarativeFeatures([{ ...PickAndPull, _ownerInstanceId: 'c1' }], char, {});
    expect(advantageTriggers.some((t) => String(t).includes('steal'))).toBe(true);
  });
});

describe('Midnight Tier 1 — Rain of Blades', () => {
  it('card spends 1 Hope and queues actionLoop', () => {
    const tbl = freeActionTable('r1', 'Rain of Blades');
    const chips = collectChips([{ ...RainOfBlades, _ownerInstanceId: 'r1' }], 'card', tbl);
    expect(chips[0]?.hopeCost).toBe(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'r1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Rain of Blades', trait: 'Presence' }),
      })
    );
  });
});

describe('Midnight Tier 1 — Uncanny Disguise', () => {
  it('card marks Stress and seeds Spellcast tokens via setFeatureState', () => {
    const tbl = freeActionTable('u1', 'Uncanny Disguise');
    const chips = collectChips([{ ...UncannyDisguise, _ownerInstanceId: 'u1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'u1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Uncanny Disguise',
          key: 'uncannyDisguiseTokens',
          value: 2,
        }),
      })
    );
  });

  it('advantage trigger applies only while tokens remain and action trait is Presence', () => {
    const withTokensPresence = mockTable({
      _ownerInstanceId: 'char-1',
      _featureKey: 'Uncanny Disguise',
      featureState: { 'Uncanny Disguise': { uncannyDisguiseTokens: 2 } },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'presence',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const withTokensWrongTrait = mockTable({
      _ownerInstanceId: 'char-1',
      _featureKey: 'Uncanny Disguise',
      featureState: { 'Uncanny Disguise': { uncannyDisguiseTokens: 2 } },
    });
    const off = mockTable({
      _ownerInstanceId: 'char-1',
      _featureKey: 'Uncanny Disguise',
      featureState: { 'Uncanny Disguise': { uncannyDisguiseTokens: 0 } },
    });
    expect(unwrapAll(UncannyDisguise.advantageTriggers, withTokensPresence).length).toBeGreaterThan(0);
    expect(unwrapAll(UncannyDisguise.advantageTriggers, withTokensWrongTrait)).toEqual([]);
    expect(unwrapAll(UncannyDisguise.advantageTriggers, off)).toEqual([]);
  });

  it('onResolve spends one disguise token after an action resolves', () => {
    const { mutations } = runResolve(UncannyDisguise, {
      featureState: { 'Uncanny Disguise': { uncannyDisguiseTokens: 2 } },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Uncanny Disguise',
          key: 'uncannyDisguiseTokens',
          value: 1,
        }),
      })
    );
  });

  it('onResolve does nothing when no tokens', () => {
    const { mutations } = runResolve(UncannyDisguise, {
      featureState: { 'Uncanny Disguise': { uncannyDisguiseTokens: 0 } },
    });
    expect(mutations.filter((m) => m.type === 'setFeatureState')).toEqual([]);
  });
});

describe('Midnight Tier 1 — Midnight Spirit', () => {
  it('Summon spends Hope and sets spirit flag', () => {
    const tbl = freeActionTable('m1', 'Midnight Spirit');
    const chips = collectChips([{ ...MidnightSpirit, _ownerInstanceId: 'm1' }], 'card', tbl);
    const summon = chips.find((c) => c.name === 'Midnight Spirit — Summon');
    const m = activateChip(summon, tbl, makeChipState());
    deductChipCosts(summon, tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'm1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Midnight Spirit',
          key: 'midnightSpiritActive',
          value: true,
        }),
      })
    );
  });

  it('Strike queues actionLoop and clears spirit flag', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'm2', spellcastTrait: 'presence', traits: { presence: 2 } })],
        _ownerInstanceId: 'm2',
        _featureKey: 'Midnight Spirit',
        featureState: { 'Midnight Spirit': { midnightSpiritActive: true } },
        action: {
          type: 'free',
          actorInstanceId: 'm2',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...MidnightSpirit, _ownerInstanceId: 'm2' }], 'card', tbl);
    const strike = chips.find((c) => c.name === 'Midnight Spirit — Strike');
    expect(strike.disabled).toBe(false);
    const m = activateChip(strike, tbl, makeChipState());
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Midnight Spirit — Strike',
          trait: 'Presence' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Midnight Spirit',
          key: 'midnightSpiritActive',
          value: false,
        }),
      })
    );
  });

  it('Strike card is disabled until a spirit has been summoned', () => {
    const off = freeActionTable('m3', 'Midnight Spirit');
    const chipsOff = collectChips([{ ...MidnightSpirit, _ownerInstanceId: 'm3' }], 'card', off);
    const strikeOff = chipsOff.find((c) => c.name === 'Midnight Spirit — Strike');
    expect(strikeOff.disabled).toBe(true);

    const on = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'm3', spellcastTrait: 'presence', traits: { presence: 2 } })],
        _ownerInstanceId: 'm3',
        _featureKey: 'Midnight Spirit',
        featureState: { 'Midnight Spirit': { midnightSpiritActive: true } },
        action: {
          type: 'free',
          actorInstanceId: 'm3',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chipsOn = collectChips([{ ...MidnightSpirit, _ownerInstanceId: 'm3' }], 'card', on);
    const strikeOn = chipsOn.find((c) => c.name === 'Midnight Spirit — Strike');
    expect(strikeOn.disabled).toBe(false);
  });

  it('onRest clears an active summon (until your next rest)', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Midnight Spirit',
      featureState: { 'Midnight Spirit': { midnightSpiritActive: true } },
      action: {
        type: 'shortRest',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    MidnightSpirit.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Midnight Spirit',
          key: 'midnightSpiritActive',
          value: false,
        }),
      })
    );
  });
});

describe('Midnight Tier 1 — Shadowbind', () => {
  it('card queues Spellcast actionLoop', () => {
    const tbl = freeActionTable('s1', 'Shadowbind');
    const chips = collectChips([{ ...Shadowbind, _ownerInstanceId: 's1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Shadowbind', trait: 'Presence' }),
      })
    );
  });
});

describe('Midnight Tier 1 — Chokehold', () => {
  it('card marks Stress and queues actionLoop', () => {
    const tbl = freeActionTable('ch1', 'Chokehold');
    const chips = collectChips([{ ...Chokehold, _ownerInstanceId: 'ch1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'ch1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Chokehold' }),
      })
    );
  });

  it('does not register intent-placement chips', () => {
    const tbl = freeActionTable('ch2', 'Chokehold');
    const intent = collectChips([{ ...Chokehold, _ownerInstanceId: 'ch2' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});

describe('Midnight Tier 1 — Veil of Night', () => {
  it('card queues Spellcast (13) actionLoop', () => {
    const tbl = freeActionTable('vn1', 'Veil of Night');
    const chips = collectChips([{ ...VeilOfNight, _ownerInstanceId: 'vn1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Veil of Night',
          trait: 'Presence',
          difficulty: 13,
        }),
      })
    );
  });

  it('does not register intent-placement chips', () => {
    const tbl = freeActionTable('vn2', 'Veil of Night');
    const intent = collectChips([{ ...VeilOfNight, _ownerInstanceId: 'vn2' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});

describe('Midnight — Glyph of Nightfall', () => {
  it('card with target queues Spellcast vs Difficulty and awaiting state', () => {
    const caster = mockCharacter({
      instanceId: 'g1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2, knowledge: 2 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0, difficulty: 14 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Glyph of Nightfall',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'g1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GlyphOfNightfall, _ownerInstanceId: 'g1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Glyph of Nightfall',
          key: 'glyphOfNightfallAwaiting',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Glyph of Nightfall',
          trait: 'Presence',
          difficulty: 14,
        }),
      })
    );
    expect(
      m.find((x) => x.type === 'actionLoop')?.payload?.description
    ).toMatch(/reduce their Difficulty by 2/);
  });

  it('onReviewAction after successful Spellcast sets pending Hope for glyph rider', () => {
    const { mutations } = runReviewAction(GlyphOfNightfall, {
      actionType: 'spellcast',
      featureState: {
        'Glyph of Nightfall': { glyphOfNightfallAwaiting: true },
      },
      rolls: mockRoll({ isSuccess: true }),
      activeElements: [
        mockCharacter({
          instanceId: 'char-1',
          spellcastTrait: 'presence',
          traits: { presence: 2 },
        }),
        mockAdversary(),
      ],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Glyph of Nightfall',
          key: 'glyphOfNightfallPendingHope',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Glyph of Nightfall',
          key: 'glyphOfNightfallAwaiting',
          value: false,
        }),
      })
    );
  });

  it('onReviewAction clears pending state when Spellcast fails', () => {
    const { mutations } = runReviewAction(GlyphOfNightfall, {
      actionType: 'spellcast',
      featureState: {
        'Glyph of Nightfall': {
          glyphOfNightfallAwaiting: true,
          glyphOfNightfallTargetId: 'adv-1',
        },
      },
      rolls: mockRoll({ isSuccess: false }),
      activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary({ instanceId: 'adv-1' })],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Glyph of Nightfall',
          key: 'glyphOfNightfallTargetId',
          value: null,
        }),
      })
    );
  });

  it('reviewAction chip spends 1 Hope and applies Difficulty penalty to target adversary', () => {
    const caster = mockCharacter({
      instanceId: 'g1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2, knowledge: 3 },
      hope: 5,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0, difficulty: 14 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Glyph of Nightfall',
      featureState: {
        'Glyph of Nightfall': {
          glyphOfNightfallPendingHope: true,
          glyphOfNightfallTargetId: 'adv-1',
        },
      },
      action: {
        type: 'spellcast',
        actorInstanceId: 'g1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GlyphOfNightfall, _ownerInstanceId: 'g1' }], 'reviewAction', tbl);
    const applyChip = chips.find((c) => c.name === 'Glyph of Nightfall — expose weak points');
    expect(applyChip?.hopeCost).toBe(1);
    const m = activateChip(applyChip, tbl, makeChipState());
    deductChipCosts(applyChip, tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'runtimeStatMod',
        payload: { instanceId: 'adv-1', stat: 'difficulty', delta: -3 },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'g1', amount: 1 }),
      })
    );
  });
});

describe('Midnight — Hush', () => {
  it('card with target queues Spellcast vs Difficulty and awaiting state', () => {
    const caster = mockCharacter({
      instanceId: 'h1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0, difficulty: 12 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'h1',
      _featureKey: 'Hush',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'h1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Hush, _ownerInstanceId: 'h1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Hush',
          key: 'hushAwaiting',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Hush',
          trait: 'Presence',
          difficulty: 12,
        }),
      })
    );
    expect(m.find((x) => x.type === 'actionLoop')?.payload?.description).toMatch(/Very Close-radius aura/);
  });

  it('onReviewAction after successful Spellcast sets pending Hope', () => {
    const { mutations } = runReviewAction(Hush, {
      actionType: 'spellcast',
      featureState: {
        Hush: { hushAwaiting: true },
      },
      rolls: mockRoll({ isSuccess: true }),
      activeElements: [
        mockCharacter({
          instanceId: 'char-1',
          spellcastTrait: 'presence',
          traits: { presence: 2 },
        }),
        mockAdversary(),
      ],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Hush',
          key: 'hushPendingHope',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Hush',
          key: 'hushAwaiting',
          value: false,
        }),
      })
    );
  });

  it('onReviewAction clears pending state when Spellcast fails', () => {
    const { mutations } = runReviewAction(Hush, {
      actionType: 'spellcast',
      featureState: {
        Hush: {
          hushAwaiting: true,
          hushTargetId: 'adv-1',
        },
      },
      rolls: mockRoll({ isSuccess: false }),
      activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary({ instanceId: 'adv-1' })],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Hush',
          key: 'hushTargetId',
          value: null,
        }),
      })
    );
  });

  it('reviewAction chip spends 1 Hope and adds Silenced to anchor', () => {
    const caster = mockCharacter({
      instanceId: 'h1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
      hope: 4,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0, difficulty: 12 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'h1',
      _featureKey: 'Hush',
      featureState: {
        Hush: {
          hushPendingHope: true,
          hushTargetId: 'adv-1',
        },
      },
      action: {
        type: 'spellcast',
        actorInstanceId: 'h1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Hush, _ownerInstanceId: 'h1' }], 'reviewAction', tbl);
    const applyChip = chips.find((c) => c.name === 'Hush — conjure silence');
    expect(applyChip?.hopeCost).toBe(1);
    const m = activateChip(applyChip, tbl, makeChipState());
    deductChipCosts(applyChip, tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'adv-1', condition: 'Silenced' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'h1', amount: 1 }),
      })
    );
  });
});
