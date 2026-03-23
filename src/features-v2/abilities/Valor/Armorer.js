/**
 * Valor domain — Armorer (Tier 2 / level 5)
 * SRD: daggerheart-srd/abilities/Armorer.md
 * +1 Armor Score while wearing armor; allies clear an Armor Slot when you use Repair Armor during a rest.
 */

export const Armorer = {
  name: 'Armorer',
  description:
    "While you're wearing armor, gain a +1 bonus to your Armor Score.\n\nDuring a rest, when you choose to repair your armor as a downtime move, your allies also clear an Armor Slot.",
  passiveStatMods: {
    armorScore: (table) => (table.me?.armorId ? 1 : 0),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Armorer — allies clear armor',
      frequency: 'rest',
      description:
        'During this rest, after you used the Repair Armor downtime move on yourself: each other PC clears 1 Armor Slot (Armorer).',
      onUse(table) {
        const names = [];
        for (const c of table.characters) {
          if (c.instanceId === table.me?.instanceId) continue;
          c.clearArmor(1);
          names.push(c.name ?? 'Ally');
        }
        table.me.actionLoop(
          'Armorer',
          names.length
            ? `You repaired your armor this rest. Each ally clears 1 Armor Slot: ${names.join(', ')}.`
            : 'You repaired your armor this rest. (No other PCs to apply Armorer to.)'
        );
      },
    },
  ],
};
