import { describe, it, expect } from 'vitest';
import { GiftedPerformer, Maestro, Virtuoso } from '../../../../src/features-v2/subclasses/Troubadour.js';
import { collectChips, activateChip, makeChipState } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { createActionLoop } from '../../../../src/features-v2/engine/action-loop.js';
import { mockCharacter, mockAdversary, mockGameState, mockAction } from '../helpers.js';

describe('Troubadour — Maestro / Virtuoso', () => {
  it('Maestro wires Rally ally choice (session-start clear + cross-sheet chip)', () => {
    expect(typeof Maestro.hooks?.onSessionStart).toBe('function');
    expect(Maestro.chips?.length).toBeGreaterThan(0);
    expect(Maestro.chips?.[0]?.showOnOtherSheets).toBe(true);
    expect(Maestro.name).toBe('Maestro');
  });

  it('Maestro chip: ally with pending Rally gift gains Hope', () => {
    const bard = mockCharacter({ instanceId: 'b1' });
    const ally = mockCharacter({ instanceId: 'c2', hope: 2, maxHope: 6, currentStress: 1 });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'c2',
        _featureKey: 'Maestro',
        featureState: { Rally: { maestroRallyChoices: { c2: null } } },
      })
    );
    const chips = collectChips([{ ...Maestro, _ownerInstanceId: 'b1' }], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0].disabled).toBe(false);
    const fromUse = activateChip(chips[0], table, makeChipState(), { selectedId: 'hope' });
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Rally',
          key: 'maestroRallyChoices',
          value: { c2: 'hope' },
        }),
      })
    );
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: expect.objectContaining({ instanceId: 'c2', amount: 1 }),
      })
    );
  });

  it('Maestro chip: ally clears Stress when choosing stress', () => {
    const bard = mockCharacter({ instanceId: 'b1' });
    const ally = mockCharacter({ instanceId: 'c2', hope: 2, maxHope: 6, currentStress: 2 });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'c2',
        _featureKey: 'Maestro',
        featureState: { Rally: { maestroRallyChoices: { c2: null } } },
      })
    );
    const chips = collectChips([{ ...Maestro, _ownerInstanceId: 'b1' }], 'card', table);
    const fromUse = activateChip(chips[0], table, makeChipState(), { selectedId: 'stress' });
    expect(fromUse).toContainEqual(
      expect.objectContaining({
        type: 'clearStress',
        payload: expect.objectContaining({ instanceId: 'c2', amount: 1 }),
      })
    );
  });

  it('Maestro chip: disabled when no pending Rally gift for this character', () => {
    const bard = mockCharacter({ instanceId: 'b1' });
    const ally = mockCharacter({ instanceId: 'c2' });
    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'c2',
        _featureKey: 'Maestro',
        featureState: { Rally: {} },
      })
    );
    const chips = collectChips([{ ...Maestro, _ownerInstanceId: 'b1' }], 'card', table);
    expect(chips[0].disabled).toBe(true);
  });

  it('Maestro onSessionStart clears maestroRallyChoices on Rally feature state', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({
        activeElements: [char],
        featureState: { Rally: { maestroRallyChoices: { c2: 'hope' } } },
      }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'char-1' }),
      [{ ...Maestro, _ownerInstanceId: 'char-1' }]
    );
    const { mutations } = loop.runPhase('intent');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Rally',
          key: 'maestroRallyChoices',
          value: null,
        }),
      })
    );
  });

  it('Virtuoso doubles Gifted Performer song uses via session-start flag', () => {
    expect(typeof Virtuoso.hooks?.onSessionStart).toBe('function');
    expect(Virtuoso.chips).toBeUndefined();
    expect(Virtuoso.name).toBe('Virtuoso');
  });

  it('Virtuoso onSessionStart sets doublesGiftedPerformer in feature state', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const loop = createActionLoop(
      mockGameState({ activeElements: [char], featureState: {} }),
      mockAction({ type: 'sessionStart', actorInstanceId: 'char-1' }),
      [{ ...Virtuoso, _ownerInstanceId: 'char-1' }]
    );
    const { mutations } = loop.runPhase('intent');
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Virtuoso',
          key: 'doublesGiftedPerformer',
          value: true,
        }),
      })
    );
  });
});

