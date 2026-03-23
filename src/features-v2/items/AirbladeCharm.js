/**
 * SRD item — Airblade Charm (roll table 35)
 *
 * Melee-range weapon only. Three times per rest, activate before resolving the attack so this
 * melee weapon is treated as Close range for targeting (merged `rangeOverrides` while active).
 */

import { when, isActing } from '../engine/when.js';

const USES_KEY = 'airbladeCharmUsesRemaining';
const ACTIVE_KEY = 'airbladeThisAttack';
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

function isMeleeWeapon(table) {
  const w = weaponForThisAttack(table);
  if (!w) return false;
  const br = w.baseRange ?? w.range;
  return br === 'melee';
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

export const AirbladeCharm = {
  name: 'Airblade Charm',
  description:
    'You can attach this charm to a weapon with a Melee range. Three times per rest, you can activate the charm and attack a target within Close range.',
  rangeOverrides: when((t) => t.feature.get(ACTIVE_KEY) === true, {
    melee: 'close',
  }),
  hooks: {
    onRest: when(isRestAction, (table) => {
      table.feature.set(USES_KEY, MAX_USES);
    }),
    onReviewOutcome: when(
      isActing,
      (t) => t.action?.type === 'attack',
      (table) => {
        table.feature.set(ACTIVE_KEY, false);
      }
    ),
  },
  chips: [
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      isMeleeWeapon,
      (t) => usesRemaining(t) > 0,
      {
        name: 'Activate Airblade Charm',
        placements: ['intent'],
        description:
          'Spend one of three uses this rest: your Melee weapon attack can reach targets within Close range. Activate before resolving range/targeting for this attack.',
        isDisabled: (table) =>
          usesRemaining(table) < 1 ? 'No uses remaining on Airblade Charm.' : false,
        onUse(table) {
          const rem = usesRemaining(table);
          if (rem < 1) return;
          table.feature.set(ACTIVE_KEY, true);
          table.feature.set(USES_KEY, rem - 1);
        },
      }
    ),
  ],
};
