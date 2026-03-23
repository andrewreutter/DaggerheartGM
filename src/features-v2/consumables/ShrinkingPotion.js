/**
 * SRD consumable — Shrinking Potion (common roll table 53).
 * daggerheart-srd/consumables/Shrinking Potion.md
 */

import { when, isActing } from '../engine/when.js';

const MOD_ID = 'cns-shrinking-potion';

function hasShrinkingForm(table) {
  return (table.me.activeModifiers ?? []).some((m) => m.id === MOD_ID);
}

/** Rolls that typically add your Proficiency bonus (attacks and domain spell cards). */
function usesProficiencyBonus(table) {
  const t = table.action;
  if (!t) return false;
  if (t.type === 'attack') return true;
  if (t.abilityId) return true;
  return false;
}

export const ShrinkingPotion = {
  name: 'Shrinking Potion',
  description:
    'You can drink this potion to halve your size until you choose to drop this form or your next rest. While in this form, you have a +2 bonus to Agility and a -1 penalty to your Proficiency.',
  onUse(table) {
    table.me.removeActiveModifier(MOD_ID);
    table.me.addActiveModifier({
      id: MOD_ID,
      name: 'Shrunk (Shrinking Potion)',
      type: 'consumable',
      refreshOn: 'rest',
    });
  },
  chips: [
    when((table) => hasShrinkingForm(table), {
      description: 'Drop your shrunk form (before rest).',
      placements: ['card'],
      onUse(table) {
        table.me.removeActiveModifier(MOD_ID);
      },
    }),
  ],
  hooks: {
    onIntent: when(
      isActing,
      hasShrinkingForm,
      (table) => {
        if (table.action?.trait === 'Agility') {
          table.rolls?.action?.addStatic({ name: 'Shrinking Potion', value: 2 });
        }
        if (usesProficiencyBonus(table)) {
          table.rolls?.action?.addStatic({ name: 'Shrinking Potion', value: -1 });
        }
      }
    ),
  },
};
