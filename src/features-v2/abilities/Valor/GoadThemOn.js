/**
 * Valor domain — Goad Them on (Tier 4)
 * SRD: daggerheart-srd/abilities/Goad Them On.md — Recall Cost 1; Presence vs target within Close; on success Stress + compelled attack at disadvantage next spotlight.
 */

/** SRD “within Close range” on the map: Melee, Very Close, or Close bands (see Support Tank, Mass Disguise). */
function withinCloseRangeBand(band) {
  return band === 'melee' || band === 'veryClose' || band === 'close';
}

function goadTargets(table) {
  return table.actors.filter(
    (a) =>
      a.instanceId !== table.me?.instanceId && withinCloseRangeBand(table.me.rangeFrom(a))
  );
}

export const GoadThemOn = {
  name: 'Goad Them on',
  description:
    '**Recall Cost 1.** Describe how you taunt a target within Close range, then make a **Presence Roll** against them. On a success, the target must mark a Stress, and the next time the GM spotlights them, they must target you with an attack, which they make with disadvantage.',
  chips: [
    {
      placements: ['card'],
      name: 'Goad Them on',
      hopeCost: 1,
      description:
        'Spend 1 Hope (recall). Choose a taunt target within Close range on the map, then make a Presence roll vs that target. On success: they mark a Stress; on their next spotlight they must attack you with disadvantage (GM applies).',
      selectTargets: (table) => goadTargets(table),
      isDisabled: (table) =>
        goadTargets(table).length === 0 ? 'No valid target in weapon range to goad.' : false,
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const target = table.actors.find((a) => a.instanceId === id);
        const targetName = target?.name ?? 'the target';
        table.me.actionLoop(
          'Goad Them on',
          `Describe how you taunt ${targetName} (within Close range), then make a **Presence Roll** against them. On a success, they must mark a Stress, and the next time the GM spotlights them, they must target you with an attack, which they make with disadvantage (GM applies).`,
          { trait: 'Presence' }
        );
      },
    },
  ],
};
