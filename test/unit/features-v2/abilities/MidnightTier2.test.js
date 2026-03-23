import { describe, it, expect } from 'vitest';
import {
  collectChips,
  collectChipsForOtherCharacterSheets,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { StealthExpertise } from '../../../../src/features-v2/abilities/Midnight/StealthExpertise.js';
import { MidnightTouched } from '../../../../src/features-v2/abilities/Midnight/MidnightTouched.js';
import { PhantomRetreat } from '../../../../src/features-v2/abilities/Midnight/PhantomRetreat.js';
import registry from '../../../../src/features-v2/registry.js';
import { MassDisguise } from '../../../../src/features-v2/abilities/Midnight/MassDisguise.js';
import { runIntent, runReviewAction, mockTable, mockChipState, mockCharacter, mockGameState } from '../helpers.js';

describe('Midnight Tier 2 — Stealth Expertise', () => {
  it('shows a self reviewAction chip when acting on a roll with a Fear die', () => {
    const result = runReviewAction(StealthExpertise, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 9 },
          hopeDie: { value: 3 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips.map((c) => c.name)).toContain('Stealth Expertise');
    const self = result.chips.find((c) => c.name === 'Stealth Expertise');
    expect(self?.stressCost).toBe(1);
    expect(result.chips.some((c) => c.name === 'Stealth Expertise — Ally')).toBe(false);
  });

  it('does not show chips when not acting', () => {
    const result = runReviewAction(StealthExpertise, {
      action: {
        type: 'action',
        actorInstanceId: 'char-2',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 9 },
          hopeDie: { value: 3 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    expect(result.chips).toHaveLength(0);
  });

  it('self chip sets outcome to Hope and deducts Stress via chip cost path', () => {
    const result = runReviewAction(StealthExpertise, {
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 9 },
          hopeDie: { value: 3 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    const self = result.chips.find((c) => c.name === 'Stealth Expertise');
    expect(self).toBeDefined();

    const table = mockTable({
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        traitKey: 'Agility',
      },
      rolls: {
        action: {
          fearDie: { value: 9 },
          hopeDie: { value: 3 },
          dice: [],
          statics: [],
        },
      },
    });

    self.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setRollOutcome',
        payload: { rollKey: 'action', outcome: 'hope' },
      })
    );
  });

  it('ally cross-sheet chip marks Stress on the expert and sets Hope outcome', () => {
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 0, tokenY: 0 });
    const expert = mockCharacter({ instanceId: 'exp-1', tokenX: 10, tokenY: 0 });

    const gs = mockGameState({
      activeElements: [ally, expert],
      _ownerInstanceId: 'ally-1',
      _featureKey: 'Stealth Expertise',
      _activeFeature: { ...StealthExpertise, _ownerInstanceId: 'exp-1' },
      action: {
        type: 'action',
        actorInstanceId: 'ally-1',
        targetInstanceIds: [],
        trait: 'Agility',
        effects: [],
        appliedEffects: [],
      },
      rolls: {
        action: {
          fearDie: { value: 8 },
          hopeDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    });

    const table = buildTableSnapshot(gs);
    const chips = collectChips([{ ...StealthExpertise, _ownerInstanceId: 'exp-1' }], 'reviewAction', table);
    const allyChip = chips.find((c) => c.name === 'Stealth Expertise — Ally');
    expect(allyChip).toBeDefined();

    allyChip.onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'exp-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setRollOutcome',
        payload: { rollKey: 'action', outcome: 'hope' },
      })
    );
  });

  it('collectChipsForOtherCharacterSheets surfaces the ally chip on the acting ally’s viewer id', () => {
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 0, tokenY: 0, abilityIds: [] });
    const expert = mockCharacter({
      instanceId: 'exp-1',
      tokenX: 10,
      tokenY: 0,
      abilityIds: ['srd-abl-stealth-expertise'],
    });

    const base = {
      activeElements: [ally, expert],
      action: {
        type: 'action',
        actorInstanceId: 'ally-1',
        targetInstanceIds: [],
        trait: 'Agility',
        effects: [],
        appliedEffects: [],
      },
      rolls: {
        action: {
          fearDie: { value: 8 },
          hopeDie: { value: 3 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
    };

    const cross = collectChipsForOtherCharacterSheets('ally-1', [ally, expert], registry, 'reviewAction', base);
    expect(cross.some((c) => c.name === 'Stealth Expertise — Ally' && c.showOnOtherSheets === true)).toBe(true);
  });
});

