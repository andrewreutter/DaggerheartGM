/**
 * Bone domain — Cruel Precision (Tier 2 / level 7)
 * SRD: When you make a successful attack with a weapon, gain a bonus to your damage roll equal to either your Finesse or Agility.
 */

import { when, isActing } from '../../engine/when.js';

function isWeaponAttack(table) {
  return (
    table.action?.type === 'attack' &&
    table.action?.weaponId != null &&
    table.rolls?.damage != null
  );
}

export const CruelPrecision = {
  name: 'Cruel Precision',
  description:
    'When you make a successful attack with a weapon, gain a bonus to your damage roll equal to either your Finesse or Agility.',
  hooks: {
    onIntent: when(
      isActing,
      isWeaponAttack,
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => {
        const fin = t.me?.traits?.finesse ?? 0;
        const agi = t.me?.traits?.agility ?? 0;
        const bonus = Math.max(fin, agi);
        if (bonus > 0) {
          t.rolls.damage.addStatic({ name: 'Cruel Precision', value: bonus });
        }
      }
    ),
  },
};
