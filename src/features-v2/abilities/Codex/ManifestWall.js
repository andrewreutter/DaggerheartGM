/**
 * Codex domain — Manifest Wall (Tier 2 spell)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const ManifestWall = {
  name: 'Manifest Wall',
  description:
    'Make a **Spellcast Roll (15)**. Once per rest on a success, **spend a Hope** to create a temporary magical wall between two points within Far range. It can be up to 50 feet high and form at any angle. Creatures or objects in its path are shunted to a side of your choice. The wall stays up until your next rest or you cast Manifest Wall again.',
  chips: [
    {
      placements: ['card'],
      name: 'Manifest Wall',
      frequency: 'rest',
      description:
        'Spellcast (15). Once per rest on a success, spend 1 Hope to create a magical wall between two points within Far range (up to 50 ft high, any angle). Creatures and objects in its path are shunted to a side you choose. The wall lasts until your next rest or you cast Manifest Wall again.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Manifest Wall',
          `Make a Spellcast (${trait}) roll (15). Once per rest on a success, spend 1 Hope to create a temporary magical wall between two points within Far range. It can be up to 50 feet high and form at any angle. Creatures or objects in its path are shunted to a side of your choice. The wall stays up until your next rest or you cast Manifest Wall again.`,
          { trait, difficulty: 15 }
        );
      },
    },
  ],
};
