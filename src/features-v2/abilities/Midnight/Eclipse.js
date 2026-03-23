/**
 * Midnight domain — Eclipse (Tier 3 domain spell / SRD level 10; Recall Cost 2)
 * SRD: daggerheart-srd/abilities/Eclipse.md
 */

import { when, isTargeted, unwrap, youTakeSevereDamage } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function isWithinFarBand(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close' || b === 'far';
}

function hopeDominates(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return h > f;
}

/** Adversary target of the current action that lies within the eclipse (Far of the caster). */
function firstAdversaryInShadow(table) {
  const targets = table.action?.targets ?? [];
  for (const t of targets) {
    if (!t?.isAdversary) continue;
    if (isWithinFarBand(table, t)) return t;
  }
  return null;
}

export const Eclipse = {
  name: 'Eclipse',
  description:
    'Make a **Spellcast Roll (16)**. Once per long rest on a success, plunge the entire area within Far range into complete darkness only you and your allies can see through. Attack rolls have disadvantage when targeting you or an ally within this shadow.\n\nAdditionally, when you or an ally succeeds with Hope against an adversary within this shadow, the target must mark a Stress.\n\nThis spell lasts until the GM spends a Fear on their turn to clear this effect or you take Severe damage.',
  hooks: {
    onIntent: when(
      (table) => table.feature.get('eclipseActive') === true,
      (table) => table.action?.type === 'attack',
      (table) => table.action?.actor?.isAdversary === true,
      (table) =>
        table.action.targets.some((t) => t?.isCharacter === true && isWithinFarBand(table, t)),
      (table) => {
        table.rolls?.action?.addDisadvantageDie('Eclipse');
      }
    ),
    onReviewAction(table) {
      const resolveSpellcast = unwrap(
        when(
          (t) =>
            t.action?.type === 'spellcast' &&
            t.feature.get('eclipseAwaitingSpellcast') === true &&
            typeof t.rolls?.action?.isSuccess === 'boolean',
          (t) => {
            t.feature.set('eclipseAwaitingSpellcast', false);
            if (t.rolls.action.isSuccess === true) {
              t.feature.set('eclipseActive', true);
            }
          }
        ),
        table
      );
      if (typeof resolveSpellcast === 'function') {
        resolveSpellcast(table);
        return;
      }

      const applyHopeStress = unwrap(
        when(
          (t) => t.feature.get('eclipseActive') === true,
          (t) => t.rolls?.action?.isSuccess === true,
          hopeDominates,
          (t) => t.rolls?.action?.hopeDie != null && t.rolls?.action?.fearDie != null,
          (t) => t.action?.actor?.isCharacter === true,
          (t) => firstAdversaryInShadow(t) != null,
          (t) => {
            firstAdversaryInShadow(t).markStress(1);
          }
        ),
        table
      );
      if (typeof applyHopeStress === 'function') {
        applyHopeStress(table);
      }
    },
    onReviewOutcome: when(
      (table) => table.feature.get('eclipseActive') === true,
      isTargeted,
      youTakeSevereDamage,
      (table) => {
        table.feature.set('eclipseActive', false);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Eclipse',
      hopeCost: 2,
      frequency: 'longRest',
      description:
        'Spellcast (16), 2 Hope (recall). On success, Far-range shadow: attacks vs you or allies in the shadow have disadvantage; Hope successes vs adversaries in the shadow mark their Stress. Ends when the GM spends 1 Fear or you take Severe damage.',
      onUse(table) {
        table.feature.set('eclipseAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Eclipse',
          `Make a Spellcast (${trait}) roll (16). Once per long rest on a success, plunge the area within Far range into darkness only you and your allies can see through. Attack rolls have disadvantage when targeting you or an ally in this shadow. When you or an ally succeeds with Hope against an adversary in the shadow, that adversary marks a Stress. This lasts until the GM spends a Fear on their turn to clear it or you take Severe damage.`,
          { trait, difficulty: 16 }
        );
      },
    },
    when((table) => table.feature.get('eclipseActive') === true, {
      placements: ['card'],
      name: 'Eclipse — GM clears shadow',
      description:
        'GM spends 1 Fear on the GM\'s turn to end the eclipse shadow (VTT / table).',
      onUse(table) {
        table.top.spendFear(1);
        table.feature.set('eclipseActive', false);
      },
    }),
  ],
};
