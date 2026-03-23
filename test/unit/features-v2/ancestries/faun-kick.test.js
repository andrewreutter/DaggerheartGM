import { describe, it, expect } from 'vitest';
import { againstATargetWithinMeleeRange } from '../../../../src/features-v2/engine/when.js';

/** Mirrors Faun Kick `kickAgainstTargetInMelee` (not exported from module). */
function kickAgainstTargetInMelee(table) {
  return againstATargetWithinMeleeRange(table) || table.action?.range === 'melee';
}

describe('Faun Kick range gate', () => {
  it('ORs bridge melee range when map positions are unknown', () => {
    const attacker = { instanceId: 'a', rangeFrom: () => null };
    const target = { instanceId: 'b' };
    expect(
      kickAgainstTargetInMelee({
        action: { actor: attacker, target, range: 'melee' },
      })
    ).toBe(true);
    expect(
      kickAgainstTargetInMelee({
        action: { actor: attacker, target, range: 'veryClose' },
      })
    ).toBe(false);
  });
});
