import { describe, it, expect } from 'vitest';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { collectChips, activateChip, deductChipCosts, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { DeftDeceiver } from '../../../../src/features-v2/abilities/Grace/DeftDeceiver.js';
import { Enrapture } from '../../../../src/features-v2/abilities/Grace/Enrapture.js';
import { InspirationalWords } from '../../../../src/features-v2/abilities/Grace/InspirationalWords.js';
import { TellNoLies } from '../../../../src/features-v2/abilities/Grace/TellNoLies.js';
import { Troublemaker } from '../../../../src/features-v2/abilities/Grace/Troublemaker.js';
import { HypnoticShimmer } from '../../../../src/features-v2/abilities/Grace/HypnoticShimmer.js';
import { Invisibility } from '../../../../src/features-v2/abilities/Grace/Invisibility.js';
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

describe('Grace Tier 1 — Deft Deceiver', () => {
  it('intent chip spends 1 Hope and queues addAdvantageDie on the action roll', () => {
    const { chips } = runIntent({ ...DeftDeceiver, _ownerInstanceId: 'c1' });
    const intentChip = chips.find((c) => c.placements?.includes('intent'));
    expect(intentChip?.hopeCost).toBe(1);
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1' })],
        _ownerInstanceId: 'c1',
        _featureKey: 'Deft Deceiver',
      })
    );
    const fromUse = activateChip(intentChip, tbl, makeChipState());
    deductChipCosts(intentChip, tbl);
    const fromCost = applyMutations(tbl);
    const mutations = [...fromUse, ...fromCost];
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addAdvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Deft Deceiver' }),
      })
    );
  });
});

describe('Grace Tier 1 — Enrapture', () => {
  it('main card queues Spellcast actionLoop; Shared Duress has rest frequency and stress cost', () => {
    const tbl = freeActionTable('e1', 'Enrapture');
    const chips = collectChips([{ ...Enrapture, _ownerInstanceId: 'e1' }], 'card', tbl);
    expect(chips.map((c) => c.name)).toEqual(['Enrapture', 'Enrapture — Shared Duress']);
    const main = chips.find((c) => c.name === 'Enrapture');
    const m = activateChip(main, tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Enrapture', trait: 'Presence' }),
      })
    );
    const shared = chips.find((c) => c.name === 'Enrapture — Shared Duress');
    expect(shared?.frequency).toBe('rest');
    expect(shared?.stressCost).toBe(1);
  });
});

describe('Grace Tier 1 — Tell No Lies', () => {
  it('card queues Spellcast actionLoop with trait', () => {
    const tbl = freeActionTable('t1', 'Tell No Lies');
    const chips = collectChips([{ ...TellNoLies, _ownerInstanceId: 't1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Tell No Lies', trait: 'Presence' }),
      })
    );
  });
});

describe('Grace Tier 1 — Inspirational Words', () => {
  it('onRest (long rest) sets tokens to Presence via setFeatureState', () => {
    const char = mockCharacter({ instanceId: 'i1', traits: { presence: 3 } });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'i1',
      _featureKey: 'Inspirational Words',
      featureState: { 'Inspirational Words': {} },
      action: {
        type: 'longRest',
        actorInstanceId: 'i1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    InspirationalWords.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Inspirational Words',
          key: 'inspirationalWordsTokens',
          value: 3,
        }),
      })
    );
  });

  it('spending a token decrements count and queues actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'i2', traits: { presence: 2 } })],
        _ownerInstanceId: 'i2',
        _featureKey: 'Inspirational Words',
        featureState: { 'Inspirational Words': { inspirationalWordsTokens: 2 } },
        action: {
          type: 'free',
          actorInstanceId: 'i2',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...InspirationalWords, _ownerInstanceId: 'i2' }], 'card', tbl);
    const fromUse = activateChip(chips[0], tbl, makeChipState(), { selectedId: 'gainHope' });
    const m = [...fromUse, ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'inspirationalWordsTokens',
          value: 1,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Inspirational Words' }),
      })
    );
  });

  it('is disabled when no tokens remain', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'i3' })],
        _ownerInstanceId: 'i3',
        _featureKey: 'Inspirational Words',
        featureState: { 'Inspirational Words': { inspirationalWordsTokens: 0 } },
        action: {
          type: 'free',
          actorInstanceId: 'i3',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...InspirationalWords, _ownerInstanceId: 'i3' }], 'card', tbl);
    expect(chips[0].isDisabled?.(tbl)).toBe(true);
  });
});

describe('Grace Tier 1 — Troublemaker', () => {
  it('card has rest frequency and queues actionLoop with Proficiency in prompt', () => {
    const tbl = freeActionTable('tr1', 'Troublemaker');
    const chips = collectChips([{ ...Troublemaker, _ownerInstanceId: 'tr1' }], 'card', tbl);
    expect(chips[0].frequency).toBe('rest');
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Troublemaker',
          description: expect.stringContaining('1d4'),
        }),
      })
    );
  });
});

describe('Grace Tier 1 — Hypnotic Shimmer', () => {
  it('card is once per rest and queues Spellcast actionLoop vs adversaries in front within Close', () => {
    const tbl = freeActionTable('hs1', 'Hypnotic Shimmer');
    const chips = collectChips([{ ...HypnoticShimmer, _ownerInstanceId: 'hs1' }], 'card', tbl);
    expect(chips[0].frequency).toBe('rest');
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Hypnotic Shimmer',
          description: expect.stringMatching(/front of you.*Close range/i),
          trait: 'Presence',
        }),
      })
    );
  });

  it('does not register intent-placement chips', () => {
    const tbl = freeActionTable('hs2', 'Hypnotic Shimmer');
    const intent = collectChips([{ ...HypnoticShimmer, _ownerInstanceId: 'hs2' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});

describe('Grace Tier 1 — Invisibility', () => {
  it('card queues Spellcast (10) actionLoop with token and disadvantage notes', () => {
    const tbl = freeActionTable('inv1', 'Invisibility');
    const chips = collectChips([{ ...Invisibility, _ownerInstanceId: 'inv1' }], 'card', tbl);
    const m = activateChip(chips[0], tbl, makeChipState());
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Invisibility',
          description: expect.stringMatching(/\(10\).*Melee range/i),
          trait: 'Presence',
        }),
      })
    );
    expect(
      m.find((x) => x.type === 'actionLoop')?.payload?.description
    ).toMatch(/disadvantage/i);
  });

  it('does not register intent-placement chips', () => {
    const tbl = freeActionTable('inv2', 'Invisibility');
    const intent = collectChips([{ ...Invisibility, _ownerInstanceId: 'inv2' }], 'intent', tbl);
    expect(intent).toEqual([]);
  });
});
