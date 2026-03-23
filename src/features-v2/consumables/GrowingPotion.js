/**
 * SRD consumable — Growing Potion (common roll table 54).
 * daggerheart-srd/consumables/Growing Potion.md
 */

import { when } from '../engine/when.js';

const ACTIVE_KEY = 'growingPotionEnlarged';

export const GrowingPotion = {
  name: 'Growing Potion',
  description:
    'You can drink this potion to double your size until you choose to drop this form or your next rest. While in this form, you have a +2 bonus to Strength and a +1 bonus to your Proficiency.',
  chips: [
    when((t) => t.feature.get(ACTIVE_KEY) !== true, {
      name: 'Growing Potion',
      description:
        'You can drink this potion to double your size until you choose to drop this form or your next rest. While in this form, you have a +2 bonus to Strength and a +1 bonus to your Proficiency.',
      placements: ['card'],
      onUse(table) {
        table.feature.set(ACTIVE_KEY, true);
      },
    }),
    when((t) => t.feature.get(ACTIVE_KEY) === true, {
      name: 'Drop enlarged form',
      description: 'End the doubled-size form before your next rest.',
      placements: ['card'],
      onUse(table) {
        table.feature.set(ACTIVE_KEY, false);
      },
    }),
  ],
  passiveStatMods: when((table) => table.feature.get(ACTIVE_KEY) === true, {
    strength: 2,
    proficiency: 1,
  }),
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'shortRest' || t.action?.type === 'longRest',
      (table) => {
        table.feature.set(ACTIVE_KEY, false);
      }
    ),
  },
};
