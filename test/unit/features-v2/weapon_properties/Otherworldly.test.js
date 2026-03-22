import { describe, it, expect } from 'vitest';
import { Otherworldly } from '../../../../src/features-v2/weapon_properties/Otherworldly.js';
import { runReviewAction, mockAction, mockChipState, mockCharacter, mockAdversary } from '../helpers.js';
import { activateChip, collectChips } from '../../../../src/features-v2/engine/chip-system.js';
import { buildTableSnapshot } from '../../../../src/features-v2/engine/table.js';
import { mockGameState } from '../helpers.js';

const WID = 'w-ow';

function owFeat() {
  return { ...Otherworldly, _ownerInstanceId: 'char-1', _weaponId: WID };
}

describe('Otherworldly', () => {
  it('exposes a reviewAction chip on a successful attack with this weapon', () => {
    const { chips } = runReviewAction(owFeat(), {
      action: {
        ...mockAction({ type: 'attack', range: 'melee', weaponId: WID }),
        effects: [],
        appliedEffects: [],
      },
      rolls: { action: { isSuccess: true, hopeDie: { value: 1 }, fearDie: { value: 1 } }, damage: {} },
    });
    expect(chips.some((c) => c.name === 'Magic damage')).toBe(true);
  });

  it('does not offer the chip when the attack fails', () => {
    const { chips } = runReviewAction(owFeat(), {
      action: {
        ...mockAction({ type: 'attack', range: 'melee', weaponId: WID }),
        effects: [],
        appliedEffects: [],
      },
      rolls: { action: { isSuccess: false, hopeDie: { value: 1 }, fearDie: { value: 1 } }, damage: {} },
    });
    expect(chips.filter((c) => c.name === 'Magic damage')).toHaveLength(0);
  });

  it('onUse sets pending damage to magic', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });
    const effects = [
      {
        type: 'damage',
        target: adv,
        amount: 5,
        source: char,
        damageType: 'physical',
      },
    ];

    const table = buildTableSnapshot(
      mockGameState({
        activeElements: [char, adv],
        action: {
          type: 'attack',
          actorInstanceId: char.instanceId,
          targetInstanceIds: [adv.instanceId],
          trait: 'Agility',
          range: 'melee',
          weaponId: WID,
          effects,
          appliedEffects: [],
        },
        rolls: {
          action: { isSuccess: true, hopeDie: { value: 1 }, fearDie: { value: 1 } },
          damage: { dice: [], statics: [] },
        },
        _ownerInstanceId: char.instanceId,
        _activeFeature: owFeat(),
        _featureKey: 'Otherworldly',
      })
    );

    const chips = collectChips([owFeat()], 'reviewAction', table);
    const chip = chips.find((c) => c.name === 'Magic damage');
    expect(chip).toBeDefined();

    activateChip(chip, table, mockChipState());
    expect(effects[0].damageType).toBe('magic');
  });
});
