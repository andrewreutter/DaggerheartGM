/**
 * Grace domain — Grace-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Grace-Touched.md
 */

import { when, isActing } from '../../engine/when.js';

function graceDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'grace').length;
}

function graceTouchedActive(table) {
  return graceDomainCardsInLoadout(table) >= 4;
}

function pendingStressOnMe(table) {
  return (table.action?.effects ?? []).some(
    (e) =>
      e.stat === 'currentStress' &&
      e.target?.instanceId === table.me?.instanceId &&
      e.amount > 0
  );
}

/** True when pending self-Stress can be fully paid with available armor slots (for chip `isDisabled`). */
function hasEnoughArmorForPendingStress(table) {
  const stressEffect = (table.action?.effects ?? []).find(
    (e) =>
      e.stat === 'currentStress' &&
      e.target?.instanceId === table.me?.instanceId &&
      e.amount > 0
  );
  if (!stressEffect) return false;
  const n = stressEffect.amount;
  return (table.me?.armor ?? 0) >= n;
}

function pendingHpOnAttackTarget(table) {
  if (!isActing(table)) return false;
  const tid = table.action?.target?.instanceId;
  if (!tid) return false;
  return (table.action?.effects ?? []).some(
    (e) => e.stat === 'currentHP' && e.target?.instanceId === tid && e.amount > 0
  );
}

export const GraceTouched = {
  name: 'Grace-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Grace domain, gain the following benefits:\n\n- You can **mark an Armor Slot** instead of marking a Stress.\n- When you would force a target to mark a number of Hit Points, you can choose instead to force them to mark that number of Stress.',
  chips: [
    when(graceTouchedActive, pendingStressOnMe, {
      name: 'Grace-Touched — Armor instead of Stress',
      placements: ['reviewOutcome'],
      description:
        'Mark Armor Slots instead of marking Stress from this resolution (1-for-1). Requires enough available Armor Slots.',
      isDisabled: (table) =>
        !hasEnoughArmorForPendingStress(table)
          ? 'Not enough unmarked Armor Slots to replace this pending Stress.'
          : false,
      onUse(table) {
        table.action.redeemSelfPendingStressWithArmorMarks();
      },
    }),
    when(isActing, graceTouchedActive, pendingHpOnAttackTarget, {
      name: 'Grace-Touched — Stress instead of HP',
      placements: ['reviewOutcome'],
      description:
        'Your target marks Stress instead of Hit Points (same number of boxes) for this resolution.',
      onUse(table) {
        const tid = table.action.target.instanceId;
        table.action.convertPendingHpLossToStressOnTarget(tid);
      },
    }),
  ],
};
