import { when, isActing } from '../engine/when.js';

/**
 * SRD item — Paragon's Chain (roll table 37).
 * Meditation is narrative at the table. Once per long rest, spend 1 Hope to use a d20 as your Hope Die when the roll aligns with your chosen principle.
 */
export const ParagonsChain = {
  name: "Paragon's Chain",
  description:
    "As a downtime move, you can meditate on an ideal or principle you hold dear and focus your will into this chain. Once per long rest, you can spend a Hope to roll a d20 as your Hope Die for rolls that directly align with that principle.",
  chips: [
    when(isActing, {
      placements: ['intent'],
      frequency: 'longRest',
      hopeCost: 1,
      description: 'Spend 1 Hope: roll a d20 as your Hope Die for this action.',
      onUse(table) {
        table.rolls?.action?.hopeDie?.setDie('d20');
      },
    }),
  ],
};
