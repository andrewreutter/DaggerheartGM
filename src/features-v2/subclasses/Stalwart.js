/**
 * Stalwart subclass features — SRD: daggerheart-srd/subclasses/Stalwart.md
 */

import { when, isTargeted, hasPhysicalDamage } from '../engine/when.js';

/** Allies (other PCs) with pending physical damage to them who are in Very Close range of the owner. */
function partnersInArmsAllyTargets(table) {
  const meId = table.me?.instanceId;
  if (!meId) return [];
  const seen = new Set();
  const out = [];
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount > 0)) continue;
    if (e.damageType !== 'physical') continue;
    const tid = e.target?.instanceId;
    if (!tid || tid === meId) continue;
    if (seen.has(tid)) continue;
    const ally = table.characters.find((c) => c.instanceId === tid);
    if (!ally) continue;
    if (table.me.rangeFrom(ally) !== 'veryClose') continue;
    seen.add(tid);
    out.push(ally);
  }
  return out;
}

function reduceIncomingPhysicalSeverityForTarget(table, targetInstanceId, steps = 1) {
  const n = Math.max(0, Math.floor(Number(steps)) || 0);
  if (n <= 0) return;
  for (const e of table.action?.effects ?? []) {
    if (
      e.type === 'damage' &&
      e.target?.instanceId === targetInstanceId &&
      e.damageType === 'physical' &&
      typeof e.amount === 'number' &&
      e.amount > 0
    ) {
      e.amount = Math.max(0, e.amount - n);
      break;
    }
  }
}

/** Allies in Close range with 2 or fewer remaining HP who have pending damage in this action. */
function loyalProtectorEligibleAllies(table) {
  const meId = table.me?.instanceId;
  if (!meId) return [];
  const out = [];
  const seen = new Set();
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount > 0)) continue;
    const tid = e.target?.instanceId;
    if (!tid || tid === meId) continue;
    if (seen.has(tid)) continue;
    const ally = table.characters.find((c) => c.instanceId === tid);
    if (!ally) continue;
    const hp = ally.currentHP;
    if (hp == null || hp > 2) continue;
    if (table.me.rangeFrom(ally) !== 'close') continue;
    seen.add(tid);
    out.push(ally);
  }
  return out;
}

export const Unwavering = {
  name: 'Unwavering',
  description: 'Gain a permanent +1 bonus to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: 1,
    severeThreshold: 1,
  },
};

export const Unrelenting = {
  name: 'Unrelenting',
  description: 'Gain a permanent +2 bonus to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: 2,
    severeThreshold: 2,
  },
};

export const Undaunted = {
  name: 'Undaunted',
  description: 'Gain a permanent +3 bonus to your damage thresholds.',
  passiveStatMods: {
    majorThreshold: 3,
    severeThreshold: 3,
  },
};

export const IronWill = {
  name: 'Iron Will',
  description:
    'When you take physical damage, you can mark an additional Armor Slot to reduce the severity.',
  chips: [
    when(isTargeted, hasPhysicalDamage, {
      name: 'Iron Will',
      placements: ['reviewAction'],
      armorMark: 1,
      onUse(table) {
        table.action.reduceIncomingPhysicalSeverityBySteps(1);
      },
    }),
  ],
};

export const PartnersInArms = {
  name: 'Partners-in-Arms',
  description:
    'When an ally within Very Close range takes damage, you can mark an Armor Slot to reduce the severity by one threshold.',
  chips: [
    when(
      (table) => partnersInArmsAllyTargets(table).length > 0,
      {
        name: 'Partners-in-Arms',
        placements: ['reviewAction'],
        armorMark: 1,
        selectTargets: (table) => partnersInArmsAllyTargets(table),
        isDisabled: (table) =>
          partnersInArmsAllyTargets(table).length === 0
            ? 'No ally in range for Partners in Arms.'
            : false,
        onUse(table, chipState) {
          const ids = chipState.get?.('selectedTargetIds') ?? [];
          const allyId = ids[0];
          if (!allyId) return;
          reduceIncomingPhysicalSeverityForTarget(table, allyId, 1);
        },
      }
    ),
  ],
};

export const LoyalProtector = {
  name: 'Loyal Protector',
  description:
    'When an ally within Close range has 2 or fewer Hit Points and would take damage, you can mark a Stress to sprint to their side and take the damage instead.',
  chips: [
    when(
      (table) => loyalProtectorEligibleAllies(table).length > 0,
      {
        name: 'Loyal Protector',
        placements: ['reviewAction'],
        stressCost: 1,
        selectTargets: (table) => loyalProtectorEligibleAllies(table),
        isDisabled: (table) =>
          loyalProtectorEligibleAllies(table).length === 0
            ? 'No eligible ally in range for Loyal Protector.'
            : false,
        onUse(table, chipState) {
          const ids = chipState.get?.('selectedTargetIds') ?? [];
          const allyId = ids[0];
          if (!allyId) return;
          const ally = table.characters.find((c) => c.instanceId === allyId);
          for (const e of table.action?.effects ?? []) {
            if (e.type !== 'damage' || e.target?.instanceId !== allyId) continue;
            e.target = table.me;
            table.action.addNarration(
              `${table.me.name} takes the hit meant for ${ally?.name ?? 'ally'} (Loyal Protector).`
            );
            return;
          }
        },
      }
    ),
  ],
};
