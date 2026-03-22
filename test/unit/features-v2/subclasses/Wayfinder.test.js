import { describe, it, expect } from 'vitest';
import {
  RuthlessPredator,
  PathForward,
  ElusivePredator,
  ApexPredator,
} from '../../../../src/features-v2/subclasses/Wayfinder.js';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  mockCharacter,
  mockAdversary,
  mockAction,
  mockGameState,
  mockRoll,
  runIntent,
  runReviewAction,
  runReviewOutcome,
} from '../helpers.js';

describe('Wayfinder — Path Forward', () => {
  it('is narrative-only (travel sense direction)', () => {
    expect(PathForward.hooks).toBeUndefined();
    expect(PathForward.chips).toBeUndefined();
    expect(PathForward.name).toBe('Path Forward');
  });
});

describe('Wayfinder — Elusive Predator', () => {
  it('queues +2 temporary evasion on intent when your Focus attacks you', () => {
    const ranger = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      focusTargetInstanceId: 'adv-1',
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });

    const { mutations } = runIntent(
      { ...ElusivePredator, _ownerInstanceId: 'char-1' },
      {
        activeElements: [ranger, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addTemporaryStatMod',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          stat: 'evasion',
          value: 2,
        }),
      })
    );
  });

  it('does not apply when the attacker is not your Focus', () => {
    const ranger = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      focusTargetInstanceId: 'adv-2',
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 4, tokenY: 0 });

    const { mutations } = runIntent(
      { ...ElusivePredator, _ownerInstanceId: 'char-1' },
      {
        activeElements: [ranger, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
        }),
      }
    );

    expect(mutations.filter((m) => m.type === 'addTemporaryStatMod')).toHaveLength(0);
  });
});

describe('Wayfinder — Ruthless Predator', () => {
  it('reviewAction chip adds +1 damage static after Stress is paid', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Ruthless Predator',
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
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...RuthlessPredator, _ownerInstanceId: 'char-1' }], 'reviewAction', tbl);
    expect(chips).toHaveLength(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Ruthless Predator',
          value: 1,
        }),
      })
    );
  });

  it('onReviewOutcome marks Stress on the adversary when Severe HP damage is dealt', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1', currentStress: 0, maxStress: 4 });
    const effects = [
      {
        stat: 'currentHP',
        amount: 3,
        target: adv,
        damageTier: 'severe',
      },
    ];

    const { mutations } = runReviewOutcome(
      { ...RuthlessPredator, _ownerInstanceId: 'char-1' },
      {
        activeElements: [c, adv],
        action: mockAction({
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects,
        }),
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });

  it('does not mark Stress on the adversary when damage is not Severe', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', amount: 1, target: adv }];

    const { mutations } = runReviewOutcome(
      { ...RuthlessPredator, _ownerInstanceId: 'char-1' },
      {
        activeElements: [c, adv],
        action: mockAction({
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          effects,
        }),
      }
    );

    expect(mutations.filter((m) => m.type === 'markStress' && m.payload?.instanceId === 'adv-1')).toHaveLength(
      0
    );
  });
});

describe('Wayfinder — Apex Predator', () => {
  it('intent chip spends Hope and arms removal of Fear on success', () => {
    const c = mockCharacter({
      instanceId: 'char-1',
      hope: 3,
      focusTargetInstanceId: 'adv-1',
    });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Apex Predator',
      featureState: { 'Apex Predator': {} },
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
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...ApexPredator, _ownerInstanceId: 'char-1' }], 'intent', tbl);
    expect(chips).toHaveLength(1);
    expect(chips[0].hopeCost).toBe(1);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'apexPredatorArmed',
          value: true,
        }),
      })
    );
  });

  it('onReviewAction spends GM Fear when armed and the attack succeeds', () => {
    const c = mockCharacter({ instanceId: 'char-1', focusTargetInstanceId: 'adv-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...ApexPredator, _ownerInstanceId: 'char-1' },
      {
        activeElements: [c, adv],
        _featureKey: 'Apex Predator',
        featureState: { 'Apex Predator': { apexPredatorArmed: true } },
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
      }
    );

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendFear',
        payload: { amount: 1 },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'apexPredatorArmed',
          value: false,
        }),
      })
    );
  });

  it('does not spend Fear when armed but the attack fails', () => {
    const c = mockCharacter({ instanceId: 'char-1', focusTargetInstanceId: 'adv-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { mutations } = runReviewAction(
      { ...ApexPredator, _ownerInstanceId: 'char-1' },
      {
        activeElements: [c, adv],
        _featureKey: 'Apex Predator',
        featureState: { 'Apex Predator': { apexPredatorArmed: true } },
        rolls: mockRoll({ isSuccess: false }),
        action: {
          type: 'attack',
          actorInstanceId: 'char-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [],
          appliedEffects: [],
        },
      }
    );

    expect(mutations.filter((m) => m.type === 'spendFear')).toHaveLength(0);
  });
});
