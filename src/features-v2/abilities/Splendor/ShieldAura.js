/**
 * Splendor domain — Shield Aura (Tier 3 / SRD level 8 spell)
 * SRD: Mark Stress; ward a target within Very Close (≤10'); when they mark Armor against physical damage,
 * reduce severity by one additional threshold step; if they mark no HP from the hit, the aura ends; one ward at a time.
 */

import { when } from '../../engine/when.js';

/** Melee or Very Close of the caster (≤10'). */
function validTargets(table) {
  const out = [];
  for (const c of table.characters) {
    const band = table.me.rangeFrom(c);
    if (band === 'melee' || band === 'veryClose') out.push(c);
  }
  return out;
}

function armorCommittedForTarget(table, targetInstanceId) {
  const tid = targetInstanceId;
  if (table.action?.useArmorByTargetId?.[tid] === true) return true;
  return (table.action?.effects ?? []).some(
    (e) =>
      e.type === 'damage' &&
      e.target?.instanceId === tid &&
      (e.amount ?? 0) > 0 &&
      e.useArmor === true
  );
}

function reduceIncomingHpOrDamageByOneThresholdForTarget(table, targetInstanceId) {
  const tid = targetInstanceId;
  const list = table.action?.effects ?? [];
  const hp = list.find(
    (e) => e.stat === 'currentHP' && e.target?.instanceId === tid && e.amount > 0
  );
  if (hp) {
    hp.amount = Math.max(0, hp.amount - 1);
    return;
  }
  const dmg = list.find(
    (e) =>
      e.type === 'damage' && e.target?.instanceId === tid && (e.amount ?? 0) > 0
  );
  if (dmg) {
    dmg.amount = Math.max(0, dmg.amount - 1);
  }
}

function totalPendingHpLossForTarget(table, targetInstanceId) {
  let sum = 0;
  for (const e of table.action?.effects ?? []) {
    if (e.target?.instanceId !== targetInstanceId) continue;
    if (e.stat === 'currentHP' && e.amount > 0) sum += e.amount;
    if (e.type === 'damage' && e.amount > 0) sum += e.amount;
  }
  return sum;
}

function hasArmorEligiblePhysicalHit(table, wardId) {
  return (table.action?.effects ?? []).some((e) => {
    if (e.target?.instanceId !== wardId || (e.amount ?? 0) <= 0) return false;
    if (e.type === 'damage') {
      if (e.damageType === 'magic') return false;
      if (e.armorSlotReductionDisallowed === true) return false;
      return true;
    }
    if (e.stat === 'currentHP') return true;
    return false;
  });
}

export const ShieldAura = {
  name: 'Shield Aura',
  description:
    '**Mark a Stress** to cast a protective aura on a target within Very Close range. When the target marks an Armor Slot, they reduce the severity of the attack by an additional threshold. If this spell causes a creature who would be damaged to instead mark no Hit Points, the effect ends.\n\nYou can only hold Shield Aura on one creature at a time.',
  hooks: {
    onRest(table) {
      if (table.action?.type !== 'longRest') return;
      table.feature.set('shieldAuraTargetId', null);
    },
    onReviewOutcome: when(
      (table) => {
        const wardId = table.feature.get('shieldAuraTargetId');
        if (wardId == null || wardId === '') return false;
        if (!armorCommittedForTarget(table, wardId)) return false;
        return hasArmorEligiblePhysicalHit(table, wardId);
      },
      (table) => {
        const wardId = table.feature.get('shieldAuraTargetId');
        reduceIncomingHpOrDamageByOneThresholdForTarget(table, wardId);
        table.action.addNarration(
          'Shield Aura: the warded creature reduces this hit by an additional threshold step while using armor.'
        );
        if (totalPendingHpLossForTarget(table, wardId) === 0) {
          table.feature.set('shieldAuraTargetId', null);
          table.action.addNarration(
            'Shield Aura fades — no Hit Points were marked on this hit.'
          );
        }
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Shield Aura',
      stressCost: 1,
      description:
        'Mark a Stress. Choose a target within Very Close range (10 ft or less) on the map. When they mark Armor against a physical hit, they reduce severity by one additional threshold. If they mark no HP from that hit, the aura ends. Only one ward at a time.',
      selectTargets: (table) => validTargets(table),
      isDisabled: (table) =>
        validTargets(table).length === 0 ? 'No valid target in range for Shield Aura.' : false,
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') ?? [];
        const tid = ids[0];
        if (!tid) return;
        const target = table.characters.find((c) => c.instanceId === tid);
        table.feature.set('shieldAuraTargetId', tid);
        table.me.actionLoop(
          'Shield Aura',
          `You ward ${target?.name ?? 'your ally'} with a protective aura. When they mark Armor against a physical hit, they reduce severity by an additional threshold. If they mark no HP from a hit, the aura ends.`
        );
      },
    },
  ],
};
