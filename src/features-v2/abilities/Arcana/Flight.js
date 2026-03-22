/**
 * Arcana — Flight (domain spell card tier 1, SRD level 3)
 * SRD: daggerheart-srd/abilities/Flight.md
 */

import { when } from '../../engine/when.js';

export const Flight = {
  name: 'Flight',
  description:
    'Make a **Spellcast Roll (15)**. On a success, place a number of tokens equal to your Agility on this card (minimum 1). When you make an action roll while flying, spend a token from this card. After the action that spends the last token is resolved, you descend to the ground directly below you.',
  chips: [
    {
      placements: ['card'],
      name: 'Flight',
      description:
        'After the GM confirms a successful Spellcast Roll (15), place tokens equal to your Agility (minimum 1). Each Hope/Fear action roll while flying spends one token; at 0 tokens you descend.',
      onUse(table) {
        const raw = table.me?.traits?.agility ?? 0;
        const n = Math.max(1, Math.floor(Number(raw)) || 0);
        table.feature.set('flightTokens', n);
        table.feature.set('flightActive', true);
      },
    },
  ],
  hooks: {
    onIntent: when(
      (table) => table.feature.get('flightActive') === true,
      (table) => table.me?.isActing === true,
      (table) => table.action?.generatesHopeFear === true,
      (table) => {
        const left = Number(table.feature.get('flightTokens')) || 0;
        if (left <= 0) return;
        const next = left - 1;
        table.feature.set('flightTokens', next);
        if (next <= 0) {
          table.feature.set('flightActive', false);
          table.action?.addNarration?.('You descend to the ground directly below you.');
        }
      }
    ),
  },
};
