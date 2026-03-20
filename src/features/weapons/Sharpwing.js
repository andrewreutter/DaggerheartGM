import { rewriteDamageWithBonus } from '../../client/lib/dice-utils.js';

/**
 * SRD: Gain a bonus to your damage rolls equal to your Agility.
 */
export default {
  name: 'Sharpwing',
  description: 'Gain a bonus to your damage rolls equal to your Agility.',
  showTag: true,
  automated: true,
  tagText: ({ traits } = {}) => `+${traits?.agility ?? 0} damage from Agility (applied)`,
  rewriteDamage({ roll, traits } = {}) {
    if (!roll?.damageStr) return;
    roll.damageStr = rewriteDamageWithBonus(roll.damageStr, traits?.agility ?? 0);
  },
};
