/**
 * Valor domain — Full Surge (Tier 2 / level 8)
 * SRD: daggerheart-srd/abilities/Full Surge.md
 */

import { when } from '../../engine/when.js';

function fullSurgeActive(table) {
  return table.feature.get('fullSurgeActive') === true;
}

export const FullSurge = {
  name: 'Full Surge',
  description:
    'Once per long rest, **mark 3 Stress** to push your body to its limits. Gain a +2 bonus to all of your character traits until your next rest.',
  frequency: 'longRest',
  stressCost: 3,
  onUse(table) {
    table.feature.set('fullSurgeActive', true);
    table.me.actionLoop(
      'Full Surge',
      'You mark 3 Stress and gain +2 to all traits until your next rest.'
    );
  },
  passiveStatMods: when(fullSurgeActive, {
    agility: 2,
    strength: 2,
    finesse: 2,
    instinct: 2,
    presence: 2,
    knowledge: 2,
  }),
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'shortRest' || t.action?.type === 'longRest',
      (table) => {
        table.feature.set('fullSurgeActive', false);
      }
    ),
  },
};
