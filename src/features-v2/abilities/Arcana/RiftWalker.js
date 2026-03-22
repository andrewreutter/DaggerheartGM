/**
 * Arcana domain — Rift Walker (Tier 2)
 * SRD: Spellcast (15); success places a return marker; next successful cast opens a rift back; can reposition marking.
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const RiftWalker = {
  name: 'Rift Walker',
  description:
    'Make a **Spellcast Roll (15)**. On a success, you place an arcane marking on the ground where you currently stand. The next time you successfully cast Rift Walker, a rift in space opens up, providing safe passage back to the exact spot where the marking was placed. This rift stays open until you choose to close it or you cast another spell. You can drop the spell at any time to cast Rift Walker again and place the marking somewhere new.',
  chips: [
    {
      placements: ['card'],
      name: 'Rift Walker',
      description:
        'Spellcast (15). On a success, place a marking where you stand, or open a rift to your previous marking if you already placed one. You may drop the effect to cast again and move the marking (GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Rift Walker',
          `Make a Spellcast (${trait}) roll (15). On a success, either place an arcane marking where you stand, or if a marking already exists, open a rift back to that spot. The rift remains until you close it or cast another spell. You may drop this effect to cast Rift Walker again and place a new marking.`,
          { trait, difficulty: 15 }
        );
      },
    },
  ],
};
