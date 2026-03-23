/**
 * Blade domain — Versatile Fighter (Tier 1)
 * SRD: Use a different character trait for an equipped weapon than the trait the weapon calls for.
 * When you deal damage, you can mark a Stress to use the maximum result of one of your damage dice instead of rolling it.
 */

import { when, isActing } from '../../engine/when.js';

/** Max total for a single damage die entry (`d8` → 8, `2d6` → 12). */
function maxFaceForDieNotation(die) {
  if (!die || typeof die !== 'string') return null;
  const m = die.match(/^(\d+)d(\d+)$/i);
  if (m) {
    const n = Number(m[1]);
    const faces = Number(m[2]);
    if (!(n > 0) || !(faces > 0)) return null;
    return n * faces;
  }
  const m2 = die.match(/^d(\d+)$/i);
  if (m2) {
    const faces = Number(m2[1]);
    return faces > 0 ? faces : null;
  }
  return null;
}

export const VersatileFighter = {
  name: 'Versatile Fighter',
  description:
    'You can use a different character trait for an equipped weapon, rather than the trait the weapon calls for. When you deal damage, you can **mark a Stress** to use the maximum result of one of your damage dice instead of rolling it.',
  chips: [
    {
      placements: ['card'],
      name: 'Versatile Fighter — weapon trait',
      description:
        'When you attack with a weapon, you may use a different trait than the weapon’s listed trait. Tell the GM which trait you are using before you roll.',
      onUse(table) {
        table.me.actionLoop(
          'Versatile Fighter',
          'Declare which trait you are using for this weapon attack (it may differ from the weapon’s listed trait).',
          { type: 'attack' }
        );
      },
    },
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      (t) => t.rolls?.damage != null,
      (t) => (t.rolls?.damage?.dice ?? []).some((d) => d?.name && d?.die),
      {
        placements: ['reviewAction'],
        name: 'Versatile Fighter — max die',
        description: 'Mark a Stress to treat one damage die as having rolled its maximum result.',
        stressCost: 1,
        isSelect: (table) =>
          (table.rolls?.damage?.dice ?? [])
            .filter((d) => d?.name && d?.die)
            .map((d) => ({
              id: d.name,
              name: `${d.name} (${d.die})`,
            })),
        isDisabled: (table) =>
          !(table.rolls?.damage?.dice ?? []).some((d) => d?.name && d?.die)
            ? 'No damage dice on this roll to maximize.'
            : false,
        onUse(table, chipState) {
          const selected = chipState?.get?.('selectedId');
          const dice = table.rolls?.damage?.dice ?? [];
          const d = selected ? dice.find((x) => x.name === selected) : dice.find((x) => x?.name && x?.die);
          if (!d?.name || !d?.die) return;
          const max = maxFaceForDieNotation(d.die);
          if (max == null) return;
          table.rolls.damage.removeDie(d.name);
          table.rolls.damage.addDie({ name: d.name, die: d.die, value: max });
        },
      }
    ),
  ],
};
