/**
 * Blade domain — Glancing Blow (Tier 2 / level 7)
 * SRD: daggerheart-srd/abilities/Glancing Blow.md
 *
 * When you fail an attack, you can mark a Stress to deal weapon damage using half your Proficiency.
 */

import { when, isActing } from '../../engine/when.js';

function halfProficiencyBonus(table) {
  const p = Number(table.me?.proficiency ?? 1);
  return Math.floor(Math.max(0, p) / 2);
}

function weaponForThisAttack(table) {
  const wid = table.action?.weaponId;
  const weapons = table.me?.weapons ?? [];
  if (wid) {
    const hit = weapons.find((w) => w.id === wid);
    if (hit) return hit;
  }
  return table.me?.primaryWeapon ?? weapons[0] ?? null;
}

function glancingDamageDiceExpr(table) {
  const w = weaponForThisAttack(table);
  const base = w?.damage != null ? String(w.damage) : 'd6';
  const half = halfProficiencyBonus(table);
  if (half <= 0) return base;
  return `${base}+${half}`;
}

function attackFailed(table) {
  return table.rolls?.action?.isSuccess === false;
}

export const GlancingBlow = {
  name: 'Glancing Blow',
  description:
    'When you fail an attack, you can **mark a Stress** to deal weapon damage using half your Proficiency.',
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      attackFailed,
      {
        name: 'Glancing Blow',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark 1 Stress: deal your weapon\'s damage dice plus a bonus equal to half your Proficiency (rounded down).',
        isDisabled(table) {
          const cur = table.me?.currentStress ?? 0;
          const max = table.me?.maxStress ?? 0;
          if (cur >= max) return 'No empty Stress boxes to mark.';
          if (!table.action?.target) return 'No attack target selected.';
          return false;
        },
        onUse(table) {
          const tgt = table.action?.target;
          if (!tgt) return;
          const dice = glancingDamageDiceExpr(table);
          table.action.addDamageRoll({
            name: 'Glancing Blow',
            dice,
            damageType: 'physical',
            targets: [tgt],
          });
        },
      }
    ),
  ],
};
