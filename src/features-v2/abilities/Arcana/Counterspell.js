/**
 * Arcana — Counterspell (domain spell card tier 1, SRD level 3)
 * SRD: daggerheart-srd/abilities/Counterspell.md
 */

import { when } from '../../engine/when.js';

const COUNTERSPELL_CARD_ID = 'srd-abl-counterspell';

export const Counterspell = {
  name: 'Counterspell',
  description:
    'You can interrupt a magical effect taking place by making a reaction roll using your Spellcast trait. On a success, the effect stops and any consequences are avoided, and this card is placed in your vault.',
  chips: [
    when(
      (table) => table.action?.type === 'reaction',
      (table) => table.rolls?.action?.isSuccess === true,
      {
        name: 'Counterspell',
        description:
          'The interrupt succeeds — the magical effect stops. Move this card from your loadout to your vault (host applies `domainCardMoveToVault`).',
        placements: ['reviewAction'],
        onUse(table) {
          table.me.moveDomainCardToVault(COUNTERSPELL_CARD_ID);
        },
      }
    ),
  ],
};
