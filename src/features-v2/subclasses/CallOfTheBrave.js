/**
 * Call of the Brave subclass features — SRD: daggerheart-srd/subclasses/CallOfTheBrave.md
 */

import { when, isActing } from '../engine/when.js';

/** When your roll fails and your Fear die is higher than your Hope die, gain 1 Hope. */
export const Courage = {
  name: 'Courage',
  description:
    'When you fail a roll, if your Fear die is higher than your Hope die, gain 1 Hope.',
  hooks: {
    onResolve(table) {
      if (!table.me?.isActing) return;
      const roll = table.rolls?.action;
      if (!roll) return;
      if (roll.isSuccess) return;
      const h = roll.hopeDie?.value ?? 0;
      const f = roll.fearDie?.value ?? 0;
      if (f <= h) return;
      table.me.gainHope(1);
    },
  },
};

export const BattleRitual = {
  name: 'Battle Ritual',
  description:
    'Once per long rest, you can spend several minutes focusing your mind and body to clear 2 Stress and gain 2 Hope.',
  chips: [
    {
      placements: ['card'],
      frequency: 'longRest',
      onUse(table) {
        table.me.clearStress(2);
        table.me.gainHope(2);
      },
    },
  ],
};

export const RiseToTheChallenge = {
  name: 'Rise to the Challenge',
  description:
    'When you have 2 or fewer Hit Points remaining, when you make an action roll, you can roll a d20 as your Hope die instead of your usual Hope die.',
  hooks: {
    onIntent: when(
      isActing,
      (table) => {
        const hp = table.me?.currentHP;
        return hp != null && hp <= 2;
      },
      (table) => table.rolls?.action?.hopeDie != null,
      (table) => {
        table.rolls.action.hopeDie.setDie('d20');
      }
    ),
  },
};

/** Narrative-only for now — full automation deferred (tracker Tech Debt / `docs/v2-game-table-cutover-remaining.md`). */
export const Camaraderie = {
  name: 'Camaraderie',
  description:
    'Your unwavering bravery is a rallying point for your allies. You can initiate a Tag Team Roll one additional time per session. Additionally, when an ally initiates a Tag Team Roll with you, they only need to spend 2 Hope to do so.',
};
