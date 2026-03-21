import { when, isTargeted, hasDamage } from '../engine/when.js';

export const Parry = {
  name: 'Parry',
  description:
    'When you are attacked, roll this weapon\'s damage dice. If any of the attacker\'s damage dice rolled the same value as your dice, the matching results are discarded from the attacker\'s damage dice before the damage you take is totaled.',
  hooks: {
    onReviewAction: when(
      isTargeted,
      hasDamage,
      (table) => {
        const parryWeapon = (table.me?.weapons ?? []).find(
          (w) => w.name?.toLowerCase().includes('parry')
        ) ?? table.me?.secondaryWeapon ?? table.me?.primaryWeapon;
        if (!parryWeapon?.damage) return;

        const dieMatch = parryWeapon.damage.match(/(\d*)d(\d+)/);
        if (!dieMatch) return;

        const dieCount = parseInt(dieMatch[1] || '1', 10);
        const dieSize = parseInt(dieMatch[2], 10);

        const parryValues = [];
        for (let i = 0; i < dieCount; i++) {
          parryValues.push(table.rollDie(`d${dieSize}`));
        }

        const attackerDice = table.rolls?.damage?.dice ?? [];
        const attackerValues = attackerDice
          .filter((d) => d.value != null)
          .map((d) => d.value);

        const remaining = [...attackerValues];
        let discarded = 0;
        for (const pv of parryValues) {
          const idx = remaining.indexOf(pv);
          if (idx !== -1) {
            discarded += remaining.splice(idx, 1)[0];
          }
        }

        if (discarded <= 0) return;

        const myId = table.me?.instanceId;
        const dmgEffect = (table.action?.effects ?? []).find(
          (e) => e.type === 'damage' && e.target?.instanceId === myId
        );
        if (dmgEffect) {
          dmgEffect.amount = Math.max(0, dmgEffect.amount - discarded);
        }
      }
    ),
  },
};
