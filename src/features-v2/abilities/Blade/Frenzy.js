/**
 * Blade domain — Frenzy (Tier 3 / level 8)
 * SRD: daggerheart-srd/abilities/Frenzy.md
 */

import { when, isActing, isTargeted, armorUseCommitted } from '../../engine/when.js';
import { revokeArmorCommitment } from '../../engine/armor-review-outcome.js';

function frenzyActive(table) {
  return table.feature.get('frenzyActive') === true;
}

function hpRemaining(actor) {
  if (!actor) return false;
  const hp = actor.currentHP ?? actor.currentHp ?? 0;
  return hp > 0;
}

/**
 * Adversaries "within sight": on-map tokens when the table uses the map; otherwise any living adversary.
 */
function anyAdversaryInSight(table) {
  const list = table.adversaries ?? [];
  const mapInUse = list.some((a) => a.tokenX != null && a.tokenY != null);
  if (mapInUse) {
    return list.some(
      (a) => a.tokenX != null && a.tokenY != null && hpRemaining(a)
    );
  }
  return list.some((a) => hpRemaining(a));
}

function noAdversaryInSight(table) {
  return !anyAdversaryInSight(table);
}

function endFrenzyWithNarration(table) {
  table.feature.set('frenzyActive', false);
  table.me.actionLoop(
    'Frenzy',
    'Your Frenzy ends — there are no adversaries within sight.'
  );
}

export const Frenzy = {
  name: 'Frenzy',
  description:
    'Once per long rest, you can go into a _Frenzy_ until there are no more adversaries within sight.\n\nWhile _Frenzied_, you can\'t use Armor Slots, and you gain a +10 bonus to your damage rolls and a +8 bonus to your Severe damage threshold.',
  frequency: 'longRest',
  onUse(table) {
    table.feature.set('frenzyActive', true);
    table.me.actionLoop(
      'Frenzy',
      'You enter a Frenzy. Until no adversaries remain within sight, you cannot use Armor Slots, you gain +10 to damage rolls, and +8 to your Severe threshold.'
    );
  },
  passiveStatMods: when(frenzyActive, {
    severeThreshold: 8,
  }),
  hooks: {
    onIntent: when(
      isActing,
      (t) => t.action?.type === 'attack',
      frenzyActive,
      (table) => {
        table.rolls?.damage?.addStatic({ name: 'Frenzy', value: 10 });
      }
    ),
    onReviewOutcome: when(
      isTargeted,
      frenzyActive,
      armorUseCommitted,
      (table) => {
        revokeArmorCommitment(table);
        table.action.addNarration(
          'Frenzy: you cannot use Armor Slots while Frenzied — armor use is cancelled.'
        );
      }
    ),
    onStateChange: when(frenzyActive, noAdversaryInSight, endFrenzyWithNarration),
    onTokenMove: when(frenzyActive, noAdversaryInSight, endFrenzyWithNarration),
    onSceneEnd: when(frenzyActive, (table) => {
      table.feature.set('frenzyActive', false);
    }),
    onRest: when(
      (t) => t.action?.type === 'longRest',
      frenzyActive,
      (table) => {
        table.feature.set('frenzyActive', false);
      }
    ),
  },
};
