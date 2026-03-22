/**
 * Midnight domain — Rain of Blades (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const RainOfBlades = {
  name: 'Rain of Blades',
  description:
    '**Spend a Hope** to make a **Spellcast Roll** and conjure throwing blades that strike out at all targets within Very Close range. Targets you succeed against take **d8+2** magic damage using your Proficiency.\n\nIf a target you hit is _Vulnerable_, they take an extra **1d8** damage.',
  chips: [
    {
      placements: ['card'],
      name: 'Rain of Blades',
      hopeCost: 1,
      description:
        'Spellcast vs all targets within Very Close: each hit takes d8+2 magic damage (Proficiency). Vulnerable targets take an extra 1d8.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Rain of Blades',
          `Spend 1 Hope. Make a Spellcast (${trait}) roll vs each target within Very Close. Each you succeed against takes d8+2 magic damage (Proficiency). Vulnerable targets take an additional 1d8.`,
          { trait }
        );
      },
    },
  ],
};
