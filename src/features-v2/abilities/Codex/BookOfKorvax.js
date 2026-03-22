/**
 * Codex — Book of Korvax (Tier 1 grimoire; SRD lists as Level 3 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfKorvax = {
  name: 'Book of Korvax',
  description:
    '_Levitation:_ Make a **Spellcast Roll** to temporarily lift a target you can see up into the air and move them within Close range of their original position.\n\n_Recant:_ **Spend a Hope** to force a target within Melee range to make a Reaction Roll (15). On a failure, they forget the last minute of your conversation.\n\n_Rune Circle:_ **Mark a Stress** to create a temporary magical circle on the ground where you stand. All adversaries within Melee range, or who enter Melee range, take **2d12+4** magic damage and are knocked back to Very Close range.',
  chips: [
    {
      placements: ['card'],
      name: 'Levitation',
      description:
        'Spellcast: lift a visible target into the air and move them within Close range of their original position.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Korvax — Levitation',
          `Make a Spellcast (${trait}) roll to temporarily lift a target you can see into the air and move them within Close range of their original position.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Recant',
      hopeCost: 1,
      description:
        'A target within Melee makes a Reaction Roll (15). On a failure, they forget the last minute of your conversation.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Korvax — Recant',
          `Spend Hope: choose a target within Melee range. They make a Reaction Roll (15). On a failure, they forget the last minute of your conversation (Spellcast ${trait} / GM resolves).`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Rune Circle',
      stressCost: 1,
      description:
        'Create a magical circle where you stand: adversaries in Melee or who enter Melee take 2d12+4 magic damage and are knocked to Very Close range.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Korvax — Rune Circle',
          `Mark Stress: create a temporary magical circle on the ground where you stand. All adversaries within Melee range, or who enter Melee range, take 2d12+4 magic damage and are knocked back to Very Close range (Spellcast ${trait} / GM resolves).`,
          { trait }
        );
      },
    },
  ],
};
