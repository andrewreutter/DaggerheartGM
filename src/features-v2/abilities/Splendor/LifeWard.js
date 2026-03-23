/**
 * Splendor domain — Life Ward (Tier 2 / SRD level 4 spell)
 * SRD: Spend 3 Hope, ally within Close range; when they would make a death move, they clear a Hit Point instead
 * (engine: when pending HP marks would leave them at 0, reduce to leave 1 HP remaining). Ends when used, new ward, or long rest.
 */

import { when } from '../../engine/when.js';

/** Other PCs within Melee, Very Close, or Close range (not Far / Very Far). */
function alliesWithinCloseRange(table) {
  const meId = table.me?.instanceId;
  if (!meId) return [];
  const out = [];
  for (const c of table.characters) {
    if (c.instanceId === meId) continue;
    const band = table.me.rangeFrom(c);
    if (band == null) continue;
    if (band === 'far' || band === 'veryFar') continue;
    out.push(c);
  }
  return out;
}

/** Pending HP loss in review-outcome may be `stat: 'currentHP'` or `type: 'damage'` (banner bridge). */
function isPendingHpLossEffect(e) {
  const amt = e.amount ?? 0;
  if (!(amt > 0)) return false;
  if (e.stat === 'currentHP') return true;
  if (e.type === 'damage') return true;
  return false;
}

export const LifeWard = {
  name: 'Life Ward',
  description:
    '**Spend 3 Hope** and choose an ally within Close range. They are marked with a glowing sigil of protection. When this ally would make a death move, they clear a Hit Point instead.\n\nThis effect ends when it saves the target from a death move, you cast Life Ward on another target, or you take a long rest.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('lifeWardTargetId', null);
    },
    onReviewOutcome: when(
      (table) => table.feature.get('lifeWardTargetId') != null && table.feature.get('lifeWardTargetId') !== '',
      (table) => {
        const wardId = table.feature.get('lifeWardTargetId');
        for (const e of table.action?.effects ?? []) {
          if (!isPendingHpLossEffect(e)) continue;
          if (e.target?.instanceId !== wardId) continue;
          const allyActor = table.characters.find((c) => c.instanceId === wardId);
          const hp = allyActor?.currentHP;
          if (!(hp > 0)) continue;
          if (e.amount < hp) continue;
          e.amount = hp - 1;
          table.feature.set('lifeWardTargetId', null);
          table.action.addNarration(
            `Life Ward: ${allyActor?.name ?? e.target?.name ?? 'The warded ally'} is spared from falling—instead of making a death move, they clear a Hit Point (the sigil fades).`
          );
          return;
        }
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Life Ward',
      hopeCost: 3,
      description:
        'Spend 3 Hope. Choose an ally within Close range on the map. When they would make a death move, they clear a Hit Point instead. Ends when it saves them, you ward another ally, or you take a long rest.',
      selectTargets: (table) => alliesWithinCloseRange(table),
      isDisabled: (table) =>
        alliesWithinCloseRange(table).length === 0 ? 'No ally within Close range (Melee–Close).' : false,
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') ?? [];
        const allyId = ids[0];
        if (!allyId) return;
        const ally = table.characters.find((c) => c.instanceId === allyId);
        const allyName = ally?.name ?? 'your ally';
        table.feature.set('lifeWardTargetId', allyId);
        table.me.actionLoop(
          'Life Ward',
          `You ward ${allyName} with a glowing sigil of protection. When they would make a death move, they clear a Hit Point instead. This ends when it saves them, you cast Life Ward on someone else, or you take a long rest.`
        );
      },
    },
  ],
};
