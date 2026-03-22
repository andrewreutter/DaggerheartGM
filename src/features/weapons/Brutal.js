import { parseLeadingDamageDice } from '../../client/lib/dice-utils.js';

/**
 * SRD: When you roll the maximum value on a damage die, roll an additional damage die.
 */
export default {
  name: 'Brutal',
  description: 'When you roll the maximum value on a damage die, roll an additional damage die.',
  showTag: true,
  automated: true,
  tagText: 'Exploding damage die (applied)',
  rewriteDamage({ roll } = {}) {
    if (!roll?.damageStr) return;
    const parsed = parseLeadingDamageDice(roll.damageStr);
    if (parsed) {
      roll.damageStr = `${parsed.qty}${parsed.die}!${parsed.modStr}${parsed.rest}`;
    }
  },
};
