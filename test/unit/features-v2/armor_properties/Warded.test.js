import { describe, it, expect } from 'vitest';
import { Warded } from '../../../../src/features-v2/armor_properties/Warded.js';
import { runReviewAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Warded', () => {
  it('has the correct name', () => {
    expect(Warded.name).toBe('Warded');
  });

  it('has a description', () => {
    expect(typeof Warded.description).toBe('string');
    expect(Warded.description.length).toBeGreaterThan(0);
  });

  it('reduces incoming magic damage by armorScore in reviewAction (targeted character)', () => {
    const char = mockCharacter({ instanceId: 'char-1', armorScore: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 5,
        source: adv,
        damageType: 'magic',
      },
    ];

    runReviewAction(Warded, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(3);
  });

  it('does not reduce damage below zero', () => {
    const char = mockCharacter({ instanceId: 'char-1', armorScore: 10 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 3,
        source: adv,
        damageType: 'magic',
      },
    ];

    runReviewAction(Warded, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(0);
  });

  it('does not change physical damage', () => {
    const char = mockCharacter({ instanceId: 'char-1', armorScore: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 5,
        source: adv,
        damageType: 'physical',
      },
    ];

    runReviewAction(Warded, {
      activeElements: [char, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(5);
  });

  it('does not run when a different character is targeted', () => {
    const char1 = mockCharacter({ instanceId: 'char-1', armorScore: 2 });
    const char2 = mockCharacter({ instanceId: 'char-2', armorScore: 2 });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char2,
        amount: 5,
        source: adv,
        damageType: 'magic',
      },
    ];

    runReviewAction(Warded, {
      activeElements: [char1, char2, adv],
      _ownerInstanceId: 'char-1',
      action: {
        type: 'attack',
        actorInstanceId: adv.instanceId,
        targetInstanceIds: [char2.instanceId],
        effects,
        appliedEffects: [],
      },
    });

    expect(effects[0].amount).toBe(5);
  });
});
