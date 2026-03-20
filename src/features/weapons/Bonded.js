import { rewriteDamageWithBonus } from '../../client/lib/dice-utils.js';

/**
 * SRD: Gain a bonus to your damage rolls equal to your level.
 */
export default {
  name: 'Bonded',
  description: 'Gain a bonus to your damage rolls equal to your level.',
  showTag: true,
  automated: true,
  tagText: ({ level } = {}) => `+${level ?? 0} damage from level (applied)`,
  rewriteDamage({ roll, level } = {}) {
    if (!roll?.damageStr) return;
    roll.damageStr = rewriteDamageWithBonus(roll.damageStr, level ?? 0);
  },
};
