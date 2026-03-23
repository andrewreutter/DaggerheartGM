import { describe, it, expect } from 'vitest';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { ShareTheBurden } from '../../../../src/features-v2/abilities/Grace/ShareTheBurden.js';
import { MassEnrapture } from '../../../../src/features-v2/abilities/Grace/MassEnrapture.js';
import { Copycat } from '../../../../src/features-v2/abilities/Grace/Copycat.js';
import { Notorious } from '../../../../src/features-v2/abilities/Grace/Notorious.js';
import { mockCharacter, mockGameState, runIntent } from '../helpers.js';

function freeActionTable(charId, featureKey) {
  return buildTableSnapshot(
    mockGameState({
      activeElements: [mockCharacter({ instanceId: charId, spellcastTrait: 'presence', traits: { presence: 2 } })],
      _ownerInstanceId: charId,
      _featureKey: featureKey,
      action: {
        type: 'free',
        actorInstanceId: charId,
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    })
  );
}

describe('Grace Tier 3 — Notorious', () => {
  it('intent chip marks 1 Stress and queues +10 static on the action roll', () => {
    const { chips } = runIntent({ ...Notorious, _ownerInstanceId: 'char-1' });
    const intentChip = chips.find((c) => c.placements?.includes('intent'));
    expect(intentChip?.stressCost).toBe(1);
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'char-1' })],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Notorious',
      })
    );
    const fromUse = activateChip(intentChip, tbl, makeChipState());
    deductChipCosts(intentChip, tbl);
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
        payload: expect.objectContaining({ rollKey: 'action', name: 'Notorious', value: 10 }),
      })
    );
  });
});

describe('Grace Tier 3 — Share the Burden', () => {
  it('selectTargets lists only other PCs in Melee with marked Stress', () => {
    const self = mockCharacter({
      instanceId: 'c-self',
      tokenX: 0,
      tokenY: 0,
      currentStress: 0,
    });
    const inMeleeStressed = mockCharacter({
      instanceId: 'c-near',
      name: 'Ally',
      tokenX: 4,
      tokenY: 0,
      currentStress: 2,
    });
    const inMeleeCalm = mockCharacter({
      instanceId: 'c-calm',
      name: 'Zen',
      tokenX: 3,
      tokenY: 0,
      currentStress: 0,
    });
    const tooFar = mockCharacter({
      instanceId: 'c-far',
      name: 'Far',
      tokenX: 40,
      tokenY: 0,
      currentStress: 4,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [self, inMeleeStressed, inMeleeCalm, tooFar],
        _ownerInstanceId: 'c-self',
        _featureKey: 'Share the Burden',
      })
    );
    const chips = collectChips([{ ...ShareTheBurden, _ownerInstanceId: 'c-self' }], 'card', tbl);
    const card = chips[0];
    expect(card?.hopeCost).toBe(0);
    const list = card.selectTargets?.(tbl) ?? [];
    expect(list.map((c) => c.instanceId)).toEqual(['c-near']);
  });

  it('onUse clears ally Stress, marks self Stress, and gains Hope', () => {
    const self = mockCharacter({
      instanceId: 'c-self',
      tokenX: 0,
      tokenY: 0,
      currentStress: 1,
      hope: 2,
    });
    const ally = mockCharacter({
      instanceId: 'c-ally',
      tokenX: 2,
      tokenY: 0,
      currentStress: 3,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [self, ally],
        _ownerInstanceId: 'c-self',
        _featureKey: 'Share the Burden',
      })
    );
    const chips = collectChips([{ ...ShareTheBurden, _ownerInstanceId: 'c-self' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['c-ally'] });
    deductChipCosts(card, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'c-ally', amount: 3 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c-self', amount: 3 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'c-self', amount: 3 }),
      })
    );
  });

  it('onUse does nothing when the chosen target is not currently eligible (e.g. out of Melee range)', () => {
    const self = mockCharacter({
      instanceId: 'c-self',
      tokenX: 0,
      tokenY: 0,
      currentStress: 0,
    });
    const outOfRange = mockCharacter({
      instanceId: 'c-far',
      tokenX: 40,
      tokenY: 0,
      currentStress: 3,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [self, outOfRange],
        _ownerInstanceId: 'c-self',
        _featureKey: 'Share the Burden',
      })
    );
    const chips = collectChips([{ ...ShareTheBurden, _ownerInstanceId: 'c-self' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['c-far'] });
    const mutations = [...fromUse, ...applyMutations(tbl)];
    expect(mutations.filter((m) => m.type === 'clearStress' || m.type === 'markStress' || m.type === 'gainHope')).toHaveLength(0);
  });
});

describe('Grace Tier 3 — Mass Enrapture', () => {
  it('main card queues Spellcast vs all in Far (3 Hope recall); Collapse has stress cost and no rest frequency', () => {
    const tbl = freeActionTable('m1', 'Mass Enrapture');
    const chips = collectChips([{ ...MassEnrapture, _ownerInstanceId: 'm1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Mass Enrapture', 'Mass Enrapture — Collapse']);
    const main = chips.find((c) => c.name === 'Mass Enrapture');
    expect(main?.hopeCost).toBe(3);
    const m = activateChip(main, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Mass Enrapture', trait: 'Presence' }),
      })
    );
    const collapse = chips.find((c) => c.name === 'Mass Enrapture — Collapse');
    expect(collapse?.frequency).toBeUndefined();
    expect(collapse?.stressCost).toBe(1);
    const m2 = activateChip(collapse, tbl, makeChipState());
    expect(m2).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Mass Enrapture — Collapse' }),
      })
    );
  });
});

describe('Grace Tier 3 — Copycat', () => {
  it('isSelect lists eight levels with Hope costs ceil(level/2)', () => {
    const tbl = freeActionTable('c1', 'Copycat');
    const chips = collectChips([{ ...Copycat, _ownerInstanceId: 'c1' }], 'card', tbl);
    expect(chips).toHaveLength(1);
    const opts = chips[0].isSelect();
    expect(opts).toHaveLength(8);
    expect(opts[0].id).toBe('1');
    expect(opts[7].id).toBe('8');
    expect(opts[7].label).toContain('4 Hope');
  });

  it('activating with level 6 spends 3 Hope and queues actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1', hope: 5 })],
        _ownerInstanceId: 'c1',
        _featureKey: 'Copycat',
        featureState: { Copycat: {} },
        action: {
          type: 'free',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...Copycat, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips[0];
    const fromUse = activateChip(card, tbl, makeChipState(), { selectedId: '6' });
    deductChipCosts(card, tbl);
    const m = [...fromUse, ...applyMutations(tbl)];
    const hope = m.filter((x) => x.type === 'spendHope');
    expect(hope.reduce((s, x) => s + (x.payload?.amount ?? 0), 0)).toBe(3);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Copycat' }),
      })
    );
  });

  it('onRest clears mimic tracking state', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1' })],
        _ownerInstanceId: 'c1',
        _featureKey: 'Copycat',
        featureState: {
          Copycat: { copycatActive: true, copycatMimicLevel: 4 },
        },
        action: {
          type: 'shortRest',
          actorInstanceId: 'c1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    Copycat.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Copycat',
          key: 'copycatActive',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Copycat',
          key: 'copycatMimicLevel',
          value: null,
        }),
      })
    );
  });
});
