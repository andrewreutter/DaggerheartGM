import { when, isActing } from '../engine/when.js';
import { findWeaponDamageDieForPool } from '../engine/weapon-damage-die.js';

export const Powerful = {
  name: 'Powerful',
  description:
    'On a successful attack, roll an additional damage die and discard the lowest result.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const damageDice = table.rolls?.damage?.dice ?? [];
        const targetId = table.action?.target?.instanceId;
        const dmgEffect = (table.action?.effects ?? []).find(
          (e) => e.type === 'damage' && e.target?.instanceId === targetId
        );
        if (!dmgEffect) return;

        const weaponDie = findWeaponDamageDieForPool(table, damageDice);
        if (!weaponDie || weaponDie.value == null) return;

        const extra = table.rollDie(weaponDie.die);
        const higher = Math.max(weaponDie.value, extra);
        dmgEffect.amount += higher - weaponDie.value;
      }
    ),
  },
};
