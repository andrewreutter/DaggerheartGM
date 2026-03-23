/**
 * Grace domain — Soothing Speech (Tier 1)
 * SRD: During a short rest, when comforting another character while using Tend to Wounds on them,
 * clear an additional HP on that character; when you do, you also clear 2 Hit Points (on you).
 */

export const SoothingSpeech = {
  name: 'Soothing Speech',
  description:
    'During a short rest, when you take the time to comfort another character while using the Tend to Wounds downtime move on them, clear an additional Hit Point on that character. When you do, you also clear 2 Hit Points.',
  chips: [
    {
      placements: ['card'],
      name: 'Soothing Speech',
      description:
        'During a short rest, after you use Tend to Wounds on an ally while taking time to comfort them: clear 1 additional Hit Point on that ally and clear 2 Hit Points on you.',
      selectTargets: (table) =>
        table.characters.filter((c) => c.instanceId !== table.me?.instanceId),
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const ally = table.characters.find((c) => c.instanceId === id);
        const allyName = ally?.name ?? 'that ally';
        table.me.actionLoop(
          'Soothing Speech',
          `During this short rest, you comforted ${allyName} while using Tend to Wounds on them: clear 1 additional Hit Point on ${allyName} and clear 2 Hit Points on you (GM applies).`
        );
      },
    },
  ],
};
