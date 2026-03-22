import { describe, it, expect } from 'vitest';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { ManipulateMagic, EnchantedAid, ArcaneCharge } from '../../../../src/features-v2/subclasses/PrimalOrigin.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewOutcome,
} from '../helpers.js';

const PO_ROW = { sourceScopeKey: 'PrimalOrigin' };

describe('Primal Origin — Manipulate Magic', () => {
  const ann = { ...ManipulateMagic, _ownerInstanceId: 's1', _sourceObject: PO_ROW };

  it('intent +2 action marks Stress and queues addRollStatic on spellcast', () => {
    const w = mockCharacter({ instanceId: 's1', currentStress: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [w, adv],
      _ownerInstanceId: 's1',
      _featureKey: 'Manipulate Magic',
      action: mockAction({ type: 'spellcast', actorInstanceId: 's1', targetInstanceIds: ['adv-1'] }),
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'intent', tbl);
    const plus2 = chips.find((c) => c.name === 'Manipulate Magic (+2 action)');
    expect(plus2).toBeDefined();
    const fromUse = activateChip(plus2, tbl, makeChipState());
    deductChipCosts(plus2, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', value: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 's1', amount: 1 }),
      })
    );
  });

  it('reviewAction double die duplicates selected damage die', () => {
    const w = mockCharacter({ instanceId: 's1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [w, adv],
      _ownerInstanceId: 's1',
      _featureKey: 'Manipulate Magic',
      action: mockAction({
        type: 'spellcast',
        actorInstanceId: 's1',
        targetInstanceIds: ['adv-1'],
        trait: 'instinct',
        effects: [],
      }),
      rolls: mockRoll({
        damageDice: [{ name: 'spell', die: 'd8', value: 4 }],
      }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'reviewAction', tbl);
    const dbl = chips.find((c) => c.name === 'Manipulate Magic (double die)');
    expect(dbl).toBeDefined();
    const fromUse = activateChip(dbl, tbl, makeChipState(), { selectedId: 'spell' });
    deductChipCosts(dbl, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          die: 'd8',
        }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 's1', amount: 1 }),
      })
    );
  });
});

describe('Primal Origin — Enchanted Aid', () => {
  const ann = { ...EnchantedAid, _ownerInstanceId: 'helper', _sourceObject: PO_ROW };

  it('intent: d8 die when helping ally tag-team spellcast', () => {
    const ally = mockCharacter({ instanceId: 'ally-1', spellcastTrait: 'instinct' });
    const helper = mockCharacter({ instanceId: 'helper' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [ally, helper, adv],
      _ownerInstanceId: 'helper',
      _featureKey: 'Enchanted Aid',
      action: {
        type: 'tagTeam',
        actorInstanceId: 'ally-1',
        targetInstanceIds: ['adv-1'],
        tagTeamPartnerInstanceId: 'helper',
        trait: 'instinct',
        range: 'close',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'intent', tbl);
    const d8 = chips.find((c) => c.name === 'Enchanted Aid (d8)');
    expect(d8).toBeDefined();
    const fromUse = activateChip(d8, tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Enchanted Aid', die: 'd8' }),
      })
    );
  });

  it('reviewAction: swap Duality queues swapHopeFearDice (long-rest frequency on chip)', () => {
    const ally = mockCharacter({ instanceId: 'ally-1', spellcastTrait: 'instinct' });
    const helper = mockCharacter({ instanceId: 'helper' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [ally, helper, adv],
      _ownerInstanceId: 'helper',
      _featureKey: 'Enchanted Aid',
      action: {
        type: 'tagTeam',
        actorInstanceId: 'ally-1',
        targetInstanceIds: ['adv-1'],
        tagTeamPartnerInstanceId: 'helper',
        trait: 'instinct',
        range: 'close',
        effects: [],
        appliedEffects: [],
      },
      rolls: mockRoll({ hopeValue: 3, fearValue: 9 }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'reviewAction', tbl);
    const swap = chips.find((c) => c.name === 'Enchanted Aid (swap Duality)');
    expect(swap).toBeDefined();
    const fromUse = activateChip(swap, tbl, makeChipState());
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'swapHopeFearDice',
        payload: expect.objectContaining({ rollKey: 'action' }),
      })
    );
    expect(tbl.rolls.action.hopeDie.value).toBe(9);
    expect(tbl.rolls.action.fearDie.value).toBe(3);
  });
});

describe('Primal Origin — Arcane Charge', () => {
  const ann = { ...ArcaneCharge, _ownerInstanceId: 'c1', _sourceObject: PO_ROW };

  it('onReviewOutcome: magic HP loss adds Charged', () => {
    const c = mockCharacter({ instanceId: 'c1', conditions: [] });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const { mutations } = runReviewOutcome(
      { ...ArcaneCharge, _ownerInstanceId: 'c1' },
      {
        activeElements: [c, adv],
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'adv-1',
          targetInstanceIds: ['c1'],
          effects: [
            { stat: 'currentHP', target: c, amount: 2, damageType: 'magic', source: adv },
          ],
        }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ instanceId: 'c1', condition: 'Charged' }),
      })
    );
  });

  it('reviewAction discharge +10 damage clears Charged', () => {
    const c = mockCharacter({ instanceId: 'c1', conditions: ['Charged'] });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Arcane Charge',
      action: mockAction({
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        effects: [
          {
            type: 'damage',
            damageType: 'magic',
            amount: 3,
            target: adv,
            source: c,
          },
        ],
      }),
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'reviewAction', tbl);
    const disc = chips.find((c) => c.name === 'Arcane Charge (discharge)');
    expect(disc).toBeDefined();
    const fromUse = activateChip(disc, tbl, makeChipState(), { selectedId: 'dmg10' });
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', value: 10 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'removeCondition',
        payload: expect.objectContaining({ instanceId: 'c1', condition: 'Charged' }),
      })
    );
  });

  it('card spends 2 Hope to add Charged', () => {
    const c = mockCharacter({ instanceId: 'c1', hope: 4, conditions: [] });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Arcane Charge',
      action: mockAction({ type: 'free', actorInstanceId: 'c1', targetInstanceIds: [] }),
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([ann], 'card', tbl);
    expect(chips.length).toBeGreaterThan(0);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState());
    deductChipCosts(card, tbl);
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 2 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: expect.objectContaining({ instanceId: 'c1', condition: 'Charged' }),
      })
    );
  });
});
