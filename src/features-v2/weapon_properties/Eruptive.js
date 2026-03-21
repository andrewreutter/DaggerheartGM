import { when, isActing } from '../engine/when.js';

/**
 * Melee hit — splash to other adversaries in Very Close of the target.
 * SRD lists a reaction roll (14); V2 adversary actors do not carry reaction
 * traits or proficiency on the snapshot, so each splash target uses a flat d20
 * vs DC 14. Half splash damage rounds up (CONV-012).
 */
const meleeHit = (table) =>
  table.action?.type === 'attack' &&
  table.rolls?.action?.isSuccess === true &&
  table.action?.range === 'melee';

const ERUPTIVE_SPLASH_DC = 14;

export const Eruptive = {
  name: 'Eruptive',
  description:
    'On a successful attack against a target within Melee range, all other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.',
  hooks: {
    onResolve: when(isActing, meleeHit, (table) => {
      const primary = table.action?.target;
      if (!primary) return;

      const dmg = table.action?.effects?.find(
        (e) =>
          e.type === 'damage' &&
          e.target?.instanceId === primary.instanceId &&
          e.amount > 0
      );
      const raw = dmg?.amount ?? 0;
      if (raw <= 0) return;

      const splash = Math.max(1, Math.ceil(raw / 2));

      for (const adv of table.adversaries) {
        if (adv.instanceId === primary.instanceId) continue;
        if (primary.rangeFrom(adv) !== 'veryClose') continue;
        const pass = table.rollDie('d20') >= ERUPTIVE_SPLASH_DC;
        if (!pass) adv.markHP(splash);
      }
    }),
  },
};
