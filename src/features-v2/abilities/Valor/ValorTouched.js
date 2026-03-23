/**
 * Valor domain — Valor-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Valor-Touched.md
 */

import { when, isTargeted, armorUseCommitted } from '../../engine/when.js';

function valorDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'valor').length;
}

function valorTouchedActive(table) {
  return valorDomainCardsInLoadout(table) >= 4;
}

function isPendingHpLossEffect(e) {
  const amt = e.amount ?? 0;
  if (!(amt > 0)) return false;
  if (e.stat === 'currentHP') return true;
  if (e.type === 'damage') return true;
  return false;
}

function hasPendingSelfHpLoss(table) {
  const id = table.me?.instanceId;
  if (!id) return false;
  return (table.action?.effects ?? []).some((e) => {
    if (!isPendingHpLossEffect(e)) return false;
    return e.target?.instanceId === id;
  });
}

function notUsingArmorForThisHit(table) {
  return !armorUseCommitted(table);
}

function hasMarkedArmorSlot(table) {
  const max = table.me?.maxArmor ?? 0;
  const avail = table.me?.armor ?? 0;
  return max > avail;
}

export const ValorTouched = {
  name: 'Valor-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Valor domain, gain the following benefits:\n\n- +1 bonus to your Armor Score\n- When you mark 1 or more Hit Points without marking an Armor Slot, clear an Armor Slot.',
  passiveStatMods: when(valorTouchedActive, {
    armorScore: 1,
  }),
  hooks: {
    onReviewOutcome: when(
      valorTouchedActive,
      isTargeted,
      notUsingArmorForThisHit,
      hasMarkedArmorSlot,
      hasPendingSelfHpLoss,
      (table) => {
        table.me.clearArmor(1);
        table.action.addNarration(
          `${table.me?.name ?? 'You'} — Valor-Touched: clear an Armor Slot after taking Hit Point damage without using armor.`
        );
      }
    ),
  },
};
