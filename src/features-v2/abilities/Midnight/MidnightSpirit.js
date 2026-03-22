/**
 * Midnight domain — Midnight Spirit (Tier 1)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function spellcastDiceCount(table) {
  const key = table.me?.spellcastTrait;
  if (!key || !table.me?.traits) return 1;
  const v = Number(table.me.traits[key]);
  return Math.max(1, Number.isFinite(v) ? v : 1);
}

export const MidnightSpirit = {
  name: 'Midnight Spirit',
  description:
    '**Spend a Hope** to summon a humanoid-sized spirit that can move or carry things for you until your next rest.\n\nYou can also send it to attack an adversary. When you do, make a **Spellcast Roll** against a target within Very Far range. On a success, the spirit moves into Melee range with that target. Roll a number of **d6s** equal to your Spellcast trait and deal that much magic damage to the target. The spirit then dissipates. You can only have one spirit at a time.',
  hooks: {
    onRest(table) {
      table.feature.set('midnightSpiritActive', false);
    },
  },
  chips: [
    {
      placements: ['card'],
      name: 'Midnight Spirit — Summon',
      hopeCost: 1,
      description:
        'Summon a humanoid-sized spirit to move or carry things for you until your next rest. Only one spirit at a time.',
      onUse(table) {
        table.feature.set('midnightSpiritActive', true);
        table.me.actionLoop(
          'Midnight Spirit — Summon',
          'Spend 1 Hope. Summon a humanoid-sized spirit that can move or carry things until your next rest. You can only have one spirit at a time (using Strike dissipates it).'
        );
      },
    },
    {
      placements: ['card'],
      name: 'Midnight Spirit — Strike',
      description:
        'Send your spirit to attack: Spellcast vs a target within Very Far; on success, spirit enters Melee and you roll Spellcast d6s in magic damage; spirit dissipates.',
      isDisabled: (table) => table.feature.get('midnightSpiritActive') !== true,
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        const n = spellcastDiceCount(table);
        table.me.actionLoop(
          'Midnight Spirit — Strike',
          `Make a Spellcast (${trait}) roll vs a target within Very Far. On a success, the spirit enters Melee with that target, you roll ${n}d6 magic damage (Spellcast trait), then the spirit dissipates.`,
          { trait }
        );
        table.feature.set('midnightSpiritActive', false);
      },
    },
  ],
};
