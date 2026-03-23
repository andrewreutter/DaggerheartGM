/**
 * Bone domain — Rapid Riposte (Tier 2 / level 6)
 * SRD: daggerheart-srd/abilities/Rapid Riposte.md
 *
 * When an attack made against you from within Melee range fails, you can mark a Stress
 * and deal the weapon damage of one of your active weapons to the attacker.
 */

import { when, isTargeted } from '../../engine/when.js';

function meleeAttackAgainstMeFailed(table) {
  if (table.action?.type !== 'attack') return false;
  if (typeof table.rolls?.action?.isSuccess !== 'boolean') return false;
  if (table.rolls.action.isSuccess !== false) return false;
  const atk = table.action?.attacker;
  if (!atk) return false;
  return table.me.rangeFrom(atk) === 'melee';
}

function activeWeaponOptions(table) {
  return (table.me?.weapons ?? []).filter((w) => w.isDisabled !== true);
}

export const RapidRiposte = {
  name: 'Rapid Riposte',
  description:
    'When an attack made against you from within Melee range fails, you can **mark a Stress** and seize the opportunity to deal the weapon damage of one of your active weapons to the attacker.',
  chips: [
    when(isTargeted, meleeAttackAgainstMeFailed, {
      name: 'Rapid Riposte',
      placements: ['reviewAction'],
      stressCost: 1,
      description:
        'Mark 1 Stress: deal your chosen active weapon\'s damage to the attacker (failed melee-range attack against you).',
      isSelect: (table) =>
        activeWeaponOptions(table).map((w) => ({
          id: String(w.id ?? w.name),
          name: w.name ?? 'Weapon',
          description: `Deal this weapon's damage (${w.damage ?? 'd6'}).`,
        })),
      isDisabled: (table) =>
        activeWeaponOptions(table).length === 0 ? 'No weapon available for Riposte (others are disabled).' : false,
      onUse(table, chipState) {
        const sid = chipState.get?.('selectedId');
        if (!sid) return;
        const w = activeWeaponOptions(table).find((x) => String(x.id ?? x.name) === String(sid));
        if (!w) return;
        const atk = table.action?.attacker;
        if (!atk) return;
        const diceExpr = w.damage != null ? String(w.damage) : 'd6';
        table.action.addDamageRoll({
          name: 'Rapid Riposte',
          dice: diceExpr,
          damageType: 'physical',
          targets: [atk],
        });
      },
    }),
  ],
};
