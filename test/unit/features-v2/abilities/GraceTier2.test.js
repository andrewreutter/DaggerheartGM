import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { NeverUpstaged } from '../../../../src/features-v2/abilities/Grace/NeverUpstaged.js';
import { ThoughtDelver } from '../../../../src/features-v2/abilities/Grace/ThoughtDelver.js';
import { ThroughYourEyes } from '../../../../src/features-v2/abilities/Grace/ThroughYourEyes.js';
import { EndlessCharisma } from '../../../../src/features-v2/abilities/Grace/EndlessCharisma.js';
import { GraceTouched } from '../../../../src/features-v2/abilities/Grace/GraceTouched.js';
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

describe('Grace Tier 2 — Never Upstaged', () => {
  it('exposes a reviewOutcome chip when you mark HP from another creature attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...NeverUpstaged, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', amount: 2, target: char }],
        },
        actionType: 'attack',
      }
    );
    const nu = chips.find((c) => c.name === 'Never Upstaged');
    expect(nu).toBeDefined();
    expect(nu.placements).toContain('reviewOutcome');
  });

  it('bank chip marks 1 Stress and adds tokens equal to HP marked', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Never Upstaged',
      featureState: { 'Never Upstaged': {} },
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [{ stat: 'currentHP', amount: 2, target: char }],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const { chips } = runReviewOutcome(
      { ...NeverUpstaged, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        featureState: { 'Never Upstaged': {} },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', amount: 2, target: char }],
        },
        actionType: 'attack',
      }
    );
    const nu = chips.find((c) => c.name === 'Never Upstaged');
    expect(nu).toBeDefined();
    const fromUse = activateChip(nu, tbl, makeChipState());
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Never Upstaged',
          key: 'neverUpstagedTokens',
          value: 2,
        }),
      })
    );
  });

  it('onReviewAction adds +5 per token to damage and clears tokens on a successful attack', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewAction(
      { ...NeverUpstaged, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        featureState: {
          'Never Upstaged': { neverUpstagedTokens: 2 },
        },
        rolls: mockRoll({ isSuccess: true }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [],
        },
        actionType: 'attack',
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Never Upstaged',
          value: 10,
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'neverUpstagedTokens',
          value: 0,
        }),
      })
    );
  });

  it('treats pending type:damage toward me as HP marked when no currentHP effect is present', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewOutcome(
      { ...NeverUpstaged, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ type: 'damage', amount: 3, target: char }],
        },
        actionType: 'attack',
      }
    );
    const nu = chips.find((c) => c.name === 'Never Upstaged');
    expect(nu).toBeDefined();
  });
});

