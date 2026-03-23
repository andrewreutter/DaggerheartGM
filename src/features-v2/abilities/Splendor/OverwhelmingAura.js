/**
 * Splendor domain — Overwhelming Aura (Tier 2 / SRD level 9; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Overwhelming Aura.md
 */

import { when, isActing, isTargeted, unwrap } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function auraActive(table) {
  return table.feature.get('overwhelmingAuraActive') === true;
}

/** Presence score becomes equal to Spellcast trait score — additive delta vs base Presence. */
function presenceDeltaToMatchSpellcast(table) {
  const traits = table.me?.traits || {};
  const skRaw = table.me?.spellcastTrait;
  if (!skRaw) return 0;
  const sk = String(skRaw).toLowerCase();
  const keys = Object.keys(traits);
  const matchKey = keys.find((k) => k.toLowerCase() === sk) ?? skRaw;
  const spellVal = Number(traits[matchKey]) || 0;
  const pres = Number(traits.presence) || 0;
  return spellVal - pres;
}

export const OverwhelmingAura = {
  name: 'Overwhelming Aura',
  description:
    'Make a **Spellcast Roll (15)** to magically empower your aura. On a success, **spend 2 Hope** to make your Presence equal to your Spellcast trait until your next long rest.\n\nWhile this spell is active, an adversary must mark a Stress when they target you with an attack.',
  passiveStatMods: when(auraActive, {
    presence: (table) => presenceDeltaToMatchSpellcast(table),
  }),
  hooks: {
    onReviewAction(table) {
      const resolveSpellcast = unwrap(
        when(
          isActing,
          (t) =>
            t.action?.type === 'spellcast' &&
            t.feature.get('oaAwaitingSpellcast') === true &&
            typeof t.rolls?.action?.isSuccess === 'boolean',
          (t) => {
            t.feature.set('oaAwaitingSpellcast', false);
            if (t.rolls?.action?.isSuccess === true) {
              t.feature.set('oaAwaitingHope', true);
            }
          }
        ),
        table
      );
      if (typeof resolveSpellcast === 'function') {
        resolveSpellcast(table);
        return;
      }

      const applyStress = unwrap(
        when(
          isTargeted,
          auraActive,
          (t) => t.action?.type === 'attack',
          (t) => t.action?.attacker?.isAdversary === true,
          (t) => {
            t.action.attacker.markStress(1);
            t.action.addNarration(
              'Overwhelming Aura: the attacker marks a Stress to target you.'
            );
          }
        ),
        table
      );
      if (typeof applyStress === 'function') {
        applyStress(table);
      }
    },
    onRest: when(
      (table) => table.action?.type === 'longRest',
      (table) => {
        table.feature.set('overwhelmingAuraActive', false);
        table.feature.set('oaAwaitingSpellcast', false);
        table.feature.set('oaAwaitingHope', false);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Overwhelming Aura',
      description:
        'Spellcast (15). On a success, spend 2 Hope to make your Presence equal to your Spellcast trait until your next long rest. While active, adversaries must mark a Stress when they target you with an attack.',
      onUse(table) {
        table.feature.set('oaAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Overwhelming Aura',
          `Make a Spellcast (${trait}) roll (15). On a success, spend 2 Hope to make your Presence equal to your Spellcast trait until your next long rest. While the aura is active, an adversary must mark a Stress when they target you with an attack.`,
          { trait, difficulty: 15 }
        );
      },
    },
    when(
      (table) => table.feature.get('oaAwaitingHope') === true,
      {
        placements: ['card'],
        name: 'Empower aura',
        hopeCost: 2,
        description:
          'After a successful Spellcast (15), spend 2 Hope to activate the aura until your next long rest.',
        onUse(table) {
          table.feature.set('oaAwaitingHope', false);
          table.feature.set('overwhelmingAuraActive', true);
          table.me.actionLoop(
            'Overwhelming Aura',
            'Your Presence matches your Spellcast trait until your next long rest. Adversaries who target you with an attack must mark a Stress.'
          );
        },
      }
    ),
  ],
};
