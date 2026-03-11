import { rewriteDamageWithBonus } from '../../client/lib/dice-utils.js';

export default {
  name: 'Bonded',
  automated: true,
  /** @param {{ level?: number }} ctx */
  tagText: ({ level } = {}) => `+${level ?? 0} damage from level (applied)`,
  description: 'Gain a bonus to your damage rolls equal to your level.',
  /** Add level modifier to damage roll. */
  rewriteDamage(damageStr, { level } = {}) {
    return rewriteDamageWithBonus(damageStr, level ?? 0);
  },
};