const fourMidnight = () =>
  [1, 2, 3, 4].map((i) => ({ id: `mid-${i}`, domain: 'midnight' }));

describe('Midnight Tier 2 — Midnight-Touched', () => {
  it('offers Hope-instead-of-GM-Fear chip at 0 Hope when Fear dominates and Touched is active', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 0,
      domainLoadout: fourMidnight(),
    });
    const { chips } = runReviewAction(
      { ...MidnightTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: {
          action: {
            hopeDie: { value: 3 },
            fearDie: { value: 9 },
            dice: [],
            statics: [],
            isCritical: false,
          },
        },
        action: {
          type: 'action',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
      }
    );
    const hopeChip = chips.find((c) => c.name === 'Midnight-Touched — Hope instead of GM Fear');
    expect(hopeChip).toBeDefined();
  });

  it('Hope chip onUse sets outcome Hope and queues gainHope 1', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 0,
      domainLoadout: fourMidnight(),
    });
    const reviewOpts = {
      activeElements: [char],
      rolls: {
        action: {
          hopeDie: { value: 2 },
          fearDie: { value: 11 },
          dice: [],
          statics: [],
          isCritical: false,
        },
      },
      action: {
        type: 'action',
        actorInstanceId: 'char-1',
        targetInstanceIds: [],
        trait: 'Agility',
        effects: [],
        appliedEffects: [],
      },
    };
    const { chips } = runReviewAction({ ...MidnightTouched, _ownerInstanceId: 'char-1' }, reviewOpts);
    const table = mockTable({
      ...reviewOpts,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Midnight-Touched',
    });
    const hopeChip = chips.find((c) => c.name === 'Midnight-Touched — Hope instead of GM Fear');
    hopeChip.onUse(table, mockChipState());
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setRollOutcome',
        payload: { rollKey: 'action', outcome: 'hope' },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: { instanceId: 'char-1', amount: 1 },
      })
    );
  });

  it('does not offer Hope chip when Hope is not 0', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 2,
      domainLoadout: fourMidnight(),
    });
    const { chips } = runReviewAction(
      { ...MidnightTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: {
          action: {
            hopeDie: { value: 3 },
            fearDie: { value: 9 },
            dice: [],
            statics: [],
            isCritical: false,
          },
        },
        action: {
          type: 'action',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
      }
    );
    expect(chips.filter((c) => c.name === 'Midnight-Touched — Hope instead of GM Fear')).toHaveLength(0);
  });

  it('does not offer Hope chip with fewer than 4 Midnight domain cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      hope: 0,
      domainLoadout: [
        { id: 'a', domain: 'midnight' },
        { id: 'b', domain: 'midnight' },
      ],
    });
    const { chips } = runReviewAction(
      { ...MidnightTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: {
          action: {
            hopeDie: { value: 3 },
            fearDie: { value: 9 },
            dice: [],
            statics: [],
            isCritical: false,
          },
        },
        action: {
          type: 'action',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
      }
    );
    expect(chips.filter((c) => c.name === 'Midnight-Touched — Hope instead of GM Fear')).toHaveLength(0);
  });

  it('offers Fear-Die-to-Damage chip on a successful attack when Touched is active', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourMidnight() });
    const { chips } = runReviewAction(
      { ...MidnightTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: {
          action: {
            hopeDie: { value: 10 },
            fearDie: { value: 6 },
            dice: [],
            statics: [],
            isSuccess: true,
            isCritical: false,
          },
          damage: {
            dice: [{ name: 'weapon', die: 'd8', value: 2 }],
            statics: [],
          },
        },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
      }
    );
    const dmgChip = chips.find((c) => c.name === 'Midnight-Touched — Fear Die to Damage');
    expect(dmgChip).toBeDefined();
    expect(dmgChip.stressCost).toBe(1);
  });

  it('Fear-Die-to-Damage onUse adds Fear face to damage statics', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourMidnight() });
    const reviewOpts = {
      activeElements: [char],
      rolls: {
        action: {
          hopeDie: { value: 12 },
          fearDie: { value: 7 },
          dice: [],
          statics: [],
          isSuccess: true,
          isCritical: false,
        },
        damage: {
          dice: [{ name: 'weapon', die: 'd8', value: 3 }],
          statics: [],
        },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Agility',
        effects: [],
        appliedEffects: [],
      },
    };
    const { chips } = runReviewAction({ ...MidnightTouched, _ownerInstanceId: 'char-1' }, reviewOpts);
    const table = mockTable({
      ...reviewOpts,
      _ownerInstanceId: 'char-1',
      _featureKey: 'Midnight-Touched',
    });
    const dmgChip = chips.find((c) => c.name === 'Midnight-Touched — Fear Die to Damage');
    dmgChip.onUse(table, mockChipState());
    const mutations = applyMutations(table);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: { rollKey: 'damage', name: 'Midnight-Touched', value: 7 },
      })
    );
  });

  it('does not offer Fear-Die-to-Damage chip when the attack action roll fails', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourMidnight() });
    const { chips } = runReviewAction(
      { ...MidnightTouched, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char],
        rolls: {
          action: {
            hopeDie: { value: 2 },
            fearDie: { value: 3 },
            dice: [],
            statics: [],
            isSuccess: false,
            isCritical: false,
          },
          damage: {
            dice: [{ name: 'weapon', die: 'd8', value: 1 }],
            statics: [],
          },
        },
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
      }
    );
    expect(chips.filter((c) => c.name === 'Midnight-Touched — Fear Die to Damage')).toHaveLength(0);
  });
});

