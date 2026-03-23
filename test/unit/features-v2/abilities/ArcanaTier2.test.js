import { describe, it, expect } from 'vitest';
import { createActionLoop, dispatchTokenMoveHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { ArcaneReflection } from '../../../../src/features-v2/abilities/Arcana/ArcaneReflection.js';
import { ArcanaTouched } from '../../../../src/features-v2/abilities/Arcana/ArcanaTouched.js';
import { ChainLightning } from '../../../../src/features-v2/abilities/Arcana/ChainLightning.js';
import { Earthquake } from '../../../../src/features-v2/abilities/Arcana/Earthquake.js';
import { BlinkOut } from '../../../../src/features-v2/abilities/Arcana/BlinkOut.js';
import { Premonition } from '../../../../src/features-v2/abilities/Arcana/Premonition.js';
import { RiftWalker } from '../../../../src/features-v2/abilities/Arcana/RiftWalker.js';
import { Telekinesis } from '../../../../src/features-v2/abilities/Arcana/Telekinesis.js';
import { CloakingBlast } from '../../../../src/features-v2/abilities/Arcana/CloakingBlast.js';
import { PreservationBlast } from '../../../../src/features-v2/abilities/Arcana/PreservationBlast.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  mockAction,
  runIntent,
  runReviewAction,
} from '../helpers.js';

const fourArcana = () =>
  [1, 2, 3, 4].map((i) => ({ id: `card-${i}`, domain: 'arcana' }));

describe('Arcana Tier 2 — Arcana-Touched', () => {
  it('adds +1 to the spellcast trait when 4+ Arcana cards are in domainLoadout', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'presence',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
      domainLoadout: fourArcana(),
    });
    const { stats } = applyDeclarativeFeatures([{ ...ArcanaTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.presence).toBe(3);
    expect(stats.agility).toBe(0);
  });

  it('does not add trait bonus when fewer than 4 Arcana domain cards', () => {
    const char = mockCharacter({
      instanceId: 'c1',
      spellcastTrait: 'presence',
      traits: { agility: 0, strength: 0, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
      domainLoadout: [{ id: 'a', domain: 'arcana' }, { id: 'b', domain: 'arcana' }],
    });
    const { stats } = applyDeclarativeFeatures([{ ...ArcanaTouched, _ownerInstanceId: 'c1' }], char, {});
    expect(stats.presence).toBe(2);
  });

  it('reviewAction chip swaps Hope/Fear when Arcana-Touched is active', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourArcana(),
    });
    const { chips } = runReviewAction(
      { ...ArcanaTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
      }
    );
    const swap = chips.find((c) => c.name === 'Arcana-Touched — Swap Duality');
    expect(swap).toBeDefined();

    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Arcana-Touched',
      rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
    });
    const tbl = buildTableSnapshot(gs);
    const m = activateChip(swap, tbl, makeChipState());
    deductChipCosts(swap, tbl);
    const m2 = applyMutations(tbl);
    const mutations = [...m, ...m2];
    expect(mutations).toContainEqual(
      expect.objectContaining({ type: 'swapHopeFearDice', payload: expect.objectContaining({ rollKey: 'action' }) })
    );
  });

  it('does not offer swap chip when fewer than 4 Arcana cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'x', domain: 'arcana' }],
    });
    const { chips } = runReviewAction(
      { ...ArcanaTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name === 'Arcana-Touched — Swap Duality')).toHaveLength(0);
  });
});