describe('Grace Tier 2 — Thought Delver', () => {
  it('card chip costs 1 Hope and lists targets within Far but not Very Far', () => {
    const caster = mockCharacter({
      instanceId: 'c1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'presence',
    });
    const inFar = mockAdversary({ instanceId: 'a-far', name: 'Near Guy', tokenX: 80, tokenY: 0 });
    const veryFar = mockAdversary({ instanceId: 'a-vf', name: 'Too Far', tokenX: 250, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [caster, inFar, veryFar],
      _ownerInstanceId: 'c1',
      _featureKey: 'Thought Delver',
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ThoughtDelver, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    expect(card?.hopeCost).toBe(1);
    const list = card.selectTargets?.(tbl) ?? [];
    expect(list.map((a) => a.instanceId)).toEqual(['a-far']);
  });

  it('on target pick, queues actionLoop with Spellcast trait and spendHope', () => {
    const caster = mockCharacter({
      instanceId: 'c1',
      tokenX: 0,
      tokenY: 0,
      spellcastTrait: 'knowledge',
      traits: { knowledge: 2 },
    });
    const target = mockAdversary({ instanceId: 'a1', name: 'Rival', tokenX: 40, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [caster, target],
        _ownerInstanceId: 'c1',
        _featureKey: 'Thought Delver',
      })
    );
    const chips = collectChips([{ ...ThoughtDelver, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Thought Delver',
          trait: 'Knowledge',
          description: expect.stringContaining('Spellcast (Knowledge)'),
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
  });
});

describe('Grace Tier 2 — Through Your Eyes', () => {
  it('card chip costs 1 Hope and lists other actors within Very Far (map range)', () => {
    const caster = mockCharacter({
      instanceId: 'c1',
      tokenX: 0,
      tokenY: 0,
    });
    const inRange = mockAdversary({ instanceId: 'a1', name: 'Marked', tokenX: 200, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [caster, inRange],
        _ownerInstanceId: 'c1',
        _featureKey: 'Through Your Eyes',
      })
    );
    const chips = collectChips([{ ...ThroughYourEyes, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    expect(card?.hopeCost).toBe(1);
    const list = card.selectTargets?.(tbl) ?? [];
    expect(list.map((a) => a.instanceId)).toEqual(['a1']);
  });

  it('on target pick, spends Hope, stores subject, and queues actionLoop', () => {
    const caster = mockCharacter({
      instanceId: 'c1',
      tokenX: 0,
      tokenY: 0,
      hope: 4,
    });
    const target = mockAdversary({ instanceId: 'a1', name: 'Scout', tokenX: 50, tokenY: 0 });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [caster, target],
        _ownerInstanceId: 'c1',
        _featureKey: 'Through Your Eyes',
      })
    );
    const chips = collectChips([{ ...ThroughYourEyes, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['a1'] });
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Through Your Eyes',
          key: 'throughYourEyesSubjectId',
          value: 'a1',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Through Your Eyes',
          description: expect.stringContaining('Scout'),
        }),
      })
    );
  });

  it('onIntent clears the linked subject when you begin a Spellcast action', () => {
    const { mutations } = runIntent(
      { ...ThroughYourEyes, _ownerInstanceId: 'c1' },
      {
        actionType: 'spellcast',
        _featureKey: 'Through Your Eyes',
        featureState: {
          'Through Your Eyes': { throughYourEyesSubjectId: 'adv-1' },
        },
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockAdversary({ instanceId: 'adv-1' })],
        _ownerInstanceId: 'c1',
        action: { actorInstanceId: 'c1', traitKey: 'Presence' },
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Through Your Eyes',
          key: 'throughYourEyesSubjectId',
          value: null,
        }),
      })
    );
  });
});

describe('Grace Tier 2 — Endless Charisma', () => {
  it('reviewAction chips spend 1 Hope and queue rerollDie for Hope or Fear on Presence trait rolls', () => {
    const { chips } = runReviewAction(
      { ...EndlessCharisma, _ownerInstanceId: 'c1' },
      {
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockAdversary()],
        actionType: 'trait',
        action: { traitKey: 'Presence', actorInstanceId: 'c1' },
        rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
      }
    );
    expect(chips.filter((c) => c.name?.startsWith('Endless Charisma'))).toHaveLength(2);
    const hopeChip = chips.find((c) => c.name === 'Endless Charisma — Reroll Hope');
    const fearChip = chips.find((c) => c.name === 'Endless Charisma — Reroll Fear');
    expect(hopeChip?.hopeCost).toBe(1);
    expect(fearChip?.hopeCost).toBe(1);

    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockAdversary()],
        _ownerInstanceId: 'c1',
        _featureKey: 'Endless Charisma',
        action: {
          type: 'trait',
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
          trait: 'Presence',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
      })
    );
    const collected = collectChips([{ ...EndlessCharisma, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const hc = collected.find((c) => c.name === 'Endless Charisma — Reroll Hope');
    const fromHope = activateChip(hc, tbl, makeChipState());
    deductChipCosts(hc, tbl);
    const mutH = [...fromHope, ...applyMutations(tbl)];
    expect(mutH).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(mutH).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'hopeDie' }),
      })
    );

    const tbl2 = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockAdversary()],
        _ownerInstanceId: 'c1',
        _featureKey: 'Endless Charisma',
        action: {
          type: 'trait',
          actorInstanceId: 'c1',
          targetInstanceIds: ['adv-1'],
          trait: 'Presence',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
      })
    );
    const collected2 = collectChips([{ ...EndlessCharisma, _ownerInstanceId: 'c1' }], 'reviewAction', tbl2);
    const fc = collected2.find((c) => c.name === 'Endless Charisma — Reroll Fear');
    const fromFear = activateChip(fc, tbl2, makeChipState());
    deductChipCosts(fc, tbl2);
    const mutF = [...fromFear, ...applyMutations(tbl2)];
    expect(mutF).toContainEqual(
      expect.objectContaining({
        type: 'rerollDie',
        payload: expect.objectContaining({ rollKey: 'action', dieType: 'fearDie' }),
      })
    );
  });

  it('does not offer reviewAction chips on non-Presence trait rolls', () => {
    const { chips } = runReviewAction(
      { ...EndlessCharisma, _ownerInstanceId: 'c1' },
      {
        activeElements: [mockCharacter({ instanceId: 'c1' }), mockAdversary()],
        actionType: 'trait',
        action: { traitKey: 'Agility', actorInstanceId: 'c1' },
        rolls: mockRoll(),
      }
    );
    expect(chips.filter((c) => c.name?.startsWith('Endless Charisma'))).toHaveLength(0);
  });
});

