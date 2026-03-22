import { describe, it, expect } from 'vitest';
import { Magic } from '../../../../src/features-v2/armor_properties/Magic.js';
import { runReviewAction, mockCharacter, mockAdversary } from '../helpers.js';

describe('Magic', () => {
  it('has the correct name', () => {
    expect(Magic.name).toBe('Magic');
  });

  it('sets armorSlotReductionDisallowed on physical damage to this character (Magic armor)', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 4,
        source: adv,
        damageType: 'physical',
      },
    ];

    runReviewAction(Magic, {
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

    expect(effects[0].armorSlotReductionDisallowed).toBe(true);
  });

  it('does not flag magic damage', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char,
        amount: 4,
        source: adv,
        damageType: 'magic',
      },
    ];

    runReviewAction(Magic, {
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

    expect(effects[0].armorSlotReductionDisallowed).toBeUndefined();
  });

  it('does not run when a different character is targeted', () => {
    const char1 = mockCharacter({ instanceId: 'char-1' });
    const char2 = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const effects = [
      {
        type: 'damage',
        target: char2,
        amount: 4,
        source: adv,
        damageType: 'physical',
      },
    ];

    runReviewAction(Magic, {
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

    expect(effects[0].armorSlotReductionDisallowed).toBeUndefined();
  });
});
