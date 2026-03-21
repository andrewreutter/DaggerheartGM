import { describe, it, expect } from 'vitest';
import { Sheltering } from '../../../../src/features-v2/weapon_properties/Sheltering.js';
import {
  runReviewOutcome,
  mockCharacter,
  mockAdversary,
} from '../helpers.js';

describe('Sheltering', () => {
  const adv = mockAdversary({ instanceId: 'adv-1', name: 'Dragon', tokenX: 0, tokenY: 0 });

  it('onReviewOutcome adds narration when useArmor is true on incoming damage', () => {
    const rook = mockCharacter({
      instanceId: 'char-1',
      name: 'Rook',
      tokenX: 10,
      tokenY: 0,
    });
    const effects = [
      {
        type: 'damage',
        target: { instanceId: 'char-1', name: 'Rook' },
        amount: 2,
        damageType: 'physical',
        useArmor: true,
        source: adv,
      },
    ];

    const { narrations } = runReviewOutcome(Sheltering, {
      activeElements: [rook, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
    });

    expect(narrations.some((n) => n.includes('Sheltering') && n.includes('Rook'))).toBe(true);
  });

  it('onReviewOutcome adds narration when only useArmorByTargetId is set', () => {
    const rook = mockCharacter({
      instanceId: 'char-1',
      name: 'Rook',
      tokenX: 10,
      tokenY: 0,
    });
    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'char-1', name: 'Rook' },
        amount: 2,
        source: adv,
      },
    ];

    const { narrations } = runReviewOutcome(Sheltering, {
      activeElements: [rook, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
        useArmorByTargetId: { 'char-1': true },
      },
    });

    expect(narrations.some((n) => n.includes('Sheltering'))).toBe(true);
  });

  it('does not narrate when no armor commitment', () => {
    const rook = mockCharacter({ instanceId: 'char-1', tokenX: 10, tokenY: 0 });
    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'char-1' },
        amount: 2,
        source: adv,
        useArmor: false,
      },
    ];

    const { narrations } = runReviewOutcome(Sheltering, {
      activeElements: [rook, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1'],
        effects,
      },
    });

    expect(narrations.filter((n) => n.includes('Sheltering'))).toHaveLength(0);
  });

  it('reduces ally HP loss by 1 when ally is in Melee and took the same hit', () => {
    const rook = mockCharacter({
      instanceId: 'char-1',
      name: 'Rook',
      tokenX: 10,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'char-2',
      name: 'Quinn',
      tokenX: 12,
      tokenY: 0,
    });

    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'char-1', name: 'Rook' },
        amount: 3,
        source: adv,
        useArmor: true,
      },
      {
        stat: 'currentHP',
        target: { instanceId: 'char-2', name: 'Quinn' },
        amount: 3,
        source: adv,
      },
    ];

    const { narrations } = runReviewOutcome(Sheltering, {
      activeElements: [rook, ally, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1', 'char-2'],
        effects,
      },
    });

    expect(effects[1].amount).toBe(2);
    expect(narrations.some((n) => n.includes('Quinn'))).toBe(true);
  });

  it('does not reduce ally damage when ally is out of Melee range', () => {
    const rook = mockCharacter({
      instanceId: 'char-1',
      name: 'Rook',
      tokenX: 10,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'char-2',
      name: 'Quinn',
      tokenX: 30,
      tokenY: 0,
    });

    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'char-1', name: 'Rook' },
        amount: 3,
        source: adv,
        useArmor: true,
      },
      {
        stat: 'currentHP',
        target: { instanceId: 'char-2', name: 'Quinn' },
        amount: 3,
        source: adv,
      },
    ];

    runReviewOutcome(Sheltering, {
      activeElements: [rook, ally, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1', 'char-2'],
        effects,
      },
    });

    expect(effects[1].amount).toBe(3);
  });

  it('does not reduce ally when armorSlotReductionDisallowed is set on ally line', () => {
    const rook = mockCharacter({
      instanceId: 'char-1',
      name: 'Rook',
      tokenX: 10,
      tokenY: 0,
    });
    const ally = mockCharacter({
      instanceId: 'char-2',
      name: 'Quinn',
      tokenX: 12,
      tokenY: 0,
    });

    const effects = [
      {
        stat: 'currentHP',
        target: { instanceId: 'char-1', name: 'Rook' },
        amount: 3,
        source: adv,
        useArmor: true,
      },
      {
        stat: 'currentHP',
        target: { instanceId: 'char-2', name: 'Quinn' },
        amount: 3,
        source: adv,
        armorSlotReductionDisallowed: true,
      },
    ];

    runReviewOutcome(Sheltering, {
      activeElements: [rook, ally, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: 'adv-1',
        targetInstanceIds: ['char-1', 'char-2'],
        effects,
      },
    });

    expect(effects[1].amount).toBe(3);
  });
});
