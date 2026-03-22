/**
 * Blade domain — A Soldier's Bond (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

export const ASoldiersBond = {
  name: "A Soldier's Bond",
  description:
    "Once per long rest, when you compliment someone or ask them about something they're good at, you can both gain 3 Hope.",
  chips: [
    {
      placements: ['card'],
      name: "A Soldier's Bond",
      frequency: 'longRest',
      description:
        'Choose another character. You and that character each gain 3 Hope (after complimenting them or asking about something they excel at).',
      selectTargets: (table) =>
        (table.characters ?? []).filter((c) => c.instanceId !== table.me.instanceId),
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const allyId = ids[0];
        if (!allyId) return;
        const ally = table.characters.find((c) => c.instanceId === allyId);
        table.me.gainHope(3);
        ally?.gainHope(3);
        table.me.actionLoop(
          "A Soldier's Bond",
          `You and ${ally?.name ?? 'your ally'} each gain 3 Hope.`
        );
      },
    },
  ],
};
