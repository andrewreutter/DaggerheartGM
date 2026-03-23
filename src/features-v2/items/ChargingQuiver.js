/**
 * SRD item — Charging Quiver (roll table item 03)
 *
 * When you succeed on an attack with an arrow stored in this quiver, gain a bonus to the
 * damage roll equal to your current tier.
 */

import { when, youSucceedOnAnAttack } from '../engine/when.js';

function weaponForThisAttack(table) {
  const wid = table.action?.weaponId;
  const weapons = table.me?.weapons ?? [];
  if (wid) {
    const hit = weapons.find((w) => w.id === wid);
    if (hit) return hit;
  }
  return table.me?.primaryWeapon ?? weapons[0] ?? null;
}

/** Bows and crossbows fire arrows/bolts from a quiver. */
function isArrowWeapon(table) {
  const w = weaponForThisAttack(table);
  const n = w?.name;
  if (!n || typeof n !== 'string') return false;
  return /bow|crossbow/i.test(n);
}

function tierDamageBonus(table) {
  const t = Number(table.me?.tier ?? 1);
  return Math.max(1, Math.min(4, t));
}

export const ChargingQuiver = {
  name: 'Charging Quiver',
  description:
    'When you succeed on an attack with an arrow stored in this quiver, gain a bonus to the damage roll equal to your current tier.',
  hooks: {
    onIntent: when(
      youSucceedOnAnAttack,
      isArrowWeapon,
      (table) => {
        table.rolls?.damage?.addStatic({
          name: 'Charging Quiver',
          value: tierDamageBonus(table),
        });
      }
    ),
  },
};
