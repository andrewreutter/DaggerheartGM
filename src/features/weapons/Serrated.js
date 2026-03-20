import { parseLeadingDamageDice } from '../../client/lib/dice-utils.js';

/**
 * SRD: When you roll a 1 on a damage die, it deals 8 damage instead.
 */
export default {
  name: 'Serrated',
  description: 'When you roll a 1 on a damage die, it deals 8 damage instead.',
  showTag: true,
  automated: true,
  tagText: 'Minimum 8 on each damage die (applied)',
  rewriteDamage({ roll } = {}) {
    if (!roll?.damageStr) return;
    const parsed = parseLeadingDamageDice(roll.damageStr);
    if (parsed) {
      roll.damageStr = `${parsed.qty}${parsed.die}m8${parsed.modStr}${parsed.rest}`;
    }
  },
};
