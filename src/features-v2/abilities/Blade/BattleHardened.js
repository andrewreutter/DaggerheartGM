/**
 * Blade domain — Battle-Hardened (Tier 2 / SRD level 6)
 * SRD: daggerheart-srd/abilities/Battle-Hardened.md
 * Once per long rest when you would make a Death Move, spend 1 Hope to clear a Hit Point instead
 * (engine: reduce pending HP loss so you remain at 1 HP, same outcome shape as Life Ward).
 */

import { when, isTargeted } from '../../engine/when.js';

/** Pending HP loss in review-outcome may be `stat: 'currentHP'` or `type: 'damage'` (banner bridge). */
function isPendingHpLossEffect(e) {
  const amt = e.amount ?? 0;
  if (!(amt > 0)) return false;
  if (e.stat === 'currentHP') return true;
  if (e.type === 'damage') return true;
  return false;
}

function wouldMakeDeathMove(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  for (const e of table.action?.effects ?? []) {
    if (!isPendingHpLossEffect(e)) continue;
    const tid = e.target?.instanceId ?? e.target?.id;
    if (tid !== id) continue;
    const hp = table.me?.currentHP;
    if (!(hp > 0)) continue;
    if (e.amount < hp) continue;
    return true;
  }
  return false;
}

export const BattleHardened = {
  name: 'Battle-Hardened',
  description:
    'Once per long rest when you would make a Death Move, you can **spend a Hope** to clear a Hit Point instead.',
  chips: [
    when(
      isTargeted,
      wouldMakeDeathMove,
      {
        placements: ['reviewOutcome'],
        name: 'Battle-Hardened',
        hopeCost: 1,
        frequency: 'longRest',
        description:
          'Spend 1 Hope (once per long rest). Instead of making a Death Move, clear a Hit Point — you remain at 1 HP.',
        isDisabled: (table) =>
          (table.me?.hope ?? 0) < 1 ? 'Need at least 1 Hope.' : false,
        onUse(table) {
          const id = table.me?.instanceId;
          if (!id) return;
          for (const e of table.action?.effects ?? []) {
            if (!isPendingHpLossEffect(e)) continue;
            const tid = e.target?.instanceId ?? e.target?.id;
            if (tid !== id) continue;
            const hp = table.me?.currentHP;
            if (!(hp > 0)) continue;
            if (e.amount < hp) continue;
            e.amount = hp - 1;
            table.action.addNarration(
              `Battle-Hardened: ${table.me?.name ?? 'You'} spend Hope to avoid a Death Move — you clear a Hit Point instead (now at 1 HP).`
            );
            return;
          }
        },
      }
    ),
  ],
};
