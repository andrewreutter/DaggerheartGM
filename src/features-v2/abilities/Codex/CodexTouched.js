/**
 * Codex domain — Codex-Touched (Tier 2 / Level 7)
 * SRD: daggerheart-srd/abilities/Codex-Touched.md
 */

import { when, isActing } from '../../engine/when.js';

function codexDomainCardsInLoadout(table) {
  const lo = table.me?.domainLoadout ?? [];
  if (!Array.isArray(lo)) return 0;
  return lo.filter((c) => c && String(c.domain || '').toLowerCase() === 'codex').length;
}

function codexTouchedActive(table) {
  return codexDomainCardsInLoadout(table) >= 4;
}

export const CodexTouched = {
  name: 'Codex-Touched',
  description:
    'When 4 or more of the domain cards in your loadout are from the Codex domain, gain the following benefits:\n\n- You can **mark a Stress** to add your Proficiency to a Spellcast Roll.\n- Once per rest, replace this card with any card from your vault without paying its Recall Cost.',
  chips: [
    when(
      isActing,
      codexTouchedActive,
      (table) => table.action?.type === 'spellcast',
      {
        name: 'Codex-Touched — Proficiency to Spellcast',
        placements: ['intent'],
        stressCost: 1,
        description: 'Mark 1 Stress to add your Proficiency to this Spellcast Roll.',
        onUse(table) {
          const p = table.me?.proficiency ?? 1;
          table.rolls?.action?.addStatic?.({ name: 'Codex-Touched', value: p });
        },
      }
    ),
    when(codexTouchedActive, {
      placements: ['card'],
      frequency: 'rest',
      name: 'Codex-Touched — Vault swap',
      description:
        'Once per rest, replace this card with any domain card from your vault without paying its Recall Cost (host moves cards on your sheet).',
      onUse(table) {
        table.me.actionLoop(
          'Codex-Touched — Vault swap',
          'Replace Codex-Touched in your loadout with any domain card from your vault without paying Recall Cost. Host/GM updates your loadout and vault on your character sheet.'
        );
      },
    }),
  ],
};
