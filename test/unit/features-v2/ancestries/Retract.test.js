import { describe, it, expect } from 'vitest';
import { collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations } from '../../../../src/features-v2/engine/table.js';
import { isWhen } from '../../../../src/features-v2/engine/when.js';
import { mockTable, mockChipState, runReviewAction, runIntent, mockCharacter, mockAdversary } from '../helpers.js';
import { Retract } from '../../../../src/features-v2/ancestries/Galapa.js';

describe('Retract', () => {
  it('has a card chip with toggle', () => {
    const table = mockTable();
    const annotatedFeature = {
      ...Retract,
      _ownerInstanceId: 'char-1',
    };
    const chips = collectChips([annotatedFeature], 'card', table);
    expect(chips).toHaveLength(1);
    expect(chips[0]._featureName).toBe('Retract');
    expect(chips[0].isToggle).toBe(true);
    expect(chips[0].stressCost).toBe(1);
  });

  it('queues actionLoop mutation when toggle chip activates', () => {
    const table = mockTable();
    const annotatedFeature = {
      ...Retract,
      _ownerInstanceId: 'char-1',
    };
    const chips = collectChips([annotatedFeature], 'card', table);
    chips[0].onUse(table, mockChipState({ _isOn: true }));
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          instanceId: 'char-1',
          title: 'Retract',
          description: 'Retracting into shell for protection.',
        }),
      })
    );
  });

  it('queues restrictMovement mutation when toggling ON (retracting)', () => {
    const table = mockTable();
    const annotatedFeature = { ...Retract, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotatedFeature], 'card', table);
    chips[0].onUse(table, mockChipState({ _isOn: true }));
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'restrictMovement',
        payload: expect.objectContaining({ instanceId: 'char-1' }),
      })
    );
    expect(mutations).not.toContainEqual(
      expect.objectContaining({ type: 'allowMovement' })
    );
  });

  it('queues allowMovement mutation when toggling OFF (emerging)', () => {
    const table = mockTable();
    const annotatedFeature = { ...Retract, _ownerInstanceId: 'char-1' };
    const chips = collectChips([annotatedFeature], 'card', table);
    chips[0].onUse(table, mockChipState({ _isOn: false }));
    const mutations = applyMutations(table);

    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'allowMovement',
        payload: expect.objectContaining({ instanceId: 'char-1' }),
      })
    );
    expect(mutations).not.toContainEqual(
      expect.objectContaining({ type: 'restrictMovement' })
    );
  });

  it('uses when() for onReviewAction (no early return)', () => {
    expect(Retract.hooks).toBeDefined();
    expect(Retract.hooks.onReviewAction).toBeDefined();
    expect(isWhen(Retract.hooks.onReviewAction)).toBe(true);
  });

  it('adds disadvantage die to action roll when retracted and acting', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runIntent(Retract, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: { Retract: { retracted: true } },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: {
        action: {
          hopeDie: { value: 7 },
          fearDie: { value: 4 },
          dice: [],
          statics: [],
        },
      },
    });

    expect(result.mutations).toContainEqual(
      expect.objectContaining({
        type: 'addDisadvantageDie',
        payload: expect.objectContaining({ rollKey: 'action', name: 'Retract' }),
      })
    );
  });

  it('does not add disadvantage die when not retracted', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const result = runIntent(Retract, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: { Retract: { retracted: false } },
      action: {
        type: 'attack',
        actorInstanceId: 'char-1',
        targetInstanceIds: ['adv-1'],
        effects: [],
        appliedEffects: [],
      },
      rolls: {
        action: { hopeDie: { value: 7 }, fearDie: { value: 4 }, dice: [], statics: [] },
      },
    });

    expect(result.mutations).not.toContainEqual(
      expect.objectContaining({ type: 'addDisadvantageDie' })
    );
  });

  it('halves incoming physical damage in reviewAction when retracted (rounds up, CONV-012)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      { type: 'damage', target: char, amount: 7, source: adv, damageType: 'physical' },
    ];

    runReviewAction(Retract, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      featureState: { Retract: { retracted: true } },
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(4);
  });
});
