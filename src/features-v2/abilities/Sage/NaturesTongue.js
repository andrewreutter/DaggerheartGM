/**
 * Sage domain — Nature's Tongue (Tier 1)
 * SRD: Instinct (12) to speak with nature; in natural environment, may spend 1 Hope before a Spellcast Roll for +2.
 */

import { when, actingOnASpellcastRollForMe } from '../../engine/when.js';

export const NaturesTongue = {
  name: "Nature's Tongue",
  description:
    'You can speak the language of the natural world. When you want to speak to the plants and animals around you, make an **Instinct Roll (12)**. On a success, they\'ll give you the information they know. On a roll with Fear, their knowledge might be limited or come at a cost.\n\nAdditionally, before you make a Spellcast Roll while within a natural environment, you can **spend a Hope** to gain a +2 bonus to the roll.',
  chips: [
    {
      placements: ['card'],
      name: "Nature's Tongue — Speak with nature",
      description:
        'Make an Instinct Roll (12) to speak with plants and animals; on Fear the GM may limit knowledge or impose a cost.',
      onUse(table) {
        table.me.actionLoop(
          "Nature's Tongue",
          'Make an Instinct Roll (12) to speak with the plants and animals around you. On a success, they share what they know. On a roll with Fear, their knowledge might be limited or come at a cost (GM).',
          { trait: 'Instinct', difficulty: 12 }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Natural environment',
      description:
        'Toggle on while you are in a natural environment (forests, rivers, caves, etc.—GM). Required to use the Spellcast bonus chip.',
      isToggle: true,
      onUse(table, chipState) {
        table.feature.set('naturalEnvironment', chipState.isOn);
      },
    },
    when(
      (table) => table.feature.get('naturalEnvironment') === true,
      actingOnASpellcastRollForMe,
      {
        placements: ['intent'],
        label: "Nature's Tongue",
        hopeCost: 1,
        description:
          'Spend 1 Hope before this Spellcast Roll to gain +2 to the roll (natural environment only).',
        onUse(table) {
          table.rolls?.action?.addStatic?.({ name: "Nature's Tongue", value: 2 });
        },
      }
    ),
  ],
};
