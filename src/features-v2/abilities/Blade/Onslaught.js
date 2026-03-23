/**
 * Blade domain — Onslaught (Tier 3 / level 10)
 * SRD: daggerheart-srd/abilities/Onslaught.md
 */

import { when, isActing } from '../../engine/when.js';

const REACTION_DC = 15;

const RANGE_BAND_ORDER = ['melee', 'veryClose', 'close', 'far', 'veryFar'];

function distanceBandIndex(band) {
  const i = RANGE_BAND_ORDER.indexOf(band);
  return i >= 0 ? i : -1;
}

/** Max distance band index allowed by the weapon's printed range (Melee = 0, Very Far = 4). */
function weaponMaxBandIndex(w) {
  const r = String(w?.range ?? 'Melee').trim().toLowerCase();
  if (r === 'very far' || r === 'veryfar') return 4;
  if (r === 'far') return 3;
  if (r === 'close') return 2;
  if (r === 'very close' || r === 'veryclose') return 1;
  return 0;
}

function attackerWithinMyWeaponRange(table) {
  const atk = table.action?.actor;
  if (!atk) return false;
  const w = table.me.primaryWeapon ?? table.me.weapons?.[0];
  if (!w?.range) return false;
  const band = table.me.rangeFrom(atk);
  if (band == null) return false;
  const here = distanceBandIndex(band);
  const cap = weaponMaxBandIndex(w);
  return here >= 0 && here <= cap;
}

/** Pending raw damage to an ally (another PC), attack doesn't include the Blade character. */
function allyDamagedByThirdPartyAttack(table) {
  const meId = table.me?.instanceId;
  if (!meId) return false;
  if (table.action?.type !== 'attack') return false;
  const actorId = table.action.actor?.instanceId;
  if (!actorId || actorId === meId) return false;
  const tids = table.action.targetInstanceIds ?? [];
  if (tids.map(String).includes(String(meId))) return false;
  return (table.action.effects ?? []).some((e) => {
    if (e.type !== 'damage' || (e.amount ?? 0) <= 0) return false;
    const tid = e.target?.instanceId;
    if (!tid || tid === meId) return false;
    return table.characters.some((c) => c.instanceId === tid);
  });
}

export const Onslaught = {
  name: 'Onslaught',
  description:
    'When you successfully make an attack with your weapon, you never deal damage beneath a target\'s Major damage threshold (the target always marks a minimum of 2 Hit Points).\n\nAdditionally, when a creature within your weapon\'s range deals damage to an ally with an attack that doesn\'t include you, you can **mark a Stress** to force them to make a Reaction Roll (15).\n\nOn a failure, the target must mark a Hit Point.',
  hooks: {
    onReviewOutcome: when(
      isActing,
      (t) =>
        t.action?.type === 'attack' &&
        t.rolls?.action?.isSuccess === true &&
        Boolean(t.action?.weaponId),
      (table) => {
        const meId = table.me?.instanceId;
        if (!meId) return;
        const targetIds = (table.action?.targetInstanceIds ?? []).map(String);
        for (const e of table.action?.effects ?? []) {
          if (e.stat !== 'currentHP' || e.amount !== 1) continue;
          const tid = e.target?.instanceId;
          if (!tid) continue;
          const src = e.source;
          const fromMe = src ? src.instanceId === meId : table.action?.actorInstanceId === meId;
          if (!fromMe) continue;
          if (targetIds.length && !targetIds.includes(String(tid))) continue;
          e.amount = 2;
        }
      }
    ),
  },
  chips: [
    when(
      (table) => table.me?.isCharacter === true,
      allyDamagedByThirdPartyAttack,
      attackerWithinMyWeaponRange,
      {
        name: 'Onslaught — Reaction punish',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          'Mark 1 Stress: the attacker makes a Reaction Roll (15); on a failure, they mark 1 Hit Point.',
        isDisabled(table) {
          const cur = table.me?.currentStress ?? 0;
          const max = table.me?.maxStress ?? 0;
          if (cur >= max) return 'No empty Stress boxes to mark.';
          return false;
        },
        onUse(table) {
          const atk = table.action?.actor;
          if (!atk) return;
          const d20 = table.rollDie('d20');
          if (d20 < REACTION_DC) {
            atk.markHP(1);
          }
        },
      }
    ),
  ],
};