describe('Midnight Tier 2 — Phantom Retreat', () => {
  it('offers Set anchor when not armed and Reappear when armed', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 4, tokenY: 8 });
    const off = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Phantom Retreat',
        featureState: { 'Phantom Retreat': {} },
      })
    );
    const chipsOff = collectChips([{ ...PhantomRetreat, _ownerInstanceId: 'c1' }], 'card', off);
    expect(chipsOff.map((c) => c.name)).toEqual(['Phantom Retreat — Set anchor']);

    const on = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Phantom Retreat',
        featureState: {
          'Phantom Retreat': {
            phantomRetreatArmed: true,
            phantomRetreatAnchorX: 4,
            phantomRetreatAnchorY: 8,
          },
        },
      })
    );
    const chipsOn = collectChips([{ ...PhantomRetreat, _ownerInstanceId: 'c1' }], 'card', on);
    expect(chipsOn.map((c) => c.name)).toEqual(['Phantom Retreat — Reappear']);
  });

  it('Set anchor records position, arms spell, and posts action loop', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 12, tokenY: 15 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Phantom Retreat',
        featureState: { 'Phantom Retreat': {} },
      })
    );
    const chips = collectChips([{ ...PhantomRetreat, _ownerInstanceId: 'c1' }], 'card', tbl);
    const anchor = chips.find((c) => c.name === 'Phantom Retreat — Set anchor');
    expect(anchor).toBeDefined();
    anchor.onUse(tbl, mockChipState());
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Phantom Retreat',
          key: 'phantomRetreatArmed',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Phantom Retreat',
          key: 'phantomRetreatAnchorX',
          value: 12,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ instanceId: 'c1', title: 'Phantom Retreat' }),
      })
    );
  });

  it('Reappear clears state, requests move to anchor, and posts action loop', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 30, tokenY: 40 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'c1',
        _featureKey: 'Phantom Retreat',
        featureState: {
          'Phantom Retreat': {
            phantomRetreatArmed: true,
            phantomRetreatAnchorX: 10,
            phantomRetreatAnchorY: 5,
          },
        },
      })
    );
    const chips = collectChips([{ ...PhantomRetreat, _ownerInstanceId: 'c1' }], 'card', tbl);
    const re = chips.find((c) => c.name === 'Phantom Retreat — Reappear');
    expect(re).toBeDefined();
    re.onUse(tbl, mockChipState());
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Phantom Retreat',
          key: 'phantomRetreatArmed',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'move',
        payload: expect.objectContaining({
          instanceId: 'c1',
          desiredCondition: 'Token on your Phantom Retreat anchor',
          description: 'Phantom Retreat — reappear at your anchor.',
        }),
      })
    );
    const moveMut = m.find((x) => x.type === 'move');
    expect(typeof moveMut.payload.conditionFn).toBe('function');
    expect(moveMut.payload.conditionFn(tbl)).toBe(false);
    const atAnchor = mockCharacter({ instanceId: 'c1', tokenX: 10, tokenY: 5 });
    const tblAnchor = buildTableSnapshot(
      mockGameState({
        activeElements: [atAnchor],
        _ownerInstanceId: 'c1',
        _featureKey: 'Phantom Retreat',
        featureState: { 'Phantom Retreat': {} },
      })
    );
    expect(moveMut.payload.conditionFn(tblAnchor)).toBe(true);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ instanceId: 'c1', title: 'Phantom Retreat' }),
      })
    );
  });

  it('onRest clears armed state and anchor', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Phantom Retreat',
      featureState: {
        'Phantom Retreat': {
          phantomRetreatArmed: true,
          phantomRetreatAnchorX: 1,
          phantomRetreatAnchorY: 2,
        },
      },
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
    PhantomRetreat.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Phantom Retreat',
          key: 'phantomRetreatArmed',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Phantom Retreat',
          key: 'phantomRetreatAnchorX',
          value: null,
        }),
      })
    );
  });
});

