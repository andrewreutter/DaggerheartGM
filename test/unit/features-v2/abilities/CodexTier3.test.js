import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { dispatchSceneEndHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { BookOfYarrow } from '../../../../src/features-v2/abilities/Codex/BookOfYarrow.js';
import { TranscendentUnion } from '../../../../src/features-v2/abilities/Codex/TranscendentUnion.js';
import {
  mockCharacter,
  mockGameState,
  mockAdversary,
  mockRoll,
  mockAdversaryAttackRoll,
  runReviewAction,
  runReviewOutcome,
  runIntent,
} from '../helpers.js';

const yarrow = { ...BookOfYarrow, _ownerInstanceId: 'char-1' };

describe('Codex Tier 3 — Book of Yarrow', () => {
  it('exposes Timejammer and Magic Immunity card chips', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'knowledge' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Book of Yarrow',
        featureState: { 'Book of Yarrow': {} },
      })
    );
    const chips = collectChips([yarrow], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Timejammer', 'Magic Immunity']);
  });

  it('Timejammer sets awaiting flag and queues Spellcast (18) actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Yarrow',
      featureState: { 'Book of Yarrow': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([yarrow], 'card', tbl);
    const tj = chips.find((c) => c.name === 'Timejammer');
    expect(tj).toBeDefined();
    const m = activateChip(tj, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Book of Yarrow',
          key: 'yarrowAwaitingTimejammerSpellcast',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Yarrow — Timejammer',
          trait: 'Presence',
          difficulty: 18,
        }),
      })
    );
  });

  it('onReviewAction after successful Timejammer Spellcast activates time-stop state', () => {
    const { mutations } = runReviewAction(yarrow, {
      actionType: 'spellcast',
      featureState: {
        'Book of Yarrow': { yarrowAwaitingTimejammerSpellcast: true },
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
          featureKey: 'Book of Yarrow',
          key: 'yarrowAwaitingTimejammerSpellcast',
          value: false,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Book of Yarrow',
          key: 'yarrowTimejammerActive',
          value: true,
        }),
      })
    );
  });

  it('onReviewAction clears awaiting without activating time-stop when Spellcast fails', () => {
    const { mutations } = runReviewAction(yarrow, {
      actionType: 'spellcast',
      featureState: {
        'Book of Yarrow': { yarrowAwaitingTimejammerSpellcast: true },
      },
      rolls: mockRoll({ isSuccess: false }),
      activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary()],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'yarrowAwaitingTimejammerSpellcast',
          value: false,
        }),
      })
    );
    expect(
      mutations.some(
        (m) =>
          m.type === 'setFeatureState' &&
          m.payload?.key === 'yarrowTimejammerActive' &&
          m.payload?.value === true
      )
    ).toBe(false);
  });

  it('onIntent clears time-stop when making an attack that targets another creature', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runIntent(yarrow, {
      activeElements: [char, adv],
      featureState: { 'Book of Yarrow': { yarrowTimejammerActive: true } },
      rolls: mockRoll(),
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
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Book of Yarrow',
          key: 'yarrowTimejammerActive',
          value: false,
        }),
      })
    );
  });

  it('Magic Immunity sets flag and queues narration (5 Hope via chip cost)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Yarrow',
      featureState: { 'Book of Yarrow': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([yarrow], 'card', tbl);
    const mi = chips.find((c) => c.name === 'Magic Immunity');
    expect(mi?.hopeCost).toBe(5);
    const m = activateChip(mi, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'yarrowMagicImmunity',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Yarrow — Magic Immunity',
        }),
      })
    );
  });

  it('applyDeclarativeFeatures grants magic immunity only when feature state flag is set', () => {
    const off = mockCharacter({
      instanceId: 'c1',
      featureState: { 'Book of Yarrow': {} },
    });
    const { damageAffinities: offAff } = applyDeclarativeFeatures(
      [{ ...BookOfYarrow, _ownerInstanceId: 'c1' }],
      off,
      {}
    );
    expect(offAff.immunities).not.toContain('magic');

    const on = mockCharacter({
      instanceId: 'c1',
      featureState: { 'Book of Yarrow': { yarrowMagicImmunity: true } },
    });
    const { damageAffinities: onAff } = applyDeclarativeFeatures(
      [{ ...BookOfYarrow, _ownerInstanceId: 'c1' }],
      on,
      {}
    );
    expect(onAff.immunities).toContain('magic');
  });

  it('onRest clears Magic Immunity on short rest', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Yarrow',
      featureState: { 'Book of Yarrow': { yarrowMagicImmunity: true } },
      action: {
        type: 'shortRest',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    BookOfYarrow.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'yarrowMagicImmunity',
          value: false,
        }),
      })
    );
  });

  it('onSceneEnd clears active time-stop', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Yarrow',
      featureState: { 'Book of Yarrow': { yarrowTimejammerActive: true } },
      action: null,
      rolls: null,
    });
    const { mutations } = dispatchSceneEndHooks(gs, [yarrow]);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'yarrowTimejammerActive',
          value: false,
        }),
      })
    );
  });
});

