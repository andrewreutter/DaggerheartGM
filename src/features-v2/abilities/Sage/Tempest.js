/**
 * Sage domain — Tempest (Level 10 spell; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Tempest.md
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function tempestBody(mode) {
  const base =
    'Spend 2 Hope (recall). Make a Spellcast roll against all targets within Far range. Each target you succeed against suffers the tempest effects until the GM spends a Fear on their turn to end this spell.';
  switch (mode) {
    case 'hurricane':
      return `${base} **Hurricane:** Deal **3d10+10** magic damage. Choose a direction the wind is blowing; affected targets cannot move against the wind.`;
    case 'sandstorm':
      return `${base} **Sandstorm:** Deal **5d6+9** magic damage. Attacks made from beyond Melee range against affected targets have disadvantage.`;
    case 'blizzard':
    default:
      return `${base} **Blizzard:** Deal **2d20+8** magic damage; affected targets are temporarily _Vulnerable_.`;
  }
}

export const Tempest = {
  name: 'Tempest',
  description:
    'Choose one of the following tempests and make a **Spellcast Roll** against all targets within Far range. Targets you succeed against experience its effects until the GM spends a Fear on their turn to end this spell.\n\n- _Blizzard_: Deal **2d20+8** magic damage and targets are temporararily _Vulnerable._\n- _Hurricane_: Deal **3d10+10** magic damage and choose a direction the wind is blowing. Targets can\'t move against the wind.\n- _Sandstorm_: Deal **5d6+9** magic damage. Attacks made from beyond Melee range have disadvantage.',
  chips: [
    {
      placements: ['card'],
      name: 'Tempest',
      hopeCost: 2,
      description:
        'Spend 2 Hope (recall). Pick Blizzard, Hurricane, or Sandstorm, then make a Spellcast roll vs all targets within Far range; on each success, apply that tempest until the GM spends Fear to end it.',
      isSelect: () => [
        { id: 'blizzard', label: 'Blizzard — 2d20+8 magic + Vulnerable' },
        { id: 'hurricane', label: 'Hurricane — 3d10+10 magic + wind blocks movement' },
        { id: 'sandstorm', label: 'Sandstorm — 5d6+9 magic + beyond-Melee attacks at disadvantage' },
      ],
      onUse(table, chip) {
        const mode = String(chip.get?.('selectedId') ?? 'blizzard');
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop('Tempest', tempestBody(mode), { trait });
      },
    },
  ],
};
