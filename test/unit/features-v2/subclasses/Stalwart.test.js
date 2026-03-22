import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import { activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  IronWill,
  LoyalProtector,
  PartnersInArms,
  Unwavering,
  Unrelenting,
  Undaunted,
} from '../../../../src/features-v2/subclasses/Stalwart.js';
import {
  mockAdversary,
  mockCharacter,
  mockGameState,
  mockAdversaryAttackRoll,
  runReviewAction,
} from '../helpers.js';

describe('Stalwart — passive damage thresholds', () => {
  const base = () =>
    mockCharacter({
      instanceId: 'char-1',
      armorThresholds: { major: 5, severe: 10 },
    });

  it('Unwavering adds +1 to major and severe thresholds', () => {
    const char = base();
    const { stats } = applyDeclarativeFeatures(
      [{ ...Unwavering, _ownerInstanceId: 'char-1' }],
      char,
      {}
    );
    expect(stats.majorThreshold).toBe(6);
    expect(stats.severeThreshold).toBe(11);
  });

  it('Unrelenting adds +2 to major and severe thresholds', () => {
    const char = base();
    const { stats } = applyDeclarativeFeatures(
      [{ ...Unrelenting, _ownerInstanceId: 'char-1' }],
      char,
      {}
    );
    expect(stats.majorThreshold).toBe(7);
    expect(stats.severeThreshold).toBe(12);
  });

  it('Undaunted adds +3 to major and severe thresholds', () => {
    const char = base();
    const { stats } = applyDeclarativeFeatures(
      [{ ...Undaunted, _ownerInstanceId: 'char-1' }],
      char,
      {}
    );
    expect(stats.majorThreshold).toBe(8);
    expect(stats.severeThreshold).toBe(13);
  });

  it('stacks all three features for +6 total to each threshold', () => {
    const char = base();
    const { stats } = applyDeclarativeFeatures(
      [
        { ...Unwavering, _ownerInstanceId: 'char-1' },
        { ...Unrelenting, _ownerInstanceId: 'char-1' },
        { ...Undaunted, _ownerInstanceId: 'char-1' },
      ],
      char,
      {}
    );
    expect(stats.majorThreshold).toBe(11);
    expect(stats.severeThreshold).toBe(16);
  });
});

describe('Stalwart — Iron Will', () => {
  it('reviewAction chip marks 1 armor and reduces incoming physical damage by 1 when used', () => {
    const char = mockCharacter({ instanceId: 'char-1', currentArmor: 3, maxArmor: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1' },
        amount: 4,
        damageType: 'physical',
      },
    ];

    const { chips } = runReviewAction(
      { ...IronWill, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].armorMark).toBe(1);

    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Iron Will',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });

    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chips[0], tbl, makeChipState());
    deductChipCosts(chips[0], tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];

    expect(effects[0].amount).toBe(3);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markArmor',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('does not offer Iron Will when damage is not physical', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...IronWill, _ownerInstanceId: 'char-1' },
      {
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['char-1'],
          trait: 'Agility',
          range: 'melee',
          effects: [
            {
              type: 'damage',
              target: { instanceId: 'char-1' },
              amount: 4,
              damageType: 'magic',
            },
          ],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(chips).toHaveLength(0);
  });
});

describe('Stalwart — Partners-in-Arms', () => {
  it('reviewAction chip marks armor and reduces ally physical damage when ally is in Very Close', () => {
    const stalwart = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0, currentArmor: 3, maxArmor: 3 });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      name: 'Ally',
      tokenX: 8,
      tokenY: 0,
      currentHp: 4,
      maxHp: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'ally-1' },
        amount: 4,
        damageType: 'physical',
        source: adv,
      },
    ];

    const { chips } = runReviewAction(
      { ...PartnersInArms, _ownerInstanceId: 'g1' },
      {
        activeElements: [stalwart, ally, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          trait: 'Agility',
          range: 'melee',
          effects,
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].armorMark).toBe(1);

    const gs = mockGameState({
      activeElements: [stalwart, ally, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Partners-in-Arms',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['ally-1'],
        trait: 'Agility',
        range: 'melee',
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });

    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['ally-1'] });
    deductChipCosts(chips[0], tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];

    expect(effects[0].amount).toBe(3);
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markArmor',
        payload: expect.objectContaining({ instanceId: 'g1', amount: 1 }),
      })
    );
  });

  it('does not offer Partners-in-Arms when ally is not in Very Close range', () => {
    const stalwart = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 50, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...PartnersInArms, _ownerInstanceId: 'g1' },
      {
        activeElements: [stalwart, ally, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects: [
            {
              type: 'damage',
              target: { instanceId: 'ally-1' },
              amount: 3,
              damageType: 'physical',
              source: adv,
            },
          ],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(chips).toHaveLength(0);
  });
});

describe('Stalwart — Loyal Protector', () => {
  it('redirects damage to the stalwart when ally has ≤2 HP and is in Close range', () => {
    const stalwart = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0, name: 'Tank' });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      name: 'Squishy',
      tokenX: 20,
      tokenY: 0,
      currentHp: 2,
      maxHp: 6,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 25, tokenY: 0 });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'ally-1' },
        amount: 3,
        damageType: 'physical',
        source: adv,
      },
    ];

    const { chips } = runReviewAction(
      { ...LoyalProtector, _ownerInstanceId: 'g1' },
      {
        activeElements: [stalwart, ally, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects,
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );

    expect(chips).toHaveLength(1);
    expect(chips[0].stressCost).toBe(1);

    const gs = mockGameState({
      activeElements: [stalwart, ally, adv],
      _ownerInstanceId: 'g1',
      _featureKey: 'Loyal Protector',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['ally-1'],
        effects,
      },
      rolls: mockAdversaryAttackRoll({ isSuccess: true }),
    });

    const tbl = buildTableSnapshot(gs);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedTargetIds: ['ally-1'] });
    deductChipCosts(chips[0], tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];

    expect(effects[0].target.instanceId).toBe('g1');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'g1', amount: 1 }),
      })
    );
  });

  it('does not offer Loyal Protector when ally has more than 2 HP', () => {
    const stalwart = mockCharacter({ instanceId: 'g1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 20, tokenY: 0, currentHp: 5, maxHp: 6 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { chips } = runReviewAction(
      { ...LoyalProtector, _ownerInstanceId: 'g1' },
      {
        activeElements: [stalwart, ally, adv],
        action: {
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['ally-1'],
          effects: [
            {
              type: 'damage',
              target: { instanceId: 'ally-1' },
              amount: 2,
              damageType: 'physical',
              source: adv,
            },
          ],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      }
    );
    expect(chips).toHaveLength(0);
  });
});
