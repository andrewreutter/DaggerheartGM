import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, makeChipState, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { dispatchStateChangeHooks } from '../../../../src/features-v2/engine/action-loop.js';
import { Banish } from '../../../../src/features-v2/abilities/Codex/Banish.js';
import { ManifestWall } from '../../../../src/features-v2/abilities/Codex/ManifestWall.js';
import { Teleport } from '../../../../src/features-v2/abilities/Codex/Teleport.js';
import { DisintegrationWave } from '../../../../src/features-v2/abilities/Codex/DisintegrationWave.js';
import { SigilOfRetribution } from '../../../../src/features-v2/abilities/Codex/SigilOfRetribution.js';
import { BookOfVyola } from '../../../../src/features-v2/abilities/Codex/BookOfVyola.js';
import { CodexTouched } from '../../../../src/features-v2/abilities/Codex/CodexTouched.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  mockAdversaryAttackRoll,
  runReviewAction,
  runReviewOutcome,
  runIntent,
} from '../helpers.js';

describe('Codex Tier 2 — Banish', () => {
  it('exposes two card chips (main spell and Fear timing)', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'knowledge' });
    const tbl = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    const chips = collectChips([{ ...Banish, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips).toHaveLength(2);
    expect(chips.map((c) => c.name)).toEqual(['Banish', 'Banish — Fear & return']);
  });

  it('main Banish chip queues actionLoop with Spellcast trait', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Banish',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Banish, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const main = chips.find((c) => c.name === 'Banish');
    expect(main).toBeDefined();
    const m = activateChip(main, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Banish',
          trait: 'Presence',
          description: expect.stringContaining('Spellcast (Presence)'),
        }),
      })
    );
  });

  it('Fear & return chip queues actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'instinct' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Banish',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Banish, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const fear = chips.find((c) => c.name === 'Banish — Fear & return');
    expect(fear).toBeDefined();
    const m = activateChip(fear, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Banish — Fear & return',
          trait: 'Instinct',
          description: expect.stringContaining('Spellcast trait label: Instinct'),
        }),
      })
    );
  });
});

describe('Codex Tier 2 — Manifest Wall', () => {
  it('card is once per rest and queues Spellcast (15) actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Manifest Wall',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ManifestWall, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.frequency).toBe('rest');
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Manifest Wall',
          trait: 'Presence',
          difficulty: 15,
        }),
      })
    );
  });

  it('uses spellcast trait label in actionLoop description', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'knowledge', traits: { knowledge: 2 } });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Manifest Wall',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ManifestWall, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          trait: 'Knowledge',
          difficulty: 15,
          description: expect.stringContaining('Spellcast (Knowledge)'),
        }),
      })
    );
  });
});

describe('Codex Tier 2 — Manifest Wall', () => {
  it('card is once per rest and queues Spellcast (15) actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Manifest Wall',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ManifestWall, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.frequency).toBe('rest');
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Manifest Wall',
          trait: 'Presence',
          difficulty: 15,
        }),
      })
    );
  });
});

