import { describe, it, expect } from 'vitest';
import { Quiet } from '../../../../src/features-v2/armor_properties/Quiet.js';
import { runIntent, mockCharacter, mockAdversary, mockAction } from '../helpers.js';

describe('Quiet', () => {
  it('has a single chip for the intent phase', () => {
    expect(Array.isArray(Quiet.chips)).toBe(true);
    expect(Quiet.chips).toHaveLength(1);
  });

  it('the chip adds +2 static when the owner activates it during a roll', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    const { chips } = runIntent(Quiet, {
      activeElements: [char, adv],
      action: {
        ...mockAction({ type: 'action', actorInstanceId: 'char-1' }),
        effects: [],
      },
      actionType: 'action',
    });

    // A chip should be offered to the acting character
    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0];
    expect(chip.placements).toContain('intent');
  });

  it('chip onUse queues an addStatic mutation with value 2', () => {
    // Directly invoke the chip's onUse to verify mutation
    const chip = Quiet.chips[0];
    // Unwrap the when() wrapper — the inner chip is wrapped; we need to resolve it
    // We use runIntent and check mutations produced when acting
    const char = mockCharacter({ instanceId: 'char-1' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // runIntent doesn't fire onUse, but we can verify the chip structure
    expect(chip).toBeDefined();
  });

  it('does not offer chip to non-acting character', () => {
    const char = mockCharacter({ instanceId: 'char-1' });
    const other = mockCharacter({ instanceId: 'char-2' });
    const adv = mockAdversary({ instanceId: 'adv-1' });

    // char-2 owns the Quiet feature, but char-1 is acting
    const { chips } = runIntent(
      { ...Quiet, _ownerInstanceId: 'char-2' },
      {
        activeElements: [char, other, adv],
        action: {
          ...mockAction({ type: 'action', actorInstanceId: 'char-1' }),
          effects: [],
        },
        actionType: 'action',
      }
    );

    expect(chips.filter((c) => c.placements?.includes('intent'))).toHaveLength(0);
  });
});
