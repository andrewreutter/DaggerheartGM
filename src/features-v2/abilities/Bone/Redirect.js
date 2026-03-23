/**
 * Bone domain — Redirect (Tier 2 / level 4)
 * SRD: When an attack made against you from beyond Melee range fails, roll a number of **d6s** equal to your Proficiency.
 * If any roll a 6, you can **mark a Stress** to redirect the attack to damage an adversary within Very Close range instead.
 */

import { when, isTargeted } from '../../engine/when.js';

const FS_KEY = 'redirectAnySix';

function attackFailedFromBeyondMelee(table) {
  if (table.action?.type !== 'attack') return false;
  if (table.rolls?.action?.isSuccess !== false) return false;
  const atk = table.action?.attacker;
  if (!atk) return false;
  const band = table.me?.rangeFrom(atk);
  if (band == null) return false;
  return band !== 'melee';
}

function redirectRolledSix(table) {
  return table.feature.get(FS_KEY) === true;
}

function buildAttackDamageDiceNotation(table) {
  const ds = table.rolls?.damage?.dice;
  if (!Array.isArray(ds) || ds.length === 0) return null;
  const groups = new Map();
  for (const d of ds) {
    const die = d.die || 'd6';
    groups.set(die, (groups.get(die) || 0) + 1);
  }
  return [...groups.entries()].map(([die, n]) => `${n}${die}`).join('+');
}

function inferDamageType(table) {
  const first = table.rolls?.damage?.dice?.[0];
  if (first?.damageType === 'magic') return 'magic';
  return 'physical';
}

export const Redirect = {
  name: 'Redirect',
  description:
    'When an attack made against you from beyond Melee range fails, roll a number of **d6s** equal to your Proficiency. If any roll a 6, you can **mark a Stress** to redirect the attack to damage an adversary within Very Close range instead.',
  chips: [
    when(
      isTargeted,
      attackFailedFromBeyondMelee,
      redirectRolledSix,
      {
        name: 'Redirect',
        placements: ['reviewAction'],
        stressCost: 1,
        description:
          "Mark a Stress: redirect the failed attack's damage to a chosen adversary within Very Close range (after any 6 on your Proficiency d6s).",
        selectTargets: (table) =>
          table.adversaries.filter((a) => table.me.rangeFrom(a) === 'veryClose'),
        onUse(table, chip) {
          const ids = chip.get?.('selectedTargetIds') ?? [];
          const id = ids[0];
          if (!id) return;
          const target = table.adversaries.find((a) => a.instanceId === id);
          if (!target || table.me.rangeFrom(target) !== 'veryClose') return;
          const dice = buildAttackDamageDiceNotation(table);
          if (!dice) return;
          table.action.addDamageRoll({
            name: 'Redirect',
            dice,
            damageType: inferDamageType(table),
            targets: [target],
          });
        },
      }
    ),
  ],
  hooks: {
    onReviewAction: when(
      isTargeted,
      attackFailedFromBeyondMelee,
      (table) => {
        const prof = Math.max(0, Math.floor(Number(table.me.proficiency ?? 1)));
        let anySix = false;
        for (let i = 0; i < prof; i++) {
          if (table.rollDie('d6') === 6) anySix = true;
        }
        table.feature.set(FS_KEY, anySix);
      }
    ),
    onResolve: (table) => {
      table.feature.set(FS_KEY, false);
    },
  },
};
