import { when, youSucceedOnAnAttack } from '../engine/when.js';
import { GOLD_COINS_PER_HANDFUL } from '../engine/table.js';

/**
 * SRD: Spend a handful of gold to gain a +1 bonus to your Proficiency on a damage roll.
 * One SRD handful = `GOLD_COINS_PER_HANDFUL` (the ones digit of the integer `gold` field).
 * Effect: +1 static on the damage roll (Proficiency bonus applied to damage).
 */
export const Greedy = {
  name: 'Greedy',
  description:
    'Spend a handful of gold to gain a +1 bonus to your Proficiency on a damage roll.',
  chips: [
    when(
      youSucceedOnAnAttack,
      {
        description: `Spend ${GOLD_COINS_PER_HANDFUL} gold (one handful) for +1 Proficiency on this damage roll.`,
        placements: ['reviewAction'],
        goldCost: GOLD_COINS_PER_HANDFUL,
        isDisabled: (table) =>
          (table.me?.gold ?? 0) < GOLD_COINS_PER_HANDFUL
            ? `Need ${GOLD_COINS_PER_HANDFUL} gold (one handful).`
            : false,
        onUse(table) {
          table.rolls?.damage?.addStatic({ name: 'Greedy', value: 1 });
        },
      }
    ),
  ],
};
