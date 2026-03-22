import { describe, it, expect } from 'vitest';
import {
  RousingSpeech,
  HeartOfAPoet,
  Eloquent,
  EpicPoetry,
} from '../../../../src/features-v2/subclasses/Wordsmith.js';
import { collectChips, activateChip, deductChipCosts } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState, mockRoll, mockCharacter, mockAdversary, mockChipState } from '../helpers.js';

describe('Wordsmith — Epic Poetry', () => {
  it('intent chip adds d10 advantage when helping via Tag Team', () => {
    const helper = mockCharacter({ instanceId: 'helper-1', subclassId: 'srd-sub-wordsmith' });
    const initiator = mockCharacter({ instanceId: 'ally-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [helper, initiator],
        currentActorInstanceId: 'ally-1',
        _ownerInstanceId: 'helper-1',
        _featureKey: 'Epic Poetry',
        action: {
          type: 'tagTeam',
          actorInstanceId: 'ally-1',
          tagTeamPartnerInstanceId: 'helper-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll({ actionDice: [], actionStatics: [] }),
      })
    );

    const chips = collectChips([{ ...EpicPoetry, _ownerInstanceId: 'helper-1' }], 'intent', table);
    const ep = chips.find((c) => c.name === 'Epic Poetry (advantage d10)');
    expect(ep).toBeDefined();

    const fromUse = activateChip(ep, table, mockChipState());
    const mutations = [...fromUse, ...applyMutations(table)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({
          rollKey: 'action',
          name: 'Epic Poetry',
          die: 'd10',
        }),
      })
    );
  });

  it('does not offer Epic Poetry when you are the Tag Team initiator', () => {
    const helper = mockCharacter({ instanceId: 'helper-1' });
    const initiator = mockCharacter({ instanceId: 'ally-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [helper, initiator],
        _ownerInstanceId: 'ally-1',
        _featureKey: 'Epic Poetry',
        action: {
          type: 'tagTeam',
          actorInstanceId: 'ally-1',
          tagTeamPartnerInstanceId: 'helper-1',
          targetInstanceIds: ['adv-1'],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      })
    );

    const chips = collectChips([{ ...EpicPoetry, _ownerInstanceId: 'ally-1' }], 'intent', table);
    expect(chips.filter((c) => c.name?.includes('Epic Poetry'))).toHaveLength(0);
  });
});

describe('Wordsmith — Rousing Speech', () => {
  it('clears 2 Stress on each ally within Far range (long rest card)', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      currentStress: 2,
    });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      tokenX: 25,
      tokenY: 0,
      currentStress: 3,
      maxStress: 6,
    });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'b1',
        _featureKey: 'Rousing Speech',
        action: {
          type: 'free',
          actorInstanceId: 'b1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const annotated = { ...RousingSpeech, _ownerInstanceId: 'b1' };
    const chips = collectChips([annotated], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].frequency).toBe('longRest');
    expect(chips[0].disabled).toBe(false);

    chips[0].onUse(table, mockChipState());
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: { instanceId: 'ally-1', amount: 2 },
      })
    );
  });

  it('is disabled when no allies are within Far range', () => {
    const bard = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const ally = mockCharacter({ instanceId: 'ally-1', tokenX: 200, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'b1',
        _featureKey: 'Rousing Speech',
        action: {
          type: 'free',
          actorInstanceId: 'b1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...RousingSpeech, _ownerInstanceId: 'b1' }], 'card', table);
    expect(chips[0].disabled).toBe(true);
  });
});

describe('Wordsmith — Heart of a Poet', () => {
  it('reviewAction chip adds d4 on Presence rolls after spending Hope', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        _ownerInstanceId: 'char-1',
        _featureKey: 'Heart of a Poet',
        action: {
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Presence',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      })
    );

    const chips = collectChips([{ ...HeartOfAPoet, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    const hop = chips.find((c) => c.name === 'Heart of a Poet');
    expect(hop).toBeDefined();
    expect(hop.disabled).toBe(false);

    const fromUse = activateChip(hop, table, mockChipState());
    deductChipCosts(hop, table);
    const fromCost = applyMutations(table);
    const mutations = [...fromUse, ...fromCost];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'spendHope',
        payload: expect.objectContaining({ instanceId: 'char-1', amount: 1 }),
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addRollDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Heart of a Poet', die: 'd4' }),
      })
    );
  });

  it('does not expose Heart of a Poet on Agility trait rolls', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        currentActorInstanceId: 'char-1',
        _ownerInstanceId: 'char-1',
        _featureKey: 'Heart of a Poet',
        action: {
          type: 'trait',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          trait: 'Agility',
          effects: [],
          appliedEffects: [],
        },
        rolls: mockRoll(),
      })
    );

    const chips = collectChips([{ ...HeartOfAPoet, _ownerInstanceId: 'char-1' }], 'reviewAction', table);
    expect(chips.find((c) => c.name === 'Heart of a Poet')).toBeUndefined();
  });
});

describe('Wordsmith — Eloquent', () => {
  it('session card posts actionLoop when findTool option is chosen', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Eloquent',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...Eloquent, _ownerInstanceId: 'char-1' }], 'card', table);
    expect(chips[0].frequency).toBe('session');

    const st = mockChipState();
    st.set('selectedId', 'findTool');
    chips[0].onUse(table, st);
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Eloquent',
          description: 'Your ally finds a mundane object or tool they need.',
        }),
      })
    );
  });

  it('session card posts actionLoop when helpNoHope option is chosen', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Eloquent',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...Eloquent, _ownerInstanceId: 'char-1' }], 'card', table);
    const st = mockChipState();
    st.set('selectedId', 'helpNoHope');
    chips[0].onUse(table, st);
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Eloquent',
          description:
            'Help an Ally without spending Hope — resolve per SRD with the GM.',
        }),
      })
    );
  });

  it('session card posts actionLoop when extraRestMove option is chosen', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Eloquent',
        action: {
          type: 'free',
          actorInstanceId: 'char-1',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );

    const chips = collectChips([{ ...Eloquent, _ownerInstanceId: 'char-1' }], 'card', table);
    const st = mockChipState();
    st.set('selectedId', 'extraRestMove');
    chips[0].onUse(table, st);
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Eloquent',
          description:
            'Your ally gains an additional downtime move during their next rest (GM tracks).',
        }),
      })
    );
  });
});