describe('Codex Tier 2 — Teleport', () => {
  it('card is once per long rest and queues Spellcast (16) actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Teleport',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Teleport, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.frequency).toBe('longRest');
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Teleport',
          trait: 'Presence',
          difficulty: 16,
        }),
      })
    );
  });

  it('uses spellcast trait label when spellcastTrait is set', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'knowledge', traits: { knowledge: 2 } });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Teleport',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Teleport, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          trait: 'Knowledge',
          difficulty: 16,
        }),
      })
    );
  });

  it('does not register intent-placement chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    const intent = collectChips([{ ...Teleport, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});

describe('Codex Tier 2 — Disintegration Wave', () => {
  it('card is once per long rest and queues Spellcast (18) actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'presence' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Disintegration Wave',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...DisintegrationWave, _ownerInstanceId: 'char-1' }], 'card', tbl);
    expect(chips[0]?.frequency).toBe('longRest');
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Disintegration Wave',
          trait: 'Presence',
          difficulty: 18,
          description: expect.stringContaining('effective Difficulty of 18 or lower'),
        }),
      })
    );
  });

  it('uses spellcast trait label when spellcastTrait is set', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'knowledge', traits: { knowledge: 3 } });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Disintegration Wave',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...DisintegrationWave, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          trait: 'Knowledge',
          difficulty: 18,
        }),
      })
    );
  });

  it('does not register intent-placement chips', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const tbl = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    const intent = collectChips([{ ...DisintegrationWave, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});

describe('Codex Tier 2 — Sigil of Retribution', () => {
  const sigilFeat = { ...SigilOfRetribution, _ownerInstanceId: 'char-1' };

  it('cast chip gains Fear, stores mark, and queues actionLoop when a Close adversary is selected', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Sigil of Retribution',
      featureState: { 'Sigil of Retribution': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([sigilFeat], 'card', tbl);
    expect(chips).toHaveLength(1);
    const cs = makeChipState();
    cs.set('selectedTargetIds', ['adv-1']);
    const m = activateChip(chips[0], tbl, cs);
    expect(m).toContainEqual(expect.objectContaining({ type: 'gainFear', payload: { amount: 1 } }));
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Sigil of Retribution',
          key: 'markedAdversaryInstanceId',
          value: 'adv-1',
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Sigil of Retribution',
          instanceId: 'char-1',
        }),
      })
    );
  });

  it('onReviewAction adds pooled d8 damage and clears sigil tokens on a successful hit vs the marked adversary', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 4 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewAction(sigilFeat, {
      activeElements: [char, adv],
      featureState: {
        'Sigil of Retribution': {
          markedAdversaryInstanceId: 'adv-1',
          sigilTokenCount: 2,
        },
      },
      rolls: mockRoll({ isSuccess: true }),
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
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Sigil of Retribution',
          die: '2d8',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'sigilTokenCount',
          value: 0,
        }),
      })
    );
  });

  it('onReviewOutcome places a d8 token when the marked adversary deals HP damage to a PC', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 4 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(sigilFeat, {
      activeElements: [char, adv],
      featureState: {
        'Sigil of Retribution': {
          markedAdversaryInstanceId: 'adv-1',
          sigilTokenCount: 0,
        },
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [{ stat: 'currentHP', amount: 1, target: char }],
        appliedEffects: [],
      },
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'sigilTokenCount',
          value: 1,
        }),
      })
    );
  });

  it('does not exceed level cap when placing d8 tokens', () => {
    const char = mockCharacter({ instanceId: 'char-1', level: 1 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(sigilFeat, {
      activeElements: [char, adv],
      featureState: {
        'Sigil of Retribution': {
          markedAdversaryInstanceId: 'adv-1',
          sigilTokenCount: 1,
        },
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects: [{ stat: 'currentHP', amount: 1, target: char }],
        appliedEffects: [],
      },
    });
    expect(mutations.some((m) => m.type === 'setFeatureState' && m.payload?.key === 'sigilTokenCount')).toBe(
      false
    );
  });

  it('onStateChange clears sigil state when the marked adversary is reduced to 0 HP', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1', currentHp: 0, maxHp: 3 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Sigil of Retribution',
      featureState: {
        'Sigil of Retribution': {
          markedAdversaryInstanceId: 'adv-1',
          sigilTokenCount: 2,
        },
      },
    });
    const { mutations } = dispatchStateChangeHooks(
      gs,
      [sigilFeat],
      [{ type: 'markHP', payload: { instanceId: 'adv-1', amount: 1 } }]
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'markedAdversaryInstanceId',
          value: null,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'sigilTokenCount',
          value: 0,
        }),
      })
    );
  });
});

