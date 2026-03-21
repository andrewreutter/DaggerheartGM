import { when, isTargeted } from '../engine/when.js';

export const Parry = {
  name: 'Parry',
  description:
    "When you are attacked, roll this weapon's damage dice. If any of the attacker's damage dice rolled the same value as your dice, the matching results are discarded from the attacker's damage dice before the damage you take is totaled.",
  chips: [
    when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      {
        description:
          "Roll this weapon's damage dice to cancel matching attacker damage dice.",
        placements: ['reviewAction'],
        isToggle: true,
        onUse(table, chip) {
          if (!chip.isOn) return;

          const parryResult = table.rollDie('d8');
          const parryValues = [parryResult];

          const dmgEffect = table.action?.effects?.find(
            (e) =>
              e.type === 'damage' &&
              e.target?.instanceId === table.me?.instanceId &&
              e.amount > 0
          );
          if (!dmgEffect) return;

          const attackerDice = table.rolls?.damage?.dice ?? [];

          let reduction = 0;
          const usedParry = new Set();
          for (const atkDie of attackerDice) {
            if (atkDie.value == null) continue;
            for (let i = 0; i < parryValues.length; i++) {
              if (!usedParry.has(i) && parryValues[i] === atkDie.value) {
                reduction += atkDie.value;
                usedParry.add(i);
                break;
              }
            }
          }

          if (reduction > 0) {
            dmgEffect.amount = Math.max(0, dmgEffect.amount - reduction);
            table.action?.addNarration(
              `Parry cancelled ${reduction} damage (rolled ${parryResult}).`
            );
          } else {
            table.action?.addNarration(
              `Parry rolled ${parryResult} — no matching dice.`
            );
          }
        },
      }
    ),
  ],
};
