/**
 * Arcana — Arcane Reflection (domain spell card tier 2, SRD level 8)
 * SRD: daggerheart-srd/abilities/Arcane Reflection.md
 */

import { when, isTargeted, hasMagicDamage } from '../../engine/when.js';

/** Caster / attacker for reflecting magic damage (attacks expose `attacker`; spells use `actor`). */
function resolveCaster(table) {
  return table.action?.attacker ?? table.action?.actor ?? null;
}

function hopeSpendOptions(table) {
  const h = table.me?.hope ?? 0;
  if (h < 1) return [];
  return Array.from({ length: h }, (_, i) => {
    const n = i + 1;
    return {
      id: String(n),
      name: `Spend ${n} Hope`,
      description: `Roll ${n}d6 — if any roll is a 6, reflect the magic damage to the caster.`,
    };
  });
}

export const ArcaneReflection = {
  name: 'Arcane Reflection',
  description:
    'When you would take magic damage, you can **spend any number of Hope** to roll that many **d6s**. If any roll a 6, the attack is reflected back to the caster, dealing the damage to them instead.',
  chips: [
    when(isTargeted, hasMagicDamage, {
      name: 'Arcane Reflection',
      placements: ['reviewAction'],
      isSelect: (table) => hopeSpendOptions(table),
      isDisabled: (table) => {
        if (hopeSpendOptions(table).length < 1) return 'Need at least 1 Hope.';
        const caster = resolveCaster(table);
        if (!caster || caster.instanceId === table.me?.instanceId) {
          return 'No opposing caster to reflect magic damage onto.';
        }
        return false;
      },
      description:
        'Choose how much Hope to spend, then roll that many d6s. If any die shows a 6, the incoming magic damage hits the caster instead of you.',
      /**
       * Hope is spent inside `onUse` (not `hopeCost` on the chip): the V2 review bridge runs
       * `deductChipCosts` before `activateChip`, so variable Hope tied to `selectedId` must be applied manually.
       */
      onUse(table, chipState) {
        const raw = chipState.get?.('selectedId');
        const n = Math.max(0, Math.floor(Number(raw)) || 0);
        if (n < 1) return;

        const magicDamage = table.action?.effects?.find(
          (e) =>
            e.type === 'damage' &&
            e.target?.instanceId === table.me?.instanceId &&
            e.damageType === 'magic' &&
            e.amount != null &&
            e.amount > 0
        );
        if (!magicDamage) return;

        const caster = resolveCaster(table);
        if (!caster || caster.instanceId === table.me?.instanceId) return;

        const hope = table.me?.hope ?? 0;
        if (hope < n) return;

        table.me.spendHope(n);

        let anySix = false;
        for (let i = 0; i < n; i++) {
          if (table.rollDie('d6') === 6) anySix = true;
        }
        if (!anySix) return;

        magicDamage.target = caster;
        table.action.addNarration('Arcane Reflection: magic damage reflected to the caster.');
      },
    }),
  ],
};
