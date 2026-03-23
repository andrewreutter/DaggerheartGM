import { describe, it, expect } from 'vitest';
import {
  collectChips,
  activateChip,
  deductChipCosts,
  makeChipState,
} from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot, applyMutations } from '../../../../src/features-v2/engine/table.js';
import { unwrap } from '../../../../src/features-v2/engine/when.js';
import { ThroughYourEyes } from '../../../../src/features-v2/abilities/Grace/ThroughYourEyes.js';
import { AstralProjection } from '../../../../src/features-v2/abilities/Grace/AstralProjection.js';
import { mockAdversary, mockCharacter, mockGameState, mockAdversaryAttackRoll } from '../helpers.js';

describe('Grace Tier 4 — Through Your Eyes', () => {
  it('selectTargets lists other PCs and adversaries on the map within range, not self', () => {
    const self = mockCharacter({
      instanceId: 'c-self',
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'c-ally',
      name: 'Ally',
      tokenX: 15,
      tokenY: 0,
    });
    const offMap = mockCharacter({
      instanceId: 'c-off',
      name: 'Off',
      tokenX: null,
      tokenY: null,
    });
    const adv = mockAdversary({
      instanceId: 'adv-1',
      tokenX: 80,
      tokenY: 0,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [self, ally, offMap, adv],
        _ownerInstanceId: 'c-self',
        _featureKey: 'Through Your Eyes',
        featureState: { 'Through Your Eyes': {} },
      })
    );
    const chips = collectChips([{ ...ThroughYourEyes, _ownerInstanceId: 'c-self' }], 'card', tbl);
    const card = chips[0];
    const list = card.selectTargets?.(tbl) ?? [];
    expect(list.map((a) => a.instanceId).sort()).toEqual(['adv-1', 'c-ally']);
  });

  it('onUse stores subject id and queues actionLoop', () => {
    const self = mockCharacter({
      instanceId: 'c-self',
      tokenX: 0,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'c-ally',
      name: 'River',
      tokenX: 10,
      tokenY: 0,
    });
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [self, ally],
        _ownerInstanceId: 'c-self',
        _featureKey: 'Through Your Eyes',
        featureState: { 'Through Your Eyes': {} },
        action: {
          type: 'free',
          actorInstanceId: 'c-self',
          targetInstanceIds: [],
          effects: [],
          appliedEffects: [],
        },
        rolls: undefined,
      })
    );
    const chips = collectChips([{ ...ThroughYourEyes, _ownerInstanceId: 'c-self' }], 'card', tbl);
    const card = chips[0];
    const m = activateChip(card, tbl, makeChipState(), { selectedTargetIds: ['c-ally'] });
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Through Your Eyes',
          key: 'throughYourEyesSubjectId',
          value: 'c-ally',
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({
          title: 'Through Your Eyes',
          instanceId: 'c-self',
        }),
      })
    );
    expect(
      m.find((x) => x.type === 'actionLoop')?.payload?.description
    ).toContain('River');
  });

  it('onRest clears linked subject', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Through Your Eyes',
      featureState: {
        'Through Your Eyes': { throughYourEyesSubjectId: 'c-ally' },
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
    ThroughYourEyes.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Through Your Eyes',
          key: 'throughYourEyesSubjectId',
          value: null,
        }),
      })
    );
  });
});

describe('Grace Tier 4 — Astral Projection', () => {
  const feat = { ...AstralProjection, _ownerInstanceId: 'c1' };

  it('card costs 1 Stress, once per long rest, sets active and queues actionLoop', () => {
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [mockCharacter({ instanceId: 'c1' })],
        _ownerInstanceId: 'c1',
        _featureKey: 'Astral Projection',
        featureState: { 'Astral Projection': {} },
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
    const chips = collectChips([feat], 'card', tbl);
    const main = chips[0];
    expect(main?.stressCost).toBe(1);
    expect(main?.frequency).toBe('longRest');
    const m = activateChip(main, tbl, makeChipState());
    deductChipCosts(main, tbl);
    const fromCost = applyMutations(tbl);
    expect([...m, ...fromCost]).toContainEqual(
      expect.objectContaining({
        type: 'markStress',
        payload: expect.objectContaining({ instanceId: 'c1', amount: 1 }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Astral Projection',
          key: 'astralProjectionActive',
          value: true,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'actionLoop',
        payload: expect.objectContaining({ title: 'Astral Projection' }),
      })
    );
  });

  it('onRest clears projection active flag', () => {
    const char = mockCharacter({ instanceId: 'c1' });
    const gs = mockGameState({
      activeElements: [char],
      _ownerInstanceId: 'c1',
      _featureKey: 'Astral Projection',
      featureState: {
        'Astral Projection': { astralProjectionActive: true },
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
    AstralProjection.hooks.onRest(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          featureKey: 'Astral Projection',
          key: 'astralProjectionActive',
          value: false,
        }),
      })
    );
  });

  it('onReviewAction when active and you take damage clears projection and narrates', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 3,
        source: adv,
        damageType: 'physical',
      },
    ];
    const tbl = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        _ownerInstanceId: 'char-1',
        _featureKey: 'Astral Projection',
        featureState: { 'Astral Projection': { astralProjectionActive: true } },
        action: {
          type: 'attack',
          actorInstanceId: adv.instanceId,
          targetInstanceIds: [char.instanceId],
          effects,
          appliedEffects: [],
        },
        rolls: mockAdversaryAttackRoll({ isSuccess: true }),
      })
    );
    const hookFn = unwrap(AstralProjection.hooks.onReviewAction, tbl);
    hookFn(tbl);
    const m = applyMutations(tbl);
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'setFeatureState',
        payload: expect.objectContaining({
          key: 'astralProjectionActive',
          value: false,
        }),
      })
    );
    expect(m).toContainEqual(
      expect.objectContaining({
        type: 'addNarration',
        payload: expect.objectContaining({
          text: expect.stringMatching(/Astral Projection/),
        }),
      })
    );
  });
});
