/**
 * Splendor domain — Bolt Beacon (Tier 1)
 * SRD: Spellcast vs Far; on success spend Hope for d8+2 magic damage; Vulnerable + glow.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const BoltBeacon = {
  name: 'Bolt Beacon',
  description:
    'Make a **Spellcast Roll** against a target within Far range. On a success, **spend a Hope** to send a bolt of shimmering light toward them, dealing **d8+2** magic damage using your Proficiency. The target becomes temporarily _Vulnerable_ and glows brightly until this condition is cleared.',
  chips: [
    {
      placements: ['card'],
      name: 'Bolt Beacon',
      description:
        'Spellcast vs a target within Far range. On a success, spend 1 Hope to deal d8+2 magic damage (Proficiency). The target becomes temporarily Vulnerable and glows until cleared.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Bolt Beacon',
          `Make a Spellcast (${trait}) roll against a target within Far range. On a success, spend 1 Hope to deal d8+2 magic damage using your Proficiency. The target becomes temporarily Vulnerable and glows brightly until this condition is cleared.`,
          { trait }
        );
      },
    },
  ],
};
