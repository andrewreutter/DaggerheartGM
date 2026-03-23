import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { DarkWhispers } from '../../../../src/features-v2/abilities/Midnight/DarkWhispers.js';
import { Eclipse } from '../../../../src/features-v2/abilities/Midnight/Eclipse.js';
import { Shadowhunter } from '../../../../src/features-v2/abilities/Midnight/Shadowhunter.js';
import { Spellcharge } from '../../../../src/features-v2/abilities/Midnight/Spellcharge.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockRoll,
  mockAction,
  runReviewAction,
  runReviewOutcome,
  runIntent,
} from '../helpers.js';

describe('Midnight Tier 3 — Dark Whispers', () => {
  it('card has stress cost and target selection', () => {
    const caster = mockCharacter({
      instanceId: 'dw1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0, difficulty: 12 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'dw1',
      _featureKey: 'Dark Whispers',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'dw1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...DarkWhispers, _ownerInstanceId: 'dw1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0]?.stressCost).toBe(1);
    expect(chips[0]?.name).toBe('Dark Whispers');
  });

  it('card with target marks Stress, sets awaiting state, and queues Spellcast', () => {
    const caster = mockCharacter({
      instanceId: 'dw1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0, difficulty: 12 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'dw1',
      _featureKey: 'Dark Whispers',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'dw1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...DarkWhispers, _ownerInstanceId: 'dw1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['adv-1'] });
    deductChipCosts(chips[0], tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'dw1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Dark Whispers',
          key: 'darkWhispersAwaiting',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Dark Whispers',
          trait: 'Presence',
          difficulty: 12,
        }),
      })
    );
    expect(m.find((x) => x.type === 'actionLoop')?.payload?.description).toMatch(/marked 1 Stress/);
  });

  it('onReviewAction after successful Spellcast queues insight actionLoop', () => {
    const { mutations } = runReviewAction(DarkWhispers, {
      actionType: 'spellcast',
      featureState: {
        'Dark Whispers': {
          darkWhispersAwaiting: true,
          darkWhispersTargetId: 'adv-1',
        },
      },
      rolls: mockRoll({ isSuccess: true }),
      activeElements: [
        mockCharacter({
          instanceId: 'char-1',
          spellcastTrait: 'presence',
          traits: { presence: 2 },
        }),
        mockAdversary({ instanceId: 'adv-1', name: 'Gloom Wraith' }),
      ],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Dark Whispers',
          key: 'darkWhispersAwaiting',
          value: false,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Dark Whispers — insight',
          description: expect.stringContaining('Gloom Wraith'),
        }),
      })
    );
  });

  it('onReviewAction clears state when Spellcast fails', () => {
    const { mutations } = runReviewAction(DarkWhispers, {
      actionType: 'spellcast',
      featureState: {
        'Dark Whispers': {
          darkWhispersAwaiting: true,
          darkWhispersTargetId: 'adv-1',
        },
      },
      rolls: mockRoll({ isSuccess: false }),
      activeElements: [mockCharacter({ instanceId: 'char-1' }), mockAdversary({ instanceId: 'adv-1' })],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Dark Whispers',
          key: 'darkWhispersTargetId',
          value: null,
        }),
      })
    );
    expect(mutations.filter((m) => m.type === 'actionLoop')).toHaveLength(0);
  });
});

describe('Midnight Tier 3 — Spellcharge', () => {
  it('banks tokens when marking magic HP loss, capped by Spellcast trait', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...Spellcharge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { Spellcharge: {} },
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', amount: 2, target: char, damageType: 'magic' }],
        },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Spellcharge',
          key: 'spellchargeTokens',
          value: 1,
        }),
      })
    );
  });

  it('does not bank tokens from physical damage', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...Spellcharge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { Spellcharge: {} },
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', amount: 2, target: char, damageType: 'physical' }],
        },
        actionType: 'attack',
      }
    );
    expect(mutations.filter((m) => m.type === 'setFeatureState')).toHaveLength(0);
  });

  it('banks tokens when bridge sends type:damage magic HP loss', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 2, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...Spellcharge, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: { Spellcharge: {} },
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [
            { type: 'damage', amount: 2, target: char, damageType: 'magic' },
          ],
        },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Spellcharge',
          key: 'spellchargeTokens',
          value: 1,
        }),
      })
    );
  });

  it('reviewAction chip spends tokens and adds Nd6 to damage', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      spellcastTrait: 'presence',
      traits: { agility: 1, strength: 1, finesse: 0, instinct: 0, presence: 3, knowledge: 0 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const shared = {
      activeElements: [char, adv],
      featureState: { Spellcharge: { spellchargeTokens: 3 } },
      rolls: mockRoll({ isSuccess: true }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      actionType: 'attack',
    };
    const gs = mockGameState({
      ...shared,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Spellcharge',
    });
    const tbl = buildTableSnapshot(gs);
    const { chips } = runReviewAction({ ...Spellcharge, _ownerInstanceId: 'char-1' }, shared);
    const sc = chips.find((c) => c.name === 'Spellcharge');
    expect(sc).toBeDefined();
    const fromUse = activateChip(sc, tbl, makeChipState(), { selectedId: '2' });
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Spellcharge',
          die: '2d6',
        }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Spellcharge',
          key: 'spellchargeTokens',
          value: 1,
        }),
      })
    );
  });
});

