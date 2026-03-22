/**
 * Midnight domain — Veil of Night (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

export const VeilOfNight = {
  name: 'Veil of Night',
  description:
    'Make a **Spellcast Roll (13)**. On a success, you can create a temporary curtain of darkness between two points within Far range. Only you can see through this darkness. You\'re considered _Hidden_ to adversaries on the other side of the veil, and you have advantage on attacks you make through the darkness. The veil remains until you cast another spell.',
  chips: [
    {
      placements: ['card'],
      name: 'Veil of Night',
      description:
        'Spellcast (13): on success, veil between two points within Far; only you see through; Hidden to adversaries on the far side; advantage on attacks through the veil; ends when you cast another spell (GM).',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Veil of Night',
          `Make a Spellcast (${trait}) roll (13). On a success, create a curtain of darkness between two points within Far range. Only you can see through it. You are Hidden to adversaries on the other side of the veil, and you have advantage on attacks you make through the darkness. The veil remains until you cast another spell.`,
          { trait, difficulty: 13 }
        );
      },
    },
  ],
};
