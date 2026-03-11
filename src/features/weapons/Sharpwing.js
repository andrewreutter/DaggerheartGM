import { rewriteDamageWithBonus } from '../../client/lib/dice-utils.js';

export default {
  name: 'Sharpwing',
  automated: true,
  /** @param {{ traits?: object }} ctx */
  tagText: ({ traits } = {}) => `+${traits?.agility ?? 0} damage from Agility (applied)`,
  description: 'Gain a bonus to your damage rolls equal to your Agility.',
  /** Add Agility modifier to damage roll. */
  rewriteDamage(damageStr, { traits } = {}) {
    return rewriteDamageWithBonus(damageStr, traits?.agility ?? 0);
  },
};
