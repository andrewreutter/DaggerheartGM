/**
 * Valor domain — I Am Your Shield (Tier 1)
 * SRD: Very Close ally would take damage — mark Stress to intercept; you may mark Armor Slots when you take the hit.
 */

import { when } from '../../engine/when.js';

/** Allies (other PCs) with pending damage who are in Very Close range of the owner. */
function shieldEligibleAllies(table) {
  const meId = table.me?.instanceId;
  if (!meId) return [];
  const seen = new Set();
  const out = [];
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount > 0)) continue;
    const tid = e.target?.instanceId;
    if (!tid || tid === meId) continue;
    if (seen.has(tid)) continue;
    const ally = table.characters.find((c) => c.instanceId === tid);
    if (!ally) continue;
    if (table.me.rangeFrom(ally) !== 'veryClose') continue;
    seen.add(tid);
    out.push(ally);
  }
  return out;
}

export const IAmYourShield = {
  name: 'I Am Your Shield',
  description:
    'When an ally within Very Close range would take damage, you can **mark a Stress** to stand in the way and make yourself the target of the attack instead. When you take damage from this attack, you can mark any number of Armor Slots.',
  chips: [
    when(
      (table) => shieldEligibleAllies(table).length > 0,
      {
        name: 'I Am Your Shield',
        placements: ['reviewAction'],
        stressCost: 1,
        selectTargets: (table) => shieldEligibleAllies(table),
        isDisabled: (table) => shieldEligibleAllies(table).length === 0,
        onUse(table, chipState) {
          const ids = chipState.get?.('selectedTargetIds') ?? [];
          const allyId = ids[0];
          if (!allyId) return;
          const ally = table.characters.find((c) => c.instanceId === allyId);
          for (const e of table.action?.effects ?? []) {
            if (e.type !== 'damage' || e.target?.instanceId !== allyId) continue;
            e.target = table.me;
            table.action.addNarration(
              `${table.me.name} intercepts the attack aimed at ${ally?.name ?? 'an ally'} (I Am Your Shield). You may mark any Armor Slots when resolving damage against you.`
            );
            return;
          }
        },
      }
    ),
  ],
};