const tu = { ...TranscendentUnion, _ownerInstanceId: 'char-1' };

describe('Codex Tier 3 — Transcendent Union', () => {
  it('exposes longRest cast chip with total 6 Hope (recall + spell)', () => {
    const c1 = mockCharacter({ instanceId: 'char-1', name: 'A', tokenX: 0, tokenY: 0 });
    const c2 = mockCharacter({ instanceId: 'char-2', name: 'B', tokenX: 5, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [c1, c2],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Transcendent Union',
        featureState: { 'Transcendent Union': {} },
      })
    );
    const cardChips = collectChips([tu], 'card', tbl);
    expect(cardChips.map((c) => c.name)).toEqual(['Transcendent Union']);
    expect(cardChips[0]?.hopeCost).toBe(6);
    expect(cardChips[0]?.frequency).toBe('longRest');
  });

  it('cast stores sorted union member ids and queues actionLoop', () => {
    const c1 = mockCharacter({ instanceId: 'char-1', name: 'Alpha', tokenX: 0, tokenY: 0 });
    const c2 = mockCharacter({ instanceId: 'char-2', name: 'Beta', tokenX: 5, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [c1, c2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Transcendent Union',
      featureState: { 'Transcendent Union': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([tu], 'card', tbl);
    const cast = chips.find((c) => c.name === 'Transcendent Union');
    expect(cast).toBeDefined();
    const m = activateChip(cast, tbl, makeChipState(), { selectedTargetIds: ['char-2', 'char-1'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Transcendent Union',
          key: 'transcendentUnionMemberIds',
          value: ['char-1', 'char-2'],
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Transcendent Union',
          description: expect.stringContaining('Alpha'),
        }),
      })
    );
  });

  it('onRest clears union member ids', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Transcendent Union',
      featureState: {
        'Transcendent Union': { transcendentUnionMemberIds: ['char-1', 'char-2'] },
      },
      action: {
        type: 'shortRest',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const restHook = unwrap(TranscendentUnion.hooks.onRest, tbl);
    restHook(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Transcendent Union',
          key: 'transcendentUnionMemberIds',
          value: null,
        }),
      })
    );
  });

  it('reviewOutcome chip reassigns pending HP mark to another union member', () => {
    const caster = mockCharacter({ instanceId: 'char-1', name: 'Caster', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'char-2', name: 'Ally', tokenX: 5, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const effects = [
      {
        stat: 'currentHP',
        amount: 2,
        target: ally,
      },
    ];
    const { chips } = runReviewOutcome(tu, {
      activeElements: [caster, ally, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Transcendent Union',
      featureState: {
        'Transcendent Union': { transcendentUnionMemberIds: ['char-1', 'char-2'] },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects,
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      actionType: 'attack',
    });
    const redirect = chips.find((c) => c.name === 'Transcendent Union — assign marks');
    expect(redirect).toBeDefined();
    const gs = mockGameState({
      activeElements: [caster, ally, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Transcendent Union',
      featureState: {
        'Transcendent Union': { transcendentUnionMemberIds: ['char-1', 'char-2'] },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects,
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    activateChip(redirect, tbl, makeChipState(), { selectedTargetIds: ['char-1'] });
    expect(effects[0].target.instanceId).toBe('char-1');
  });
});
