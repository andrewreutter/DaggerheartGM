import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { Onslaught } from '../../../../src/features-v2/abilities/Blade/Onslaught.js';
import { mockCharacter, mockAdversary, mockGameState, mockRoll, runReviewOutcome, runReviewAction } from '../helpers.js';

const feat = { ...Onslaught, _ownerInstanceId: 'char-1' };

describe('Blade — Onslaught', () => {
  it('raises pending HP loss to 2 on a successful weapon hit that would only mark 1 HP', () => {
    const self = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: adv, amount: 1, source: self }];
    runReviewOutcome(feat, {
      activeElements: [self, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'srd-wpn-longsword',
        effects,
      },
      rolls: mockRoll({ action: { isSuccess: true } }),
    });
    expect(effects[0].amount).toBe(2);
  });

  it('does not change HP when the attack is not with a weapon', () => {
    const self = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [{ stat: 'currentHP', target: adv, amount: 1, source: self }];
    runReviewOutcome(feat, {
      activeElements: [self, adv],
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        weaponId: null,
        effects,
      },
      rolls: mockRoll({ action: { isSuccess: true } }),
    });
    expect(effects[0].amount).toBe(1);
  });

  it('shows reviewAction chip when an ally is damaged by a third-party attack within weapon range', () => {
    const blade = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      weapons: [{ id: 'w1', name: 'Sword', range: 'Melee', damage: 'd8', tier: 1 }],
    });
    const ally = mockCharacter({ instanceId: 'char-2', tokenX: 30, tokenY: 0 });
    const bad = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const { chips } = runReviewAction(feat, {
      activeElements: [blade, ally, bad],
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [
          {
            type: 'damage',
            target: ally,
            amount: 4,
            damageType: 'physical',
            source: bad,
          },
        ],
      },
      rolls: mockRoll(),
    });
    const pun = chips.filter((c) => c.name === 'Onslaught — Reaction punish');
    expect(pun).toHaveLength(1);
    expect(pun[0].stressCost).toBe(1);
  });

  it('activateChip: failed Reaction Roll marks 1 HP on the attacker', () => {
    const blade = mockCharacter({
      instanceId: 'char-1',
      tokenX: 0,
      tokenY: 0,
      weapons: [{ id: 'w1', name: 'Sword', range: 'Melee', damage: 'd8', tier: 1 }],
    });
    const ally = mockCharacter({ instanceId: 'char-2', tokenX: 40, tokenY: 0 });
    const bad = mockAdversary({ instanceId: 'adv-1', tokenX: 0, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [blade, ally, bad],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Onslaught',
      _rng: () => 0.2,
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-2'],
        effects: [
          {
            type: 'damage',
            target: ally,
            amount: 4,
            damageType: 'physical',
            source: bad,
          },
        ],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([feat], 'reviewAction', tbl);
    const pun = chips.find((c) => c.name === 'Onslaught — Reaction punish');
    expect(pun).toBeDefined();
    deductChipCosts(pun, tbl);
    const mutations = [...activateChip(pun, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });
});