const fourGrace = () => [1, 2, 3, 4].map((i) => ({ id: `g-${i}`, domain: 'grace' }));

describe('Grace Tier 2 — Grace-Touched', () => {
  it('reviewOutcome: Armor instead of Stress clears stress and marks armor when 4+ Grace cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourGrace(),
      currentArmor: 3,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Grace-Touched',
      currentActorInstanceId: 'adv-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [{ stat: 'currentStress', target: char, amount: 2 }],
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GraceTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    const arm = chips.find((c) => c.name === 'Grace-Touched — Armor instead of Stress');
    expect(arm).toBeDefined();
    const m = [...activateChip(arm, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'markArmor',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(gs.action.effects.find((e) => e.stat === 'currentStress')?.amount).toBe(0);
  });

  it('does not clear stress when not enough armor slots', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: fourGrace(),
      currentArmor: 1,
      maxArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Grace-Touched',
      currentActorInstanceId: 'adv-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects: [{ stat: 'currentStress', target: char, amount: 2 }],
        appliedEffects: [],
      },
      rolls: mockAdversaryAttackRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GraceTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    const arm = chips.find((c) => c.name === 'Grace-Touched — Armor instead of Stress');
    const m = [...activateChip(arm, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(m.filter((x) => x.type === 'markArmor')).toHaveLength(0);
    expect(gs.action.effects.find((e) => e.stat === 'currentStress')?.amount).toBe(2);
  });

  it('does not offer conversion chips when fewer than 4 Grace domain cards', () => {
    const char = mockCharacter({
      instanceId: 'char-1',
      domainLoadout: [{ id: 'a', domain: 'grace' }],
      currentArmor: 3,
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects: [{ stat: 'currentHP', target: adv, amount: 1 }],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      })
    );
    const chips = collectChips([{ ...GraceTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    expect(chips.filter((c) => c.name?.startsWith('Grace-Touched'))).toHaveLength(0);
  });

  it('reviewOutcome: Stress instead of HP moves boxes from HP to Stress on your attack target', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourGrace() });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Grace-Touched',
      currentActorInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [{ stat: 'currentHP', target: adv, amount: 3 }],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...GraceTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    const st = chips.find((c) => c.name === 'Grace-Touched — Stress instead of HP');
    expect(st).toBeDefined();
    activateChip(st, tbl, makeChipState());
    applyMutations(tbl);
    expect(gs.action.effects.find((e) => e.stat === 'currentHP' && e.target === adv)?.amount ?? 0).toBe(0);
    expect(gs.action.effects.find((e) => e.stat === 'currentStress' && e.target === adv)?.amount).toBe(3);
  });

  it('does not offer Stress-instead-of-HP when you are not the attacker', () => {
    const char = mockCharacter({ instanceId: 'char-1', domainLoadout: fourGrace() });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        currentActorInstanceId: 'adv-1',
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          effects: [{ stat: 'currentHP', target: char, amount: 2 }],
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll(),
      })
    );
    const chips = collectChips([{ ...GraceTouched, _ownerInstanceId: 'char-1' }], 'reviewOutcome', tbl);
    expect(chips.find((c) => c.name === 'Grace-Touched — Stress instead of HP')).toBeUndefined();
  });
});
