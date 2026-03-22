/**
 * Midnight domain — Shadowbind (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const Shadowbind = {
  name: 'Shadowbind',
  description:
    'Make a **Spellcast Roll** against all adversaries within Very Close range. Targets you succeed against are temporarily _Restrained_ as their shadow binds them in place.',
  chips: [
    {
      placements: ['card'],
      name: 'Shadowbind',
      description:
        'Spellcast vs all adversaries within Very Close: those you succeed against are temporarily Restrained.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Shadowbind',
          `Make a Spellcast (${trait}) roll against each adversary within Very Close. Each you succeed against is temporarily Restrained (their shadow binds them).`,
          { trait }
        );
      },
    },
  ],
};
