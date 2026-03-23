import { when, youSucceedOnAnAttack } from '../engine/when.js';

export const Destructive = {
  name: "Destructive",
  description: "-1 to Agility; on a successful attack, all adversaries within Very Close range must mark a Stress.",
  passiveStatMods: {
    agility: -1
  },
  hooks: {
    onResolve: when(
      youSucceedOnAnAttack,
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
