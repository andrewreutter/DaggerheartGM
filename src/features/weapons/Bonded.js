import { rewriteDamageWithBonus } from '../../client/lib/dice-utils.js';

export default {
  name: 'Bonded',
  description: 'Gain a bonus to your damage rolls equal to your level.',
  showTag: true,
  automated: true,
  tagText: ({ level } = {}) => `+${level ?? 0} damage from level (applied)`,
  rewriteDamage(damageStr, { level } = {}) {
    return rewriteDamageWithBonus(damageStr, level ?? 0);
  },
};
