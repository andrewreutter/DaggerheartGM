/**
 * Valor domain — Rousing Strike (Tier 2 / level 5)
 * SRD: daggerheart-srd/abilities/Rousing Strike.md
 * Once per rest on a critical attack success: you and allies who can see or hear you may each clear 1 HP or 1d4 Stress.
 */

import { when, isActing } from '../../engine/when.js';

const DESC =
  'Once per rest, when you critically succeed on an attack, you and all allies who can see or hear you can clear a Hit Point or **1d4** Stress.';

export const RousingStrike = {
  name: 'Rousing Strike',
  description: DESC,
  chips: [
    {
      name: 'Rousing Strike',
      description: DESC,
      placements: ['card'],
      frequency: 'rest',
    },
  ],
  hooks: {
    onRest: when(
      (t) => t.action?.type === 'shortRest' || t.action?.type === 'longRest',
      (table) => {
        table.feature.set('rousingStrikeUsed', false);
      }
    ),
    onResolve: when(
      isActing,
      (t) => t.action?.type === 'attack',
      (t) => t.rolls?.action?.isCritical === true,
      (t) => !t.feature.get('rousingStrikeUsed'),
      (t) => {
        t.feature.set('rousingStrikeUsed', true);
        t.me.actionLoop(
          'Rousing Strike',
          "You critically succeed on an attack: you and each ally who can see or hear you may each clear 1 Hit Point or clear 1d4 Stress (each person's choice; GM applies)."
        );
      }
    ),
  },
};