describe('Troubadour — Gifted Performer', () => {
  it('Relaxing Song clears 1 HP on self and allies in Close range', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      currentHp: 2,
      maxHp: 6,
    });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      tokenX: 20,
      tokenY: 0,
      currentHp: 1,
      maxHp: 6,
    });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'b1',
        _featureKey: 'Gifted Performer',
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

    const chips = collectChips([{ ...GiftedPerformer, _ownerInstanceId: 'b1' }], 'card', table);
    const relaxing = chips.find((c) => c.name === 'Relaxing Song');
    expect(relaxing).toBeDefined();
    expect(relaxing.disabled).toBe(false);

    const fromUse = activateChip(relaxing, table, makeChipState());
    const mutations = [...fromUse, ...applyMutations(table)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: { instanceId: 'b1', amount: 1 },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'clearHP',
        payload: { instanceId: 'ally-1', amount: 1 },
      })
    );
  });

  it('Relaxing Song is disabled when no one in Close range has a marked Hit Point', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      currentHp: 6,
      maxHp: 6,
    });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      tokenX: 10,
      tokenY: 0,
      currentHp: 6,
      maxHp: 6,
    });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'b1',
        _featureKey: 'Gifted Performer',
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

    const chips = collectChips([{ ...GiftedPerformer, _ownerInstanceId: 'b1' }], 'card', table);
    const relaxing = chips.find((c) => c.name === 'Relaxing Song');
    expect(relaxing.disabled).toBe(true);
  });

  it('Epic Song adds Vulnerable to a selected adversary in Close range', () => {
    const bard = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 25, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, adv],
        _ownerInstanceId: 'b1',
        _featureKey: 'Gifted Performer',
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

    const chips = collectChips([{ ...GiftedPerformer, _ownerInstanceId: 'b1' }], 'card', table);
    const epic = chips.find((c) => c.name === 'Epic Song');
    expect(epic.disabled).toBe(false);

    const fromUse = activateChip(epic, table, makeChipState(), { selectedTargetIds: ['adv-1'] });
    const mutations = [...fromUse, ...applyMutations(table)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'addCondition',
        payload: { instanceId: 'adv-1', condition: 'Vulnerable' },
      })
    );
  });

  it('Epic Song is disabled when no adversaries are in Close range', () => {
    const bard = mockCharacter({ instanceId: 'b1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'adv-1', tokenX: 200, tokenY: 0 });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, adv],
        _ownerInstanceId: 'b1',
        _featureKey: 'Gifted Performer',
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

    const chips = collectChips([{ ...GiftedPerformer, _ownerInstanceId: 'b1' }], 'card', table);
    const epic = chips.find((c) => c.name === 'Epic Song');
    expect(epic.disabled).toBe(true);
    expect(epic.selectTargets(table)).toHaveLength(0);
  });

  it('Heartbreaking Song grants Hope to self and allies in Close range who are not at max Hope', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      hope: 1,
      maxHope: 6,
    });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      tokenX: 15,
      tokenY: 0,
      hope: 0,
      maxHope: 6,
    });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'b1',
        _featureKey: 'Gifted Performer',
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

    const chips = collectChips([{ ...GiftedPerformer, _ownerInstanceId: 'b1' }], 'card', table);
    const heart = chips.find((c) => c.name === 'Heartbreaking Song');
    expect(heart.disabled).toBe(false);

    const fromUse = activateChip(heart, table, makeChipState());
    const mutations = [...fromUse, ...applyMutations(table)];

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: { instanceId: 'b1', amount: 1 },
      })
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'gainHope',
        payload: { instanceId: 'ally-1', amount: 1 },
      })
    );
  });

  it('Heartbreaking Song is disabled when everyone in Close range is at max Hope', () => {
    const bard = mockCharacter({
      instanceId: 'b1',
      tokenX: 0,
      tokenY: 0,
      hope: 6,
      maxHope: 6,
    });
    const ally = mockCharacter({
      instanceId: 'ally-1',
      tokenX: 12,
      tokenY: 0,
      hope: 6,
      maxHope: 6,
    });

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [bard, ally],
        _ownerInstanceId: 'b1',
        _featureKey: 'Gifted Performer',
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

    const chips = collectChips([{ ...GiftedPerformer, _ownerInstanceId: 'b1' }], 'card', table);
    const heart = chips.find((c) => c.name === 'Heartbreaking Song');
    expect(heart.disabled).toBe(true);
  });
});
