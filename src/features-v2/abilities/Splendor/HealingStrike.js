/**
 * Splendor domain — Healing Strike (Tier 1 / domain slot 7)
 * SRD: When you deal damage to an adversary, you can spend 2 Hope to clear a Hit Point on an ally within Close range.
 */

import { when, isActing } from '../../engine/when.js';

/** Other PCs within Melee, Very Close, or Close range (SRD “within Close range”). */
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

/** Pending damage with positive amount to an adversary (weapon or spell). */
function hasDamageToAdversary(table) {
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount > 0)) continue;
    const tid = e.target?.instanceId;
    if (!tid) continue;
    const actor = table.actors.find((a) => a.instanceId === tid);
    if (actor?.isAdversary) return true;
  }
  return false;
}

export const HealingStrike = {
  name: 'Healing Strike',
  description:
    'When you deal damage to an adversary, you can **spend 2 Hope** to clear a Hit Point on an ally within Close range.',
  chips: [
    when(
      isActing,
      (t) => t.rolls?.damage != null,
      hasDamageToAdversary,
      {
        name: 'Healing Strike',
        placements: ['reviewAction'],
        hopeCost: 2,
        description:
          'Spend 2 Hope. Clear 1 Hit Point on an ally within Close range of you (choose one).',
        selectTargets: (table) => alliesWithinCloseRange(table),
        isDisabled: (table) =>
          alliesWithinCloseRange(table).length === 0 ? 'No ally within Close range (Melee–Close).' : false,
        onUse(table, chipState) {
          const ids = chipState?.get?.('selectedTargetIds') ?? [];
          const allyId = ids[0];
          if (!allyId) return;
          const ally = table.characters.find((c) => c.instanceId === allyId);
          if (!ally) return;
          const band = table.me.rangeFrom(ally);
          if (band == null || band === 'far' || band === 'veryFar') return;
          ally.clearHP(1);
        },
      }
    ),
  ],
};
