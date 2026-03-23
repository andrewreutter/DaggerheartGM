/**
 * SRD consumable — Vial of Darksmoke (common roll table 16).
 * daggerheart-srd/consumables/Vial of Darksmoke.md
 */

import { when, isTargeted } from '../engine/when.js';

function adversaryAttack(table) {
  return table.action?.type === 'attack' && table.action?.attacker?.isAdversary === true;
}

function agilityDiceCount(table) {
  const a = table.me?.traits?.agility;
  return Math.max(0, Math.floor(Number(a)) || 0);
}

export const VialOfDarksmoke = {
  name: 'Vial of Darksmoke',
  description:
    'When an adversary attacks you, use this vial and roll a number of d6s equal to your Agility. Add the highest result to your Evasion against the attack.',
  chips: [
    when(
      isTargeted,
      adversaryAttack,
      {
        name: 'Vial of Darksmoke',
        placements: ['reviewAction'],
        description:
          'Use the vial: roll 1d6 per point of Agility and add the highest result to your Evasion against this attack.',
        onUse(table) {
          const n = agilityDiceCount(table);
          let best = 0;
          for (let i = 0; i < n; i++) {
            const v = table.rollDie('d6');
            if (v > best) best = v;
          }
          table.feature.set('vialOfDarksmokeEvasionBonus', best);
        },
        temporaryStatMods: {
          evasion: (t) => t.feature.get('vialOfDarksmokeEvasionBonus') ?? 0,
        },
      }
    ),
  ],
  hooks: {
    onReviewOutcome: when(
      isTargeted,
      adversaryAttack,
      (t) => {
        if ((t.feature.get('vialOfDarksmokeEvasionBonus') ?? 0) > 0) {
          t.feature.set('vialOfDarksmokeEvasionBonus', 0);
        }
      }
    ),
  },
};
