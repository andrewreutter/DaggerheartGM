/**
 * Blade domain — Battle Monster (Tier 3 / level 10)
 * SRD: daggerheart-srd/abilities/Battle Monster.md
 */

import { when, isActing } from '../../engine/when.js';

/** Weapon attack with a damage roll (not Spellcast-only). */
function isWeaponAttackWithDamage(table) {
  return (
    table.action?.type === 'attack' &&
    table.action?.weaponId != null &&
    table.rolls?.damage != null
  );
}

function isSuccessfulAttackVsAdversary(table) {
  if (!isWeaponAttackWithDamage(table)) return false;
  if (table.rolls?.action?.isSuccess !== true) return false;
  const tgt = table.action?.target;
  return tgt?.isAdversary === true;
}

/** Marked HP on the attacker: total HP track minus remaining (clear) HP. */
function markedHpOnAttacker(table) {
  const max = table.me?.maxHP ?? 0;
  const cur = table.me?.currentHP ?? 0;
  return Math.max(0, max - cur);
}

/** At least four empty Stress boxes so 4 Stress can be marked. */
function hasFourStressCapacity(table) {
  const max = table.me?.maxStress ?? 0;
  const cur = table.me?.currentStress ?? 0;
  return max - cur >= 4;
}

/**
 * Strip rolled weapon damage so resolution uses Battle Monster instead.
 * Removes all damage dice; negates the sum of existing damage statics with one offset line.
 */
function negateRolledWeaponDamage(table) {
  const dmg = table.rolls?.damage;
  if (!dmg) return;
  const names = [...(dmg.dice ?? [])].map((d) => d?.name).filter(Boolean);
  for (const n of names) {
    dmg.removeDie(n);
  }
  let staticSum = 0;
  for (const s of dmg.statics ?? []) {
    staticSum += Number(s?.value) || 0;
  }
  if (staticSum !== 0) {
    dmg.addStatic({ name: 'Battle Monster', value: -staticSum });
  }
}

export const BattleMonster = {
  name: 'Battle Monster',
  description:
    'When you make a successful attack against an adversary, you can **mark 4 Stress** to force the target to mark a number of Hit Points equal to the number of Hit Points you currently have marked instead of rolling for damage.',
  chips: [
    when(isActing, isSuccessfulAttackVsAdversary, {
      name: 'Battle Monster',
      placements: ['reviewAction'],
      description:
        'Mark 4 Stress. Ignore this attack’s rolled damage; the target marks Hit Points equal to the number of Hit Points you currently have marked.',
      stressCost: 4,
      isDisabled: (table) =>
        !hasFourStressCapacity(table) ? 'Need 4 empty Stress boxes to mark.' : false,
      onUse(table) {
        negateRolledWeaponDamage(table);
        const n = markedHpOnAttacker(table);
        const tgt = table.action?.target;
        if (tgt && n > 0) {
          tgt.markHP(n);
        }
      },
    }),
  ],
};
