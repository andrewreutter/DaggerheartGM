/**
 * Grace domain — Share the Burden (Tier 3 / SRD level 6 spell)
 * SRD: Once per rest, take on Stress from a willing creature within Melee range; transfer any number
 * of their marked Stress to you, then gain 1 Hope per Stress transferred.
 *
 * Implementation: card action transfers **all** marked Stress from the chosen ally (willing creature).
 * Groups that take only a portion can adjust with the GM after the fact.
 */

/** Other PCs in Melee range of the feature owner who have at least one marked Stress. */
function eligibleAllies(table) {
  return table.characters.filter(
    (c) =>
      c.instanceId !== table.me?.instanceId &&
      table.me?.rangeFrom(c) === 'melee' &&
      (c.currentStress ?? 0) > 0
  );
}

export const ShareTheBurden = {
  name: 'Share the Burden',
  description:
    'Once per rest, take on the Stress from a willing creature within Melee range. The target describes what intimate knowledge or emotions telepathically leak from their mind in this moment between you. Transfer any number of their marked Stress to you, then gain a Hope for each Stress transferred.',
  chips: [
    {
      placements: ['card'],
      name: 'Share the Burden',
      frequency: 'rest',
      /** SRD Recall Cost 0 (domain spell). */
      hopeCost: 0,
      description:
        'Choose a willing creature in Melee range. Clear all of their marked Stress, mark that many Stress on yourself, and gain 1 Hope per Stress moved.',
      selectTargets: (table) => eligibleAllies(table),
      multiSelect: false,
      isDisabled: (table) =>
        eligibleAllies(table).length === 0 ? 'No eligible ally in range to share Stress with.' : false,
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const ally = table.characters.find((c) => c.instanceId === ids[0]);
        const n = Math.max(0, ally?.currentStress ?? 0);
        if (
          n > 0 &&
          ally &&
          ally.instanceId !== table.me?.instanceId &&
          table.me?.rangeFrom(ally) === 'melee'
        ) {
          ally.clearStress(n);
          table.me.markStress(n);
          table.me.gainHope(n);
        }
      },
    },
  ],
};
