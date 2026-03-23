/**
 * SRD item — Piercing Arrows (roll table item 14)
 *
 * Three times per rest when you succeed on an attack with one of these arrows, you can add your
 * Proficiency to the damage roll.
 */

import { when, youSucceedOnAnAttack } from '../engine/when.js';

const USES_KEY = 'piercingArrowsUsesRemaining';
const MAX_USES = 3;

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

function usesRemaining(table) {
  const u = table.feature.get(USES_KEY);
  if (u == null) return MAX_USES;
  return Math.max(0, Math.min(MAX_USES, Number(u)));
}

function isRestAction(table) {
  const t = table.action?.type;
  return t === 'shortRest' || t === 'longRest';
}

export const PiercingArrows = {
  name: 'Piercing Arrows',
  description:
    'Three times per rest when you succeed on an attack with one of these arrows, you can add your Proficiency to the damage roll.',
  hooks: {
    onRest: when(isRestAction, (table) => {
      table.feature.set(USES_KEY, MAX_USES);
    }),
  },
  chips: [
    when(
      youSucceedOnAnAttack,
      isArrowWeapon,
      (table) => usesRemaining(table) > 0,
      {
        name: 'Add Proficiency (Piercing Arrows)',
        placements: ['intent'],
        description:
          'Spend one of three uses this rest to add your Proficiency to this attack’s damage roll.',
        isDisabled: (table) =>
          usesRemaining(table) < 1 ? 'No uses remaining on Piercing Arrows.' : false,
        onUse(table) {
          if (usesRemaining(table) < 1) return;
          const prof = Number(table.me?.proficiency ?? 1);
          table.rolls?.damage?.addStatic({
            name: 'Piercing Arrows',
            value: prof,
          });
          table.feature.set(USES_KEY, usesRemaining(table) - 1);
        },
      }
    ),
  ],
};
