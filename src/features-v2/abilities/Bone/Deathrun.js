/**
 * Bone domain — Deathrun (SRD level 10; Recall Cost 1)
 * SRD: daggerheart-srd/abilities/Deathrun.md
 */

export const Deathrun = {
  name: 'Deathrun',
  description:
    '**_Level 10_** _Bone Ability._ **_Recall Cost_** _1._\n\n' +
    "**Spend 3 Hope** to run a straight path through the battlefield to a point within Far range, making an attack against all adversaries within your weapon's range along that path. Choose the order in which you deal damage to the targets you succeeded against. For the first, roll your weapon damage with a +1 bonus to your Proficiency. Then remove a die from your damage roll and deal the remaining damage to the next target. Continue to remove a die for each subsequent target until you have no more damage dice or adversaries.\n\n" +
    "You can't target the same adversary more than once per attack.",
  chips: [
    {
      placements: ['card'],
      name: 'Deathrun',
      hopeCost: 3,
      description:
        'Spend 3 Hope (recall). Run a straight path to a point within Far range and attack adversaries within your weapon range along that path; order damage so the first hit uses your weapon damage with +1 to Proficiency, then remove one damage die per subsequent target until dice or targets run out (GM adjudicates path, attacks, and cascade).',
      onUse(table) {
        table.me.actionLoop(
          'Deathrun',
          "Spend 3 Hope. Run a straight path through the battlefield to a point within Far range, making an attack against all adversaries within your weapon's range along that path. Choose the order in which you deal damage to targets you succeeded against. For the first, roll your weapon damage with a +1 bonus to your Proficiency. Then remove a die from your damage roll and deal the remaining damage to the next target. Continue to remove a die for each subsequent target until you have no more damage dice or adversaries. You can't target the same adversary more than once per attack. (GM adjudicates the path, attack rolls, and damage.)"
        );
      },
    },
  ],
};
