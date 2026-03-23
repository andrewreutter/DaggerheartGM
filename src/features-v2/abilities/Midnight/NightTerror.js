/**
 * Midnight domain — Night Terror (SRD level 9 spell; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Night Terror.md
 */

/** SRD “within Very Close range”: Melee or Very Close bands only (see Glyph of Nightfall). */
function withinVeryClose(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose';
}

function nightTerrorEligibleTargets(table) {
  return table.actors.filter(
    (a) => a.instanceId !== table.me.instanceId && withinVeryClose(table, a)
  );
}

export const NightTerror = {
  name: 'Night Terror',
  description:
    'Once per long rest, choose any targets within Very Close range to perceive you as a nightmarish horror. The targets must succeed on a Reaction Roll (16) or become temporarily _Horrified_. While _Horrified_, they\'re _Vulnerable_. Steal a number of Fear from the GM equal to the number of targets that are _Horrified_ (up to the number of Fear in the GM\'s pool). Roll a number of **d6s** equal to the number of stolen Fear and deal the total damage to each _Horrified_ target. Discard the stolen Fear.',
  chips: [
    {
      placements: ['card'],
      name: 'Night Terror',
      hopeCost: 2,
      frequency: 'longRest',
      description:
        'Spend 2 Hope (recall). Choose any targets within Very Close range. Each makes a Reaction Roll (16) or becomes temporarily Horrified (Vulnerable while Horrified). Steal Fear from the GM equal to the number who failed, up to the GM pool; roll that many d6s total and deal that damage to each Horrified target; then discard the stolen Fear.',
      selectTargets: (table) => nightTerrorEligibleTargets(table),
      multiSelect: true,
      isDisabled: (table) =>
        nightTerrorEligibleTargets(table).length === 0
          ? 'No sleeping adversary in range for Night Terror.'
          : false,
      onUse(table, chipState) {
        const rawIds = chipState.get?.('selectedTargetIds') ?? [];
        if (!Array.isArray(rawIds) || rawIds.length === 0) return;
        const eligible = new Set(nightTerrorEligibleTargets(table).map((a) => a.instanceId));
        const ids = rawIds.filter((id) => eligible.has(id));
        if (ids.length === 0) return;

        table.feature.set('nightTerrorTargets', ids);
        table.me.actionLoop(
          'Night Terror',
          `Spend 2 Hope (recall). You chose ${ids.length} target(s) within Very Close range. Each must succeed on a Reaction Roll (16) or become temporarily Horrified. While Horrified, they're Vulnerable. Steal a number of Fear from the GM equal to the number of targets that are Horrified (up to the GM's Fear pool). Roll that many d6s, sum them, and deal that total damage to each Horrified target. Discard the stolen Fear from the GM pool (GM resolves rolls, conditions, Fear, and HP).`
        );
      },
    },
  ],
};