describe('Midnight Tier 3 — Shadowhunter', () => {
  it('adds +1 Evasion from passiveStatMods when shrouded toggle state is on', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Shadowhunter, _ownerInstanceId: 'c1' }],
      mockCharacter({
        instanceId: 'c1',
        evasion: 10,
        featureState: {
          Shadowhunter: { '_v2t:Shadowhunter::Shrouded in low light or darkness::card': true },
        },
      }),
      {},
      null
    );
    expect(stats.evasion).toBe(11);
  });

  it('does not add Evasion when not shrouded', () => {
    const { stats } = applyDeclarativeFeatures(
      [{ ...Shadowhunter, _ownerInstanceId: 'c1' }],
      mockCharacter({
        instanceId: 'c1',
        evasion: 10,
        featureState: {
          Shadowhunter: { '_v2t:Shadowhunter::Shrouded in low light or darkness::card': false },
        },
      }),
      {},
      null
    );
    expect(stats.evasion).toBe(10);
  });

  it('onIntent adds advantage on attack rolls while shrouded', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runIntent(
      { ...Shadowhunter, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: {
          Shadowhunter: { '_v2t:Shadowhunter::Shrouded in low light or darkness::card': true },
        },
        action: mockAction({ type: 'attack', range: 'melee' }),
        rolls: mockRoll(),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: { rollKey: 'action', name: 'Shadowhunter' },
      })
    );
  });

  it('onIntent does not add advantage when not shrouded', () => {
    const char = mockCharacter({ instanceId: 'char-1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 5, tokenY: 0 });

    const { mutations } = runIntent(
      { ...Shadowhunter, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: {
          Shadowhunter: { '_v2t:Shadowhunter::Shrouded in low light or darkness::card': false },
        },
        action: mockAction({ type: 'attack', range: 'melee' }),
        rolls: mockRoll(),
      }
    );

    expect(mutations.filter((m) => m.type === 'addAdvantageDie')).toHaveLength(0);
  });
});

describe('Midnight Tier 3 — Eclipse', () => {
  it('card chip has 2 Hope recall and long-rest frequency', () => {
    const caster = mockCharacter({
      instanceId: 'e1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'e1',
      _featureKey: 'Eclipse',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'e1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Eclipse, _ownerInstanceId: 'e1' }], 'card', tbl);
    const cast = chips.find((c) => c.name === 'Eclipse');
    expect(cast?.hopeCost).toBe(2);
    expect(cast?.frequency).toBe('longRest');
  });

  it('casting sets awaiting spellcast and queues Spellcast (16)', () => {
    const caster = mockCharacter({
      instanceId: 'e1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
      traits: { presence: 2 },
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [caster, adv],
      _ownerInstanceId: 'e1',
      _featureKey: 'Eclipse',
      featureState: {},
      action: {
        type: 'free',
        actorInstanceId: 'e1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Eclipse, _ownerInstanceId: 'e1' }], 'card', tbl);
    const cast = chips.find((c) => c.name === 'Eclipse');
    const m = activateChip(cast, tbl, makeChipState(), {});
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Eclipse',
          key: 'eclipseAwaitingSpellcast',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Eclipse',
          difficulty: 16,
        }),
      })
    );
  });

  it('onReviewAction: successful Spellcast activates eclipse shadow', () => {
    const { mutations } = runReviewAction({ ...Eclipse, _ownerInstanceId: 'c1' }, {
      actionType: 'spellcast',
      featureState: {
        Eclipse: { eclipseAwaitingSpellcast: true },
      },
      rolls: mockRoll({ isSuccess: true, hopeValue: 8, fearValue: 3 }),
      activeElements: [
        mockCharacter({ instanceId: 'c1', spellcastTrait: 'presence', traits: { presence: 2 } }),
        mockAdversary({ instanceId: 'adv-1' }),
      ],
    });
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Eclipse',
          key: 'eclipseActive',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Eclipse',
          key: 'eclipseAwaitingSpellcast',
          value: false,
        }),
      })
    );
  });

  it('onIntent: adversary attack vs ally in shadow adds disadvantage', () => {
    const caster = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'ally-1', name: 'Ally', tokenX: 30, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 60, tokenY: 0 });

    const { mutations } = runIntent(
      { ...Eclipse, _ownerInstanceId: 'c1' },
      {
        activeElements: [caster, ally, adv],
        featureState: { Eclipse: { eclipseActive: true } },
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          traitKey: 'Agility',
        }),
        rolls: mockRoll(),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDisadvantageDie',
        payload: { rollKey: 'action', name: 'Eclipse' },
      })
    );
  });

  it('onReviewAction: Hope success vs adversary in shadow marks their Stress', () => {
    const caster = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 40, tokenY: 0 });

    const { mutations } = runReviewAction({ ...Eclipse, _ownerInstanceId: 'c1' }, {
      actionType: 'attack',
      featureState: { Eclipse: { eclipseActive: true } },
      rolls: mockRoll({ isSuccess: true, hopeValue: 10, fearValue: 4 }),
      action: mockAction({
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
      }),
      activeElements: [caster, adv],
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });

  it('onReviewOutcome: Severe HP loss on caster clears eclipse', () => {
    const caster = mockCharacter({ instanceId: 'c1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewOutcome({ ...Eclipse, _ownerInstanceId: 'c1' }, {
      activeElements: [caster, adv],
      featureState: { Eclipse: { eclipseActive: true } },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['c1'],
        effects: [
          {
            stat: 'currentHP',
            amount: 2,
            target: caster,
            damageTier: 'severe',
          },
        ],
      },
      actionType: 'attack',
    });

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Eclipse',
          key: 'eclipseActive',
          value: false,
        }),
      })
    );
  });
});
