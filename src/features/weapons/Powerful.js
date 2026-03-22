import { parseLeadingDamageDice } from '../../client/lib/dice-utils.js';

/**
 * SRD: On a successful attack, roll an additional damage die and discard the lowest result.
 */
export default {
  name: 'Powerful',
  description: 'On a successful attack, roll an additional damage die and discard the lowest result.',
  showTag: true,
  automated: true,
  tagText: 'Extra damage die, keep highest (applied)',
  rewriteDamage({ roll } = {}) {
    if (!roll?.damageStr) return;
    const parsed = parseLeadingDamageDice(roll.damageStr);
    if (parsed) {
      roll.damageStr = `2${parsed.die}kh${parsed.modStr}${parsed.rest}`;
    }
  },
};
