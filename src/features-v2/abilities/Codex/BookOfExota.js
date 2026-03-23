/**
 * Codex — Book of Exota (Tier 1 grimoire; SRD lists as Level 4 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';

export const BookOfExota = {
  name: 'Book of Exota',
  description:
    '_Repudiate:_ You can interrupt a magical effect taking place. Make a reaction roll using your Spellcast trait. Once per rest on a success, the effect stops and any consequences are avoided.\n\n_Create Construct:_ **Spend a Hope** to choose a group of objects around you and create an animated construct from them that obeys basic commands. Make a **Spellcast Roll** to command them to take action. When necessary, they share your Evasion and traits and their attacks deal **2d10+3** physical damage. You can only maintain one construct at a time, and they fall apart when they take any amount of damage.',
  chips: [
    {
      placements: ['card'],
      name: 'Repudiate',
      frequency: 'rest',
      description:
        'Interrupt a magical effect: reaction roll using your Spellcast trait. Once per rest on a success, the effect stops and consequences are avoided.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Exota — Repudiate',
          `Interrupt a magical effect taking place. Make a reaction roll using your Spellcast (${trait}) trait. On a success, the effect stops and any consequences are avoided (once per rest).`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Create Construct',
      hopeCost: 1,
      description:
        'Spend Hope: animate nearby objects into a construct; Spellcast roll to command. Attacks deal 2d10+3 physical; shares your Evasion and traits when needed; one construct; any damage destroys it.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Exota — Create Construct',
          `Spend 1 Hope: choose objects around you and create an animated construct that obeys basic commands. Make a Spellcast (${trait}) roll to command it to act. When necessary it shares your Evasion and traits; its attacks deal 2d10+3 physical damage. Maintain only one construct at a time; it falls apart when it takes any damage.`,
          { trait }
        );
      },
    },
  ],
};
