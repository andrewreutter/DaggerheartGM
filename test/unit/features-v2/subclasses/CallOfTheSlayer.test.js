import { describe, it, expect } from 'vitest';
import {
  Slayer,
  WeaponSpecialist,
  MartialPreparation,
  CallOfTheSlayerRow,
} from '../../../../src/features-v2/subclasses/CallOfTheSlayer.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import {
  activateChip,
  collectChips,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction, mockRoll } from '../helpers.js';

function annotate(feat) {
  return {
    ...feat,
    _ownerInstanceId: 'char-1',
    _sourceScopeKey: 'CallOfTheSlayer',
    _sourceObject: CallOfTheSlayerRow,
  };
}

/** `table.source` needs `_activeFeature` + scope (see `buildTableSnapshot`). */
function tableForFeature(gs, feat) {
  return buildTableSnapshot({
    ...gs,
    _activeFeature: annotate(feat),
    _featureKey: feat.name,
  });
}

const dualWeapons = {
  weapons: [
    { id: 'w-primary', name: 'Longsword', damage: 'd8', trait: 'Strength', baseRange: 'melee' },
    { id: 'w-secondary', name: 'Dagger', damage: 'd4', trait: 'Finesse', baseRange: 'melee' },
  ],
};

describe('Call of the Slayer — Slayer', () => {
  it('onSessionStart clears Slayer pool and grants 1 Hope per unspent die (idempotent)', () => {
    const c = mockCharacter({ instanceId: 'char-1', hope: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      featureState: { CallOfTheSlayer: { slayerDiceCount: 2 } },
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'sessionStart', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      [annotate(Slayer)]
    );
    const a = loop.runPhase('intent');
    expect(a.mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 2 }),
      })
    );
    expect(a.mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'CallOfTheSlayer',
          key: 'slayerDiceCount',
          value: 0,
        }),
      })
    );
    const b = loop.runPhase('intent');
    expect(b.mutations.filter((m) => m.type === 'gainHope')).toHaveLength(0);
  });

  it('reviewAction bank chip adds a Slayer d6 when Hope dominates and pool below Proficiency', () => {
    const c = mockCharacter({ instanceId: 'char-1', proficiency: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Slayer',
      featureState: { CallOfTheSlayer: {} },
      rolls: {
        action: {
          hopeDie: { value: 9 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
          isSuccess: true,
        },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = tableForFeature(gs, Slayer);
    const chips = collectChips([annotate(Slayer)], 'reviewAction', tbl);
    const bank = chips.find((ch) => ch.name === 'Slayer (bank d6)');
    expect(bank?.name).toBe('Slayer (bank d6)');
    expect(bank.disabled).toBe(false);
    const after = [...activateChip(bank, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(after).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'CallOfTheSlayer',
          key: 'slayerDiceCount',
          value: 1,
        }),
      })
    );
  });

  it('intent spend chip rolls Slayer dice and adds static to the action roll', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    let call = 0;
    const faces = [0.1, 0.1];
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Slayer',
      featureState: { CallOfTheSlayer: { slayerDiceCount: 2 } },
      _rng: () => faces[Math.min(call++, faces.length - 1)],
      rolls: mockRoll({ actionDice: [], actionStatics: [] }),
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = tableForFeature(gs, Slayer);
    const spend = collectChips([annotate(Slayer)], 'intent', tbl).find(
      (ch) => ch.name === 'Slayer (spend on action roll)'
    );
    expect(spend?.name).toBe('Slayer (spend on action roll)');
    const m = [...activateChip(spend, tbl, makeChipState(), { selectedId: '2' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Slayer', value: 2 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'CallOfTheSlayer',
          key: 'slayerDiceCount',
          value: 0,
        }),
      })
    );
  });

  it('reviewAction spend chip adds static to the damage roll', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      featureState: { CallOfTheSlayer: { slayerDiceCount: 1 } },
      _rng: () => 0.99,
      rolls: {
        action: { hopeDie: { value: 5 }, fearDie: { value: 3 }, isSuccess: true },
        damage: { dice: [{ name: 'weapon', die: 'd8', value: 4 }], statics: [] },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = tableForFeature(gs, Slayer);
    const spend = collectChips([annotate(Slayer)], 'reviewAction', tbl).find(
      (ch) => ch.name === 'Slayer (spend on damage roll)'
    );
    const m = [...activateChip(spend, tbl, makeChipState(), { selectedId: '1' }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollStatic',
        payload: expect.objectContaining({ rollKey: 'damage', name: 'Slayer', value: 6 }),
      })
    );
  });
});

describe('Call of the Slayer — Weapon Specialist', () => {
  it('reviewAction adds secondary weapon damage die on successful primary attack for 1 Hope', () => {
    const c = mockCharacter({ instanceId: 'char-1', hope: 4, ...dualWeapons });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Weapon Specialist',
      featureState: { CallOfTheSlayer: {} },
      rolls: {
        action: { hopeDie: { value: 8 }, fearDie: { value: 2 }, isSuccess: true },
        damage: { dice: [{ name: 'weapon', die: 'd8', value: 5 }], statics: [] },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-primary',
        trait: 'Strength',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = tableForFeature(gs, WeaponSpecialist);
    const chips = collectChips([annotate(WeaponSpecialist)], 'reviewAction', tbl);
    const ws = chips.find((ch) => ch.description?.includes('secondary weapon'));
    expect(ws?.hopeCost).toBe(1);
    deductChipCosts(ws, tbl);
    const m = [...activateChip(ws, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'damage',
          name: 'Weapon Specialist',
          die: 'd4',
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
  });

  it('does not offer Weapon Specialist when attacking with the secondary weapon', () => {
    const c = mockCharacter({ instanceId: 'char-1', hope: 4, ...dualWeapons });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Weapon Specialist',
      rolls: {
        action: { isSuccess: true },
        damage: { dice: [], statics: [] },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        weaponId: 'w-secondary',
        trait: 'Finesse',
        range: 'melee',
        effects: [],
        appliedEffects: [],
      },
    });
    const tbl = tableForFeature(gs, WeaponSpecialist);
    const chips = collectChips([annotate(WeaponSpecialist)], 'reviewAction', tbl);
    expect(chips.filter((ch) => ch.description?.includes('secondary weapon'))).toHaveLength(0);
  });

  it('onRest (long rest) refreshes Slayer reroll-1s availability', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      featureState: { CallOfTheSlayer: { weaponSpecialistSlayerRerollAvailable: false } },
    });
    const loop = createActionLoop(
      gs,
      mockAction({ type: 'longRest', actorInstanceId: 'char-1', targetInstanceIds: [] }),
      [annotate(WeaponSpecialist)]
    );
    const { mutations } = loop.runPhase('intent');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'CallOfTheSlayer',
          key: 'weaponSpecialistSlayerRerollAvailable',
          value: true,
        }),
      })
    );
  });
});

describe('Call of the Slayer — Martial Preparation', () => {
  it('long-rest card queues actionLoop for GM distribution of Slayer dice', () => {
    const c = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const gs = mockGameState({
      activeElements: [c, adv],
      _ownerInstanceId: 'char-1',
      _featureKey: 'Martial Preparation',
    });
    const tbl = tableForFeature(gs, MartialPreparation);
    const chips = collectChips([annotate(MartialPreparation)], 'card', tbl);
    const card = chips[0];
    const m = [...activateChip(card, tbl, makeChipState()), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Martial Preparation' }),
      })
    );
  });
});
