import { when, isActing } from '../engine/when.js';

export const KnowTheTide = {
  name: "Know the Tide",
  description:
    "You can sense the ebb and flow of life. When you roll with Fear, place a token on your community card. You can hold a number of tokens equal to your level. Before you make an action roll, you can spend any number of these tokens to gain a +1 bonus to the roll for each token spent. At the end of each session, clear all unspent tokens.",

  chips: [
    when(
      isActing,
      (table) => (table.feature.get('tokens') ?? 0) > 0,
      {
        description: "Spend all Tide tokens for +1 to this roll per token.",
        placements: ['intent'],
        onUse(table) {
          const tokens = table.feature.get('tokens') ?? 0;
          table.rolls?.action?.addStatic({ name: 'Know the Tide', value: tokens });
          table.feature.set('tokens', 0);
        },
      }
    ),
  ],

  hooks: {
    onResolve: when(
      isActing,
      (table) => table.rolls?.action?.fearDie?.value > table.rolls?.action?.hopeDie?.value,
      (table) => {
        const current = table.feature.get('tokens') ?? 0;
        const cap = table.me?.level ?? 1;
        table.feature.set('tokens', Math.min(current + 1, cap));
      }
    ),

    onSessionStart(table) {
      table.feature.set('tokens', 0);
    },
  },
};
