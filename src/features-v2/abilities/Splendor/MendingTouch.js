/**
 * Splendor domain — Mending Touch (Tier 1)
 * SRD: Spend 2 Hope to clear HP or Stress over a few minutes; once per long rest, clear 2 when roleplaying.
 */

/** Other PCs (exclude self). */
function otherPartyCharacters(table) {
  const meId = table.me?.instanceId;
  if (!meId) return [];
  return table.characters.filter((c) => c.instanceId !== meId);
}

function maxHpOf(c) {
  return c.maxHP ?? c.maxHp ?? 6;
}

/** Remaining HP (same convention as table-ops: lower = more damage marked). */
function remainingHp(c) {
  const maxH = maxHpOf(c);
  return c.currentHP ?? c.currentHp ?? maxH;
}

/** Count of marked Stress boxes (clearable). */
function markedStressCount(c) {
  return Math.max(0, Number(c.currentStress) || 0);
}

/** Count of marked HP / damage boxes (maxHp − remaining). */
function markedHpSlots(c) {
  const maxH = maxHpOf(c);
  const cur = remainingHp(c);
  return Math.max(0, Math.min(maxH, maxH - cur));
}

function otherPartyWithMinMarkedStress(table, min) {
  return otherPartyCharacters(table).filter((c) => markedStressCount(c) >= min);
}

function otherPartyWithMinHpDamage(table, min) {
  return otherPartyCharacters(table).filter((c) => markedHpSlots(c) >= min);
}

function resolveFilteredTarget(table, chipState, isEligible) {
  const ids = chipState?.get?.('selectedTargetIds') ?? [];
  const tid = ids[0];
  if (!tid) return null;
  const c = table.characters.find((x) => x.instanceId === tid);
  if (!c || c.instanceId === table.me?.instanceId) return null;
  if (!isEligible(c)) return null;
  return c;
}

const noOtherPcMessage = 'No other party member to heal.';
const noStressToClearMessage = 'No ally has marked Stress to clear.';
const noHpToClearMessage = 'No ally has marked Hit Points to clear.';
const noStress2Message = 'No ally has at least 2 marked Stress to clear.';
const noHp2Message = 'No ally has at least 2 marked Hit Points to clear.';

function disableUnlessEligible(table, eligible, emptyResourceMessage) {
  if (otherPartyCharacters(table).length === 0) return noOtherPcMessage;
  if (eligible.length === 0) return emptyResourceMessage;
  return false;
}

export const MendingTouch = {
  name: 'Mending Touch',
  description:
    'You lay your hands upon a creature and channel healing magic to close their wounds. When you can take a few minutes to focus on the target you\'re helping, you can **spend 2 Hope** to clear a Hit Point or a Stress on them.\n\nOnce per long rest, when you spend this healing time learning something new about them or revealing something about yourself, you can clear 2 Hit Points or 2 Stress on them instead.',
  chips: [
    {
      placements: ['card'],
      name: 'Mending Touch — 1 Stress',
      hopeCost: 2,
      description:
        'Spend 2 Hope. When you can take a few minutes to focus on the target: clear 1 Stress on them.',
      selectTargets: (table) => otherPartyWithMinMarkedStress(table, 1),
      isDisabled: (table) =>
        disableUnlessEligible(
          table,
          otherPartyWithMinMarkedStress(table, 1),
          noStressToClearMessage
        ),
      onUse(table, chipState) {
        const target = resolveFilteredTarget(table, chipState, (c) => markedStressCount(c) >= 1);
        if (!target) return;
        target.clearStress(1);
      },
    },
    {
      placements: ['card'],
      name: 'Mending Touch — 1 HP',
      hopeCost: 2,
      description:
        'Spend 2 Hope. When you can take a few minutes to focus on the target: clear 1 Hit Point on them.',
      selectTargets: (table) => otherPartyWithMinHpDamage(table, 1),
      isDisabled: (table) =>
        disableUnlessEligible(table, otherPartyWithMinHpDamage(table, 1), noHpToClearMessage),
      onUse(table, chipState) {
        const target = resolveFilteredTarget(table, chipState, (c) => markedHpSlots(c) >= 1);
        if (!target) return;
        target.clearHP(1);
      },
    },
    {
      placements: ['card'],
      name: 'Deeper Understanding — 2 Stress',
      hopeCost: 2,
      frequency: 'longRest',
      description:
        'Once per long rest, when you spend this healing time (2 Hope) learning something new about them or revealing something about yourself: clear 2 Stress on them instead.',
      selectTargets: (table) => otherPartyWithMinMarkedStress(table, 2),
      isDisabled: (table) =>
        disableUnlessEligible(
          table,
          otherPartyWithMinMarkedStress(table, 2),
          noStress2Message
        ),
      onUse(table, chipState) {
        const target = resolveFilteredTarget(table, chipState, (c) => markedStressCount(c) >= 2);
        if (!target) return;
        target.clearStress(2);
      },
    },
    {
      placements: ['card'],
      name: 'Deeper Understanding — 2 HP',
      hopeCost: 2,
      frequency: 'longRest',
      description:
        'Once per long rest, when you spend this healing time (2 Hope) learning something new about them or revealing something about yourself: clear 2 Hit Points on them instead.',
      selectTargets: (table) => otherPartyWithMinHpDamage(table, 2),
      isDisabled: (table) =>
        disableUnlessEligible(table, otherPartyWithMinHpDamage(table, 2), noHp2Message),
      onUse(table, chipState) {
        const target = resolveFilteredTarget(table, chipState, (c) => markedHpSlots(c) >= 2);
        if (!target) return;
        target.clearHP(2);
      },
    },
  ],
};
