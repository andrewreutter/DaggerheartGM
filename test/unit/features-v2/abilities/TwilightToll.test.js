import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { applyMutations, buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { TwilightToll } from '../../../../src/features-v2/abilities/Midnight/TwilightToll.js';
import {
  mockCharacter,
  mockAdversary,
  mockGameState,
  mockAction,
  mockRoll,
  runReviewAction,
} from '../helpers.js';

describe('Midnight — Twilight Toll', () => {
  it('onReviewAction adds a token on success vs marked target without damage roll', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 30, tokenY: 0 });
    const { mutations } = runReviewAction(
      { ...TwilightToll, _ownerInstanceId: 'c1' },
      {
        activeElements: [char, adv],
        _featureKey: 'Twilight Toll',
        featureState: {
          'Twilight Toll': { twilightTollTargetId: 'a1', twilightTollTokens: 0 },
        },
        actionType: 'trait',
        action: mockAction({
          type: 'trait',
          actorInstanceId: 'c1',
          targetInstanceIds: ['a1'],
          traitKey: 'Agility',
        }),
        rolls: mockRoll({ isSuccess: true, damageDice: [], damageStatics: [] }),
      }
    );
    expect(mutations).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Twilight Toll',
          key: 'twilightTollTokens',
          value: 1,
        }),
      })
    );
  });

  it('onReviewAction does not add a token when the roll includes damage', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 30, tokenY: 0 });
    const { mutations } = runReviewAction(
      { ...TwilightToll, _ownerInstanceId: 'c1' },
      {
        activeElements: [char, adv],
        _featureKey: 'Twilight Toll',
        featureState: {
          'Twilight Toll': { twilightTollTargetId: 'a1', twilightTollTokens: 0 },
        },
        actionType: 'attack',
        action: mockAction({
          type: 'attack',
          actorInstanceId: 'c1',
          targetInstanceIds: ['a1'],
        }),
        rolls: mockRoll({ isSuccess: true }),
      }
    );
    expect(mutations.filter((m) => m.type === 'setFeatureState' && m.payload?.key === 'twilightTollTokens')).toHaveLength(0);
  });

  it('reviewAction chip spends tokens to queue addRollDie for damage', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const adv = mockAdversary({ instanceId: 'a1', tokenX: 5, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, adv],
      _ownerInstanceId: 'c1',
      _featureKey: 'Twilight Toll',
      featureState: {
        'Twilight Toll': { twilightTollTargetId: 'a1', twilightTollTokens: 2 },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['a1'],
        trait: 'Agility',
        effects: [],
      },
      rolls: mockRoll({ isSuccess: true }),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...TwilightToll, _ownerInstanceId: 'c1' }], 'reviewAction', tbl);
    const chip = chips.find((c) => c.name === 'Twilight Toll');
    expect(chip).toBeDefined();
    const m = [
      ...activateChip(chip, tbl, makeChipState(), { selectedId: '2' }),
      ...applyMutations(tbl),
    ];
    expect(m.filter((x) => x.type === 'addRollDie' && x.payload?.die === 'd12')).toHaveLength(2);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Twilight Toll',
          key: 'twilightTollTokens',
          value: 0,
        }),
      })
    );
  });

  it('onRest clears tokens', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Twilight Toll',
      featureState: {
        'Twilight Toll': { twilightTollTargetId: 'a1', twilightTollTokens: 3 },
      },
      action: {
        type: 'shortRest',
        actorInstanceId: 'c1',
        targetInstanceIds: [],
        effects: [],
        appliedEffects: [],
      },
      rolls: undefined,
    });
    const tbl = buildTableSnapshot(gs);
    TwilightToll.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Twilight Toll',
          key: 'twilightTollTokens',
          value: 0,
        }),
      })
    );
  });

  it('mark target card clears tokens when changing mark', () => {
    const char = mockCharacter({ instanceId: 'c1', tokenX: 0, tokenY: 0 });
    const a1 = mockAdversary({ instanceId: 'adv-1', tokenX: 10, tokenY: 0 });
    const a2 = mockAdversary({ instanceId: 'adv-2', tokenX: 20, tokenY: 0 });
    const gs = mockGameState({
      activeElements: [char, a1, a2],
      _ownerInstanceId: 'c1',
      _featureKey: 'Twilight Toll',
      featureState: {
        'Twilight Toll': { twilightTollTargetId: 'adv-1', twilightTollTokens: 2 },
      },
      action: {
        type: 'attack',
        actorInstanceId: 'c1',
        targetInstanceIds: ['adv-1'],
        effects: [],
      },
      rolls: mockRoll(),
    });
    const tbl = buildTableSnapshot(gs);
    const chips = collectChips([{ ...TwilightToll, _ownerInstanceId: 'c1' }], 'card', tbl);
    const card = chips.find((c) => c.name === 'Twilight Toll — mark target');
    expect(card).toBeDefined();
    const m = [...activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['adv-2'] }), ...applyMutations(tbl)];
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'twilightTollTokens',
          value: 0,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'twilightTollTargetId',
          value: 'adv-2',
        }),
      })
    );
  });
});