describe('Midnight Tier 2 — Mass Disguise', () => {
  it('card marks Stress, saves targets, and posts action loop', () => {
    const caster = mockCharacter({ instanceId: 'md1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'md2', tokenX: 15, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [caster, ally],
        _ownerInstanceId: 'md1',
        _featureKey: 'Mass Disguise',
        action: {
          type: 'free',
          actorInstanceId: 'md1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...MassDisguise, _ownerInstanceId: 'md1' }], 'card', tbl);
    const cast = chips.find((c) => c.name === 'Mass Disguise');
    expect(cast).toBeDefined();
    const m = activateChip(cast, tbl, makeChipState(), { selectedTargetIds: ['md1', 'md2'] });
    deductChipCosts(cast, tbl);
    const mutations = [...m, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'md1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Mass Disguise',
          key: 'massDisguiseActive',
          value: true,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Mass Disguise' }),
      })
    );
  });

  it('onIntent adds advantage when a disguised actor rolls Presence', () => {
    const { mutations } = runIntent(
      { ...MassDisguise, _ownerInstanceId: 'md1' },
      {
        actionType: 'trait',
        featureState: {
          'Mass Disguise': {
            massDisguiseActive: true,
            massDisguiseTargets: ['md1', 'md2'],
          },
        },
        activeElements: [
          mockCharacter({ instanceId: 'md1', tokenX: 0, tokenY: 0 }),
          mockCharacter({ instanceId: 'md2', tokenX: 10, tokenY: 0 }),
        ],
        action: { actorInstanceId: 'md2', traitKey: 'presence' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: { rollKey: 'action', name: 'Mass Disguise' },
      })
    );
  });

  it('End Mass Disguise clears feature state', () => {
    const char = mockCharacter({ instanceId: 'md1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char],
        _ownerInstanceId: 'md1',
        _featureKey: 'Mass Disguise',
        featureState: {
          'Mass Disguise': {
            massDisguiseActive: true,
            massDisguiseTargets: ['md1'],
            massDisguiseCountdown: 3,
          },
        },
      })
    );
    const chips = collectChips([{ ...MassDisguise, _ownerInstanceId: 'md1' }], 'card', tbl);
    const end = chips.find((c) => c.name === 'End Mass Disguise');
    expect(end).toBeDefined();
    end.onUse(tbl, makeChipState());
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Mass Disguise',
          key: 'massDisguiseActive',
          value: false,
        }),
      })
    );
  });
});
