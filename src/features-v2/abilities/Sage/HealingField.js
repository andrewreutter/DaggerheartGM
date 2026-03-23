/**
 * Sage domain — Healing Field (Tier 2)
 * SRD: Once per long rest, Close range — you and allies clear 1 HP; may spend 2 Hope for 2 HP each instead.
 */

function withinCloseRange(table, actor) {
  const band = table.me.rangeFrom(actor);
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

export const HealingField = {
  name: 'Healing Field',
  description:
    '**Recall cost 2.** Once per long rest, you can conjure a field of healing plants around you. Everywhere within Close range of you bursts to life with vibrant nature, allowing you and all allies in the area to clear a Hit Point.\n\n**Spend 2 Hope** to allow you and all allies to clear 2 Hit Points instead.',
  chips: [
    {
      placements: ['card'],
      name: 'Healing Field',
      frequency: 'longRest',
      isSelect: () => [
        { id: 'standard', label: 'Clear 1 HP each (no Hope)' },
        { id: 'empowered', label: 'Spend 2 Hope — clear 2 HP each' },
      ],
      hopeCost: (table) => table.feature.get('_healingFieldHopeCost') ?? 0,
      description:
        'Once per long rest: conjure a healing field within Close range. Choose standard healing or spend 2 Hope so everyone in range clears 2 HP instead. Recall cost 2.',
      onUse(table, chip) {
        const mode = chip.get?.('selectedId') ?? 'standard';
        const empowered = mode === 'empowered';
        const amt = empowered ? 2 : 1;
        // Recall Cost 2 (SRD); optional +2 Hope for empowered healing (2 HP clear each).
        table.feature.set('_healingFieldHopeCost', empowered ? 4 : 2);

        for (const c of table.characters) {
          if (c.instanceId !== table.me.instanceId && !withinCloseRange(table, c)) continue;
          c.clearHP(amt);
        }

        const narration = empowered
          ? 'Spend 4 Hope (2 recall + 2 to empower). Once per long rest, conjure healing plants within Close range: you and each ally in the area clear 2 Hit Points.'
          : 'Spend 2 Hope (recall). Once per long rest, conjure healing plants within Close range: you and each ally in the area clear 1 Hit Point.';
        table.me.actionLoop('Healing Field', narration);
      },
    },
  ],
};
