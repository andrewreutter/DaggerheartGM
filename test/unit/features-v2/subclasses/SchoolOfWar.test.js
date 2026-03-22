import { describe, it, expect } from 'vitest';
import { applyDeclarativeFeatures } from '../../../../src/features-v2/engine/feature-loader.js';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import {
  Battlemage,
  FaceYourFear,
  ConjureShield,
  ThriveInChaos,
  SchoolOfWarRow,
} from '../../../../src/features-v2/subclasses/SchoolOfWar.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, mockRoll } from '../helpers.js';

function annotate(feat) {
  return {
    ...feat,
    _ownerInstanceId: 'char-1',
    _sourceScopeKey: 'SchoolOfWar',
    _sourceObject: SchoolOfWarRow,
  };
}

describe('School of War', () => {
  it('Battlemage grants +1 max HP', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const { stats } = applyDeclarativeFeatures([{ ...Battlemage, _ownerInstanceId: 'char-1' }], char, {});
    expect(stats.maxHP).toBe(7);
  });

  it('Conjure Shield adds Proficiency to Evasion while Hope ≥ 2', () => {
    const charHigh = mockCharacter({ instanceId: 'char-1', hope: 3, proficiency: 2 });
    const { stats: high } = applyDeclarativeFeatures(
      [{ ...ConjureShield, _ownerInstanceId: 'char-1' }],
      charHigh,
      {}
    );
    expect(high.evasion).toBe(2);

    const charLow = mockCharacter({ instanceId: 'char-1', hope: 1, proficiency: 2 });
    const { stats: low } = applyDeclarativeFeatures(
      [{ ...ConjureShield, _ownerInstanceId: 'char-1' }],
      charLow,
      {}
    );
    expect(low.evasion).toBe(0);
  });

  it('Face Your Fear adds magic damage dice when attack succeeds with Fear dominating', () => {
    const c = mockCharacter({ instanceId: 'char-1', tier: 1 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      rolls: mockRoll({
        action: {
          hopeDie: { value: 3 },
          fearDie: { value: 9 },
          isSuccess: true,
        },
        damage: { dice: [{ name: 'weapon', die: 'd8', value: 4 }] },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(FaceYourFear)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Face Your Fear',
          die: '1d10',
        }),
      })
    );
  });

  it('Face Your Fear uses 3d10 at tier 3+', () => {
    const c = mockCharacter({ instanceId: 'char-1', tier: 3 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      rolls: mockRoll({
        action: {
          hopeDie: { value: 2 },
          fearDie: { value: 11 },
          isSuccess: true,
        },
        damage: { dice: [{ name: 'weapon', die: 'd8', value: 4 }] },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(FaceYourFear)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          die: '3d10',
        }),
      })
    );
  });

  it('Face Your Fear does not fire when Hope dominates', () => {
    const c = mockCharacter({ instanceId: 'char-1', tier: 1 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      rolls: mockRoll({
        action: {
          hopeDie: { value: 11 },
          fearDie: { value: 3 },
          isSuccess: true,
        },
        damage: { dice: [{ name: 'weapon', die: 'd8', value: 4 }] },
      }),
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'attack', actorInstanceId: 'char-1', targetInstanceIds: ['adv-1'] }),
      [annotate(FaceYourFear)]
    );
    const ra = loop.runPhase('reviewAction');
    expect(ra.mutations.filter((m) => m.type === 'addRollDie')).toHaveLength(0);
  });

  it('Thrive in Chaos: reviewAction chip marks stress and extra HP on target', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Thrive in Chaos',
      rolls: mockRoll({
        action: {
          hopeDie: { value: 8 },
          fearDie: { value: 4 },
          isSuccess: true,
        },
        damage: { dice: [{ name: 'weapon', die: 'd8', value: 4 }] },
      }),
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
    const chips = collectChips([annotate(ThriveInChaos)], 'reviewAction', tbl);
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
        type: 'markHP',
        payload: expect.objectContaining({ instanceId: 'adv-1', amount: 1 }),
      })
    );
  });
});
