/**
 * SRD item — Bag of Ficklesand (roll table 31)
 *
 * Presence vs 10 to change perceived weight; Finesse vs 10 vs a nearby target to apply Vulnerable (GM resolves on success).
 */

function sandBlastTargets(table) {
  return (table.actors ?? []).filter((a) => {
    if (a.instanceId === table.me.instanceId) return false;
    const band = table.me.rangeFrom(a);
    return band === 'melee' || band === 'veryClose';
  });
}

export const BagOfFicklesand = {
  name: 'Bag of Ficklesand',
  description:
    'You can convince this small bag of sand to be much heavier or lighter with a successful Presence Roll (10). Additionally, on a successful Finesse Roll (10), you can blow a bit of sand into a target\'s face to make them temporarily Vulnerable.',
  chips: [
    {
      name: 'Convince the bag (Presence 10)',
      placements: ['card'],
      description:
        'Convince the bag to feel heavier or lighter. Make a Presence Roll vs difficulty 10.',
      onUse(table) {
        table.me.actionLoop(
          'Bag of Ficklesand',
          'Convince this bag of sand to be much heavier or lighter. Presence Roll vs difficulty 10.',
          { trait: 'Presence', difficulty: 10 }
        );
      },
    },
    {
      name: 'Blow sand (Finesse 10)',
      placements: ['card'],
      description:
        'Choose a target within Melee or Very Close range. On a successful Finesse Roll (10), they become temporarily Vulnerable.',
      selectTargets: sandBlastTargets,
      onUse(table, chipState) {
        const ids = chipState?.get?.('selectedTargetIds') ?? [];
        const id = ids[0];
        if (!id) return;
        const target = table.actors.find((a) => a.instanceId === id);
        if (!target) return;
        const nm = target.name ?? 'target';
        table.me.actionLoop(
          'Bag of Ficklesand',
          `Blow sand into ${nm}'s face. On a successful Finesse Roll (10), they become temporarily Vulnerable (GM applies).`,
          { trait: 'Finesse', difficulty: 10 }
        );
      },
    },
  ],
};
