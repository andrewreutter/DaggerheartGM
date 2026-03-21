import { when, isActing } from '../engine/when.js';

export const Destructive = {
  name: "Destructive",
  description: "-1 to Agility; on a successful attack, all adversaries within Very Close range must mark a Stress.",
  passiveStatMods: {
    agility: -1
  },
  hooks: {
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack' && table.rolls?.action?.isSuccess === true,
      (table) => {
        const targets = table.adversaries.filter(
          (adv) => table.me.rangeFrom(adv) === 'melee' || table.me.rangeFrom(adv) === 'veryClose'
        );
        for (const adv of targets) {
          adv.markStress(1);
        }
      }
    )
  }
};