describe('Codex Tier 2 — Book of Vyola', () => {
  const vyola = { ...BookOfVyola, _ownerInstanceId: 'char-1' };

  it('exposes Memory Delve and Shared Clarity card chips', () => {
    const char = mockCharacter({ instanceId: 'char-1', spellcastTrait: 'knowledge' });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Book of Vyola',
        featureState: { 'Book of Vyola': {} },
      })
    );
    const chips = collectChips([vyola], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Memory Delve', 'Shared Clarity']);
  });

  it('Memory Delve queues Spellcast actionLoop for a Far-range target', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'knowledge',
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Vyola',
      featureState: { 'Book of Vyola': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([vyola], 'card', tbl);
    const md = chips.find((c) => c.name === 'Memory Delve');
    expect(md).toBeDefined();
    const m = activateChip(md, tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Book of Vyola — Memory Delve',
          trait: 'Knowledge',
          description: expect.stringContaining('Spellcast (Knowledge)'),
        }),
      })
    );
  });

  it('Shared Clarity stores pair and queues actionLoop when two creatures are chosen', () => {
    const c1 = mockCharacter({ instanceId: 'char-1', name: 'Alpha', tokenX: 0, tokenY: 0 });
    const c2 = mockCharacter({ instanceId: 'char-2', name: 'Beta', tokenX: 5, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [c1, c2],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Vyola',
      featureState: { 'Book of Vyola': {} },
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([vyola], 'card', tbl);
    const sc = chips.find((c) => c.name === 'Shared Clarity');
    expect(sc).toBeDefined();
    expect(sc?.frequency).toBe('longRest');
    const m = activateChip(sc, tbl, makeChipState(), { selectedTargetIds: ['char-1', 'char-2'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Book of Vyola',
          key: 'sharedClarityPairIds',
          value: ['char-1', 'char-2'],
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Book of Vyola — Shared Clarity',
          description: expect.stringContaining('Alpha and Beta'),
        }),
      })
    );
  });

  it('reviewOutcome chip reassigns pending Stress on a linked creature to the other', () => {
    const caster = mockCharacter({ instanceId: 'char-1', name: 'Alpha', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'char-2', name: 'Beta', tokenX: 5, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const effects = [
      {
        stat: 'currentStress',
        amount: 1,
        target: ally,
      },
    ];
    const vyolaFeat = { ...BookOfVyola, _ownerInstanceId: 'char-1' };
    const { chips } = runReviewOutcome(vyolaFeat, {
      activeElements: [caster, ally, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Vyola',
      featureState: {
        'Book of Vyola': { sharedClarityPairIds: ['char-1', 'char-2'] },
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
    const redirect = chips.find((c) => c.name === 'Shared Clarity — assign Stress');
    expect(redirect).toBeDefined();
    const gs = mockGameState({
      activeElements: [caster, ally, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Vyola',
      featureState: {
        'Book of Vyola': { sharedClarityPairIds: ['char-1', 'char-2'] },
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

  it('onRest clears Shared Clarity pair', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Book of Vyola',
      featureState: {
        'Book of Vyola': { sharedClarityPairIds: ['char-1', 'char-2'] },
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
    const restHook = unwrap(BookOfVyola.hooks.onRest, tbl);
    expect(typeof restHook).toBe('function');
    restHook(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Book of Vyola',
          key: 'sharedClarityPairIds',
          value: null,
        }),
      })
    );
  });
});

const fourCodex = () => [1, 2, 3, 4].map((i) => ({ id: `card-${i}`, domain: 'codex' }));

describe('Codex Tier 2 — Codex-Touched', () => {
  it('intent chip adds Proficiency to Spellcast when 4+ Codex cards in loadout', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      proficiency: 3,
      domainLoadout: fourCodex(),
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runIntent(
      { ...CodexTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        _ownerInstanceId: 'char-1',
        actionType: 'spellcast',
        action: { type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], traitKey: 'Presence' },
        rolls: mockRoll(),
      }
    );
    const prof = chips.find((c) => c.name === 'Codex-Touched — Proficiency to Spellcast');
    expect(prof).toBeDefined();
    expect(prof?.stressCost).toBe(1);

    const gs = mockGameState({
      activeElements: [char, adv],
      currentActorInstanceId: 'char-1',
      _ownerInstanceId: 'char-1',
      _featureKey: 'Codex-Touched',
      action: { type: 'spellcast', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'], traitKey: 'Presence' },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(prof, tbl, makeChipState());
    deductChipCosts(prof, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Codex-Touched', value: 3 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('does not offer Proficiency chip when fewer than 4 Codex domain cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'a', domain: 'codex' }],
    });
    const { chips } = runIntent(
      { ...CodexTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, mockAdversary()],
        actionType: 'spellcast',
        action: { type: 'spellcast', actorInstanceId: 'char-1', traitKey: 'Presence' },
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name === 'Codex-Touched — Proficiency to Spellcast')).toHaveLength(0);
  });

  it('does not offer Proficiency chip on non-Spellcast actions', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourCodex() });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runIntent(
      { ...CodexTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: { type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] },
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name === 'Codex-Touched — Proficiency to Spellcast')).toHaveLength(0);
  });

  it('vault swap card chip is once per rest and queues actionLoop', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourCodex() });
    const tbl = buildTableSnapshot(mockGameState({ activeElements: [char], _ownerInstanceId: 'char-1' }));
    const chips = collectChips([{ ...CodexTouched, _ownerInstanceId: 'char-1' }], 'card', tbl);
    const swap = chips.find((c) => c.name === 'Codex-Touched — Vault swap');
    expect(swap).toBeDefined();
    expect(swap?.frequency).toBe('rest');
    const m = activateChip(swap, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Codex-Touched — Vault swap',
        }),
      })
    );
  });
});
