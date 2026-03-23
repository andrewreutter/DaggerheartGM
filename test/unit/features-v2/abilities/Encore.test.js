import { describe, it, expect } from 'vitest';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { Encore } from '../../../../src/features-v2/abilities/Grace/Encore.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, mockAction } from '../helpers.js';

function allyAttackGs(overrides = {}) {
  const self = mockCharacter({
    instanceId: 'c-self',
    tokenX: 0,
    tokenY: 0,
    spellcastTrait: 'presence',
  });
  const ally = mockCharacter({
    instanceId: 'c-ally',
    name: 'Ally',
    tokenX: 12,
    tokenY: 0,
  });
  const adv = mockAdversary({
    instanceId: 'adv-1',
    name: 'Goblin',
    tokenX: 30,
    tokenY: 0,
    difficulty: 11,
  });
  return mockGameState({
    activeElements: [self, ally, adv],
    _ownerInstanceId: 'c-self',
    _featureKey: 'Encore',
    featureState: { Encore: {} },
    currentActorInstanceId: 'c-ally',
    action: {
      type: 'attack',
      actorInstanceId: 'c-ally',
      targetInstanceIds: ['adv-1'],
      trait: 'Agility',
      range: 'melee',
      effects: [
        {
          type: 'damage',
          target: { instanceId: 'adv-1' },
          amount: 6,
          damageType: 'physical',
        },
      ],
      appliedEffects: [],
    },
    rolls: mockRoll({ isSuccess: true }),
    ...overrides,
  });
}

describe('Grace — Encore', () => {
  it('offers reviewAction chip when an ally in Close range deals damage to an adversary', () => {
    const gs = allyAttackGs();
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Encore, _ownerInstanceId: 'c-self' }], 'reviewAction', tbl);
    expect(chips.some((c) => c.name === 'Encore')).toBe(true);
    expect(chips.find((c) => c.name === 'Encore')?.hopeCost).toBe(1);
  });

  it('does not offer the chip when you are the attacker', () => {
    const self = mockCharacter({ instanceId: 'c-self', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 20, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'c-self',
      _featureKey: 'Encore',
      featureState: { Encore: {} },
      currentActorInstanceId: 'c-self',
      action: {
        type: 'attack',
        actorInstanceId: 'c-self',
        targetInstanceIds: ['adv-1'],
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 3, damageType: 'physical' },
        ],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Encore, _ownerInstanceId: 'c-self' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Encore')).toHaveLength(0);
  });

  it('does not offer the chip when the ally is beyond Close range of you', () => {
    const self = mockCharacter({ instanceId: 'c-self', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'c-ally', tokenX: 200, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 210, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [self, ally, adv],
      _ownerInstanceId: 'c-self',
      _featureKey: 'Encore',
      featureState: { Encore: {} },
      currentActorInstanceId: 'c-ally',
      action: {
        type: 'attack',
        actorInstanceId: 'c-ally',
        targetInstanceIds: ['adv-1'],
        effects: [
          { type: 'damage', target: { instanceId: 'adv-1' }, amount: 2, damageType: 'physical' },
        ],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...Encore, _ownerInstanceId: 'c-self' }], 'reviewAction', tbl);
    expect(chips.filter((c) => c.name === 'Encore')).toHaveLength(0);
  });

  it('reviewAction chip queues actionLoop and pending mirror damage', () => {
    const gs = allyAttackGs();
    const tbl = buildTableSnapshot(gs);
    const chip = collectChips([{ ...Encore, _ownerInstanceId: 'c-self' }], 'reviewAction', tbl).find(
      (c) => c.name === 'Encore'
    );
    const m = [...activateChip(chip, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Encore',
          key: 'encorePending',
          value: expect.objectContaining({ amount: 6, targetId: 'adv-1', damageType: 'physical' }),
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Encore',
          instanceId: 'c-self',
          difficulty: 11,
        }),
      })
    );
    deductChipCosts(chip, tbl);
    expect(applyMutations(tbl)).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c-self', amount: 1 }),
      })
    );
  });

  it('onReviewAction mirrors damage on a successful Encore spellcast and vaults on succeed with Fear', () => {
    const self = mockCharacter({
      instanceId: 'c-self',
      tokenX: 0,
      tokenY: 0,
    });
    const adv = mockAdversary({ instanceId: 'adv-1', difficulty: 12 });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'c-self',
      _featureKey: 'Encore',
      featureState: {
        Encore: {
          encoreSpellcastActive: true,
          encorePending: { amount: 5, targetId: 'adv-1', damageType: 'magic' },
        },
      },
      action: {
        type: 'spellcast',
        actorInstanceId: 'c-self',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true, hopeValue: 3, fearValue: 9 }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'spellcast', actorInstanceId: 'c-self', targetInstanceIds: ['adv-1'] }),
      [{ ...Encore, _ownerInstanceId: 'c-self' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDamageRoll',
        payload: expect.objectContaining({
          name: 'Encore',
          dice: '5d1',
          damageType: 'magic',
          targetInstanceIds: ['adv-1'],
        }),
      })
    );
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'domainCardMoveToVault',
        payload: expect.objectContaining({ instanceId: 'c-self', cardId: 'srd-abl-encore' }),
      })
    );
  });

  it('does not vault when the spellcast succeeds with Hope (Fear not higher)', () => {
    const self = mockCharacter({ instanceId: 'c-self', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [self, adv],
      _ownerInstanceId: 'c-self',
      _featureKey: 'Encore',
      featureState: {
        Encore: {
          encoreSpellcastActive: true,
          encorePending: { amount: 3, targetId: 'adv-1', damageType: 'physical' },
        },
      },
      action: {
        type: 'spellcast',
        actorInstanceId: 'c-self',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ isSuccess: true, hopeValue: 10, fearValue: 4 }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'spellcast', actorInstanceId: 'c-self', targetInstanceIds: ['adv-1'] }),
      [{ ...Encore, _ownerInstanceId: 'c-self' }]
    );
    loop.setRolls(gs.rolls);
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations.some((m) => m.type === 'domainCardMoveToVault')).toBe(false);
    expect(ra.mutations.some((m) => m.type === 'addDamageRoll')).toBe(true);
  });
});
