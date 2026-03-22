/**
 * Codex — Book of Vagras (Tier 1 grimoire)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfVagras = {
  name: 'Book of Vagras',
  description:
    '_Runic Lock:_ Make a **Spellcast Roll (15)** on an object you\'re touching that can close (such as a lock, chest, or box). Once per rest on a success, you can lock the object so it can only be opened by creatures of your choice. Someone with access to magic and an hour of time to study the spell can break it.\n\n_Arcane Door:_ When you have no adversaries within Melee range, make a **Spellcast Roll (13)**. On a success, **spend a Hope** to create a portal from where you are to a point within Far range you can see. It closes once a creature has passed through it.\n\n_Reveal:_ Make a **Spellcast Roll**. If there is anything magically hidden within Close range, it is revealed.',
  chips: [
    {
      placements: ['card'],
      name: 'Runic Lock',
      frequency: 'rest',
      description:
        'Spellcast (15) on a closable object you touch. On success once per rest: lock it to only open for chosen creatures.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Vagras — Runic Lock',
          `Make a Spellcast (${trait}) roll (15) on an object you are touching that can close. Once per rest on a success: lock it so only creatures of your choice can open it; magic users with an hour can break it.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Arcane Door',
      description:
        'Only when no adversaries in Melee: Spellcast (13), then on success spend Hope to portal to a Far point you can see; closes after one creature passes through.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Vagras — Arcane Door',
          `When no adversaries are within Melee range, make a Spellcast (${trait}) roll (13). On success, spend 1 Hope to open a portal from here to a point within Far range you can see; it closes after one creature passes through.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Reveal',
      description: 'Spellcast: anything magically hidden within Close range is revealed.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Vagras — Reveal',
          `Make a Spellcast (${trait}) roll. If anything is magically hidden within Close range, it is revealed.`,
          { trait }
        );
      },
    },
  ],
};
