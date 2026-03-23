/**
 * SRD consumable — Enlighten Potion (roll table 06).
 */

import { when, isActing } from '../engine/when.js';

const MOD_ID = 'cns-enlighten-potion-next-knowledge';

function hasEnlightenModifier(table) {
  const mods = table.me.activeModifiers ?? [];
  return mods.some((m) => m.id === MOD_ID);
}

export const EnlightenPotion = {
  name: 'Enlighten Potion',
  description: 'You gain a +1 bonus to your next Knowledge Roll.',
  onUse(table) {
    table.me.addActiveModifier({
      id: MOD_ID,
      name: 'Enlighten Potion',
    });
  },
  hooks: {
    onIntent: when(
      isActing,
      (table) => hasEnlightenModifier(table) && table.action?.trait === 'Knowledge',
      (table) => {
        table.rolls?.action?.addStatic({ name: 'Enlighten Potion', value: 1 });
        table.me.removeActiveModifier(MOD_ID);
      }
    ),
  },
};