describe('Arcana Tier 2 — Earthquake', () => {
  it('card chip has recall Hope cost 2 and frequency rest', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const chips = collectChips(
      [{ ...Earthquake, _ownerInstanceId: 'char-1' }],
      'card',
      buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }))
    );
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(2);
    expect(chips[0].frequency).toBe('rest');
  });

  it('card chip queues actionLoop on use with Spellcast (16)', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Earthquake',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Earthquake, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Earthquake',
          trait: 'Presence',
          difficulty: 16,
          description: expect.stringMatching(/Spend 2 Hope \(recall\).*Very Far.*Reaction Roll \(18\)/s),
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Preservation Blast', () => {
  it('activateChip queues Spellcast actionLoop (trait, Melee targets, Far push, d8+3 magic)', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Preservation Blast',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...PreservationBlast, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Preservation Blast',
          trait: 'Presence',
          description: expect.stringMatching(
            /Spellcast \(Presence\).*Melee range.*Far range.*d8\+3 magic damage/s
          ),
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Chain Lightning', () => {
  it('card chip has stress cost 2', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const chips = collectChips([{ ...ChainLightning, _ownerInstanceId: 'char-1' }], 'card', buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' })));
    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(2);
  });

  it('card chip queues actionLoop on use', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Chain Lightning',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ChainLightning, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Chain Lightning',
          trait: 'Presence',
          description: expect.stringContaining('Spellcast (Presence)'),
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Blink Out', () => {
  it('card chip queues actionLoop on use', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Blink Out',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...BlinkOut, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Blink Out',
          trait: 'Presence',
          difficulty: 12,
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Telekinesis', () => {
  it('card chip queues actionLoop on use with Spellcast trait and Far range wording', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Telekinesis',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Telekinesis, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Telekinesis',
          trait: 'Presence',
          description: expect.stringMatching(/Spellcast \(Presence\).*Far/is),
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Rift Walker', () => {
  it('card chip queues actionLoop on use with Spellcast (15)', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Rift Walker',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...RiftWalker, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Rift Walker',
          trait: 'Presence',
          difficulty: 15,
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Arcane Reflection', () => {
  function setupMagicDamageTable(rngValue) {
    const char = mockCharacter({ instanceId: 'c1', hope: 3 });
    const adv = mockAdversary({ instanceId: 'a1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Arcane Reflection',
      action: {
        type: 'attack',
        actorInstanceId: 'a1',
        targetInstanceIds: ['c1'],
        effects: [],
      },
      rolls: mockRoll(),
      _rng: () => rngValue,
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'a1', targetInstanceIds: ['c1'] }),
      [{ ...ArcaneReflection, _ownerInstanceId: 'c1' }]
    );
    loop.setEffects([
      { type: 'damage', target: { instanceId: 'c1' }, amount: 5, damageType: 'magic' },
    ]);
    return buildTableSnapshot({
      ...loop.gameState,
      _ownerInstanceId: 'c1',
      _featureKey: 'Arcane Reflection',
    });
  }

  it('exposes a reviewAction select chip when taking magic damage with Hope', () => {
    const tbl = setupMagicDamageTable(0.1);
    const chips = collectChips([{ ...ArcaneReflection, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    expect(chips.some((c) => c.name === 'Arcane Reflection')).toBe(true);
    const ar = chips.find((c) => c.name === 'Arcane Reflection');
    expect(ar.disabled).toBe(false);
    expect(typeof ar.isSelect).toBe('function');
  });

  it('disables the chip when Hope is 0', () => {
    const char = mockCharacter({ instanceId: 'c1', hope: 0 });
    const adv = mockAdversary({ instanceId: 'a1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Arcane Reflection',
      action: {
        type: 'attack',
        actorInstanceId: 'a1',
        targetInstanceIds: ['c1'],
        effects: [
          { type: 'damage', target: { instanceId: 'c1' }, amount: 5, damageType: 'magic' },
        ],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ArcaneReflection, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const ar = chips.find((c) => c.name === 'Arcane Reflection');
    expect(ar?.disabled).toBe(true);
  });

  it('on any d6 rolling 6, spends Hope and retargets magic damage to the caster', () => {
    const tbl = setupMagicDamageTable(0.99);
    const chips = collectChips([{ ...ArcaneReflection, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const ar = chips.find((c) => c.name === 'Arcane Reflection');
    const fromUse = activateChip(ar, tbl, makeChipState(), { selectedId: '1' });
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    const dmg = tbl.action.effects.find((e) => e.type === 'damage' && e.damageType === 'magic');
    expect(dmg.target.instanceId).toBe('a1');
    expect(m.some((x) => x.type === 'addNarration')).toBe(true);
  });

  it('when no die shows 6, spends Hope but leaves damage on you', () => {
    const tbl = setupMagicDamageTable(0.1);
    const chips = collectChips([{ ...ArcaneReflection, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const ar = chips.find((c) => c.name === 'Arcane Reflection');
    activateChip(ar, tbl, makeChipState(), { selectedId: '1' });
    applyMutations(tbl);
    const dmg = tbl.action.effects.find((e) => e.type === 'damage' && e.damageType === 'magic');
    expect(dmg.target.instanceId).toBe('c1');
  });
});

describe('Arcana Tier 2 — Premonition', () => {
  it('card chip has frequency longRest', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Premonition',
      })
    );
    const chips = collectChips([{ ...Premonition, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');
  });

  it('card chip queues actionLoop on activateChip', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Premonition',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Premonition, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Premonition',
          description:
            'Once per long rest, immediately after the GM conveys the consequences of a roll you made, you may rescind the move and consequences as if they never happened, then make another move instead.',
        }),
      })
    );
  });
});

describe('Arcana Tier 2 — Cloaking Blast', () => {
  it('onReviewAction after a successful Spellcast sets pending Hope for the rider chip', () => {
    const { mutations } = runReviewAction(CloakingBlast, {
      actionType: 'spellcast',
      featureState: { 'Cloaking Blast': {} },
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
          featureKey: 'Cloaking Blast',
          key: 'cloakingBlastPendingHope',
          value: true,
        }),
      })
    );
  });

  it('onReviewAction clears pending when the Spellcast fails', () => {
    const { mutations } = runReviewAction(CloakingBlast, {
      actionType: 'spellcast',
      featureState: {
        'Cloaking Blast': { cloakingBlastPendingHope: true },
      },
      rolls: mockRoll({ isSuccess: false }),
      activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary()],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Cloaking Blast',
          key: 'cloakingBlastPendingHope',
          value: false,
        }),
      })
    );
  });

  it('reviewAction chip spends 1 Hope and adds Cloaked', () => {
    const caster = mockCharacter({
      instanceId: 'cb1',
      hope: 4,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
    });
    const gs = mockGameState({
      activeElements: [caster, mockAdversary()],
      _ownerInstanceId: 'cb1',
      _featureKey: 'Cloaking Blast',
      featureState: {
        'Cloaking Blast': { cloakingBlastPendingHope: true },
      },
      action: {
        type: 'spellcast',
        actorInstanceId: 'cb1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...CloakingBlast, _ownerInstanceId: 'cb1' }], 'reviewAction', tbl);
    const rider = chips.find((c) => c.name === 'Cloaking Blast — become Cloaked');
    expect(rider?.hopeCost).toBe(1);
    const m = activateChip(rider, tbl, makeChipState());
    deductChipCosts(rider, tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ instanceId: 'cb1', condition: 'Cloaked' }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'cb1', amount: 1 }),
      })
    );
  });

  it('onIntent clears Cloaked when starting an attack', () => {
    const { mutations } = runIntent(CloakingBlast, {
      actionType: 'attack',
      activeElements: [mockCharacter({ instanceId: 'char-1', conditions: ['Cloaked'] }), mockAdversary()],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'char-1', condition: 'Cloaked' },
      })
    );
  });

  it('onTokenMove clears Cloaked when the character moves', () => {
    const c = mockCharacter({
      instanceId: 'cb2',
      conditions: ['Cloaked'],
      tokenX: 10,
      tokenY: 0,
    });
    const gameState = {
      fear: 0,
      activeElements: [c, mockAdversary({ instanceId: 'adv-1', tokenX: 100, tokenY: 0 })],
      featureState: {},
      _previousPositions: { cb2: { tokenX: 0, tokenY: 0 } },
    };
    const { mutations } = dispatchTokenMoveHooks(
      gameState,
      [{ ...CloakingBlast, _ownerInstanceId: 'cb2' }],
      { moverInstanceId: 'cb2' }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: { instanceId: 'cb2', condition: 'Cloaked' },
      })
    );
  });
});
