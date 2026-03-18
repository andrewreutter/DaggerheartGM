import { rewriteDamageForFeature } from '../../client/lib/dice-utils.js';

export default {
  name: 'Massive',
  description: '-1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.',
  onCharacterBuild({ character, weapon }) {
    character.addFeature('Massive', '-1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.', {
      showTag: true,
      automated: true,
      tagText: 'Extra damage die, keep highest (applied)',
      onCharacterRender: (ctx) => ctx.addStatMod('evasion', -1),
      rewriteDamage(damageStr) {
        return rewriteDamageForFeature(damageStr, 'Massive');
      },
    });
  },
};
