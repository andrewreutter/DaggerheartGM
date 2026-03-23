/**
 * Sage domain — Forager (Tier 2, level 6)
 * SRD: daggerheart-srd/abilities/Forager.md
 * Additional downtime move; recall 1 Hope; roll d6 for consumable; party cap five foraged items.
 */

export const Forager = {
  name: 'Forager',
  description:
    '**Recall Cost 1.** As an additional downtime move you can choose, roll a d6 to see what you forage. Work with the GM to describe it and add it to your inventory as a consumable. Your party can carry up to five foraged consumables at a time.\n\n1. A unique food (Clear 2 Stress)\n2. A beautiful relic (Gain 2 Hope)\n3. An arcane rune (+2 to a Spellcast Roll)\n4. A healing vial (Clear 2 Hit Points)\n5. A luck charm (Reroll any die)\n6. Choose one of the options above.',
  passiveStatMods: {
    numShortRestSlots: 1,
    numLongRestSlots: 1,
  },
  chips: [
    {
      placements: ['card'],
      name: 'Forager',
      hopeCost: 1,
      frequency: 'rest',
      description:
        'During a rest, when you take this additional downtime move: roll [d6] and consult the table on this card. Work with the GM to describe what you forage and record it as a consumable in your inventory (party-wide limit of five foraged consumables; GM tracks).',
      onUse(table) {
        table.me.actionLoop(
          'Forager',
          `Roll [d6] on the Forager table:\n` +
            `1 — A unique food (clear 2 Stress when consumed).\n` +
            `2 — A beautiful relic (gain 2 Hope when used).\n` +
            `3 — An arcane rune (+2 to a Spellcast Roll when used).\n` +
            `4 — A healing vial (clear 2 Hit Points when consumed).\n` +
            `5 — A luck charm (reroll any die when used).\n` +
            `6 — Choose one of the options above.\n\n` +
            `Describe the item with the GM and add it to your inventory as a consumable. Your party can carry up to five foraged consumables at a time (GM).`
        );
      },
    },
  ],
};
