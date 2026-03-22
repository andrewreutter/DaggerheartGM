import { when, isActing } from '../engine/when.js';

/**
 * Wizard class features — SRD: daggerheart-srd/classes/Wizard.md
 */

/**
 * Adversary making the attack is within Far range of the feature owner (not Very Far; map unknown → false).
 */
function adversaryWithinFarOfOwner(table) {
  const actor = table.action?.actor;
  if (!actor || actor.isAdversary !== true) return false;
  const band = table.me?.rangeFrom(actor);
  if (band == null) return false;
  return band !== 'veryFar';
}

function isAdversaryAttackWithinFar(table) {
  return (
    table.action?.type === 'attack' &&
    table.action?.actor?.isAdversary === true &&
    adversaryWithinFarOfOwner(table)
  );
}

/** Adversary attacks use the GM die (d20-based), not Hope/Fear. */
function hasGmDie(table) {
  return table.rolls?.action?.gmDie != null;
}

function hasDamageDice(table) {
  return (table.rolls?.damage?.dice?.length ?? 0) > 0;
}

export const NotThisTime = {
  name: 'Not This Time',
  description:
    'Spend 3 Hope to force an adversary within Far range to reroll an attack or damage roll.',
  chips: [
    when(isAdversaryAttackWithinFar, hasGmDie, {
      name: 'Not This Time — reroll attack',
      description:
        'Spend 3 Hope to force this adversary to reroll the attack roll (GM die).',
      placements: ['reviewAction'],
      hopeCost: 3,
      onUse(table) {
        table.rolls?.action?.gmDie?.reroll();
      },
    }),
    when(isAdversaryAttackWithinFar, hasDamageDice, {
      name: 'Not This Time — reroll damage',
      description:
        'Spend 3 Hope to force this adversary to reroll all damage dice on this attack.',
      placements: ['reviewAction'],
      hopeCost: 3,
      onUse(table) {
        table.rolls?.damage?.rerollAllDice();
      },
    }),
  ],
};

export const Prestidigitation = {
  name: 'Prestidigitation',
  description:
    "You can perform harmless, subtle magical effects at will. For example, you can change an object's color, create a smell, light a candle, cause a tiny object to float, illuminate a room, or repair a small object.",
};

function dualityMatchesChosenNumber(table) {
  const n = Number(table.feature.get('patternNumber'));
  if (!n || n < 1 || n > 12) return false;
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return h === n || f === n;
}

function generatesHopeFear(table) {
  return table.action?.generatesHopeFear === true;
}

export const StrangePatterns = {
  name: 'Strange Patterns',
  description:
    'Choose a number between 1 and 12. When you roll that number on a Duality Die, gain a Hope or clear a Stress. You can change this number when you take a long rest.',
  chips: [
    {
      placements: ['create'],
      isSelect: () =>
        Array.from({ length: 12 }, (_, i) => ({
          id: String(i + 1),
          name: String(i + 1),
        })),
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (id) table.feature.set('patternNumber', Number(id));
      },
    },
    when(
      isActing,
      generatesHopeFear,
      dualityMatchesChosenNumber,
      (table) => table.feature.get('strangePatternsUsed') !== true,
      {
        name: 'Strange Patterns — gain Hope',
        description: 'Gain 1 Hope.',
        placements: ['reviewAction'],
        onUse(table) {
          table.me.gainHope(1);
          table.feature.set('strangePatternsUsed', true);
        },
      }
    ),
    when(
      isActing,
      generatesHopeFear,
      dualityMatchesChosenNumber,
      (table) => table.feature.get('strangePatternsUsed') !== true,
      {
        name: 'Strange Patterns — clear Stress',
        description: 'Clear 1 Stress.',
        placements: ['reviewAction'],
        onUse(table) {
          table.me.clearStress(1);
          table.feature.set('strangePatternsUsed', true);
        },
      }
    ),
    when(
      (table) => table.feature.get('restChangeAvailable') === true,
      {
        name: 'Strange Patterns — new number',
        description: 'After a long rest, choose a new duality number (1–12).',
        placements: ['card'],
        isSelect: () =>
          Array.from({ length: 12 }, (_, i) => ({
            id: String(i + 1),
            name: String(i + 1),
          })),
        onUse(table, chip) {
          const id = chip.get('selectedId');
          if (id) {
            table.feature.set('patternNumber', Number(id));
            table.feature.set('restChangeAvailable', false);
          }
        },
      }
    ),
  ],
  hooks: {
    onReviewAction(table) {
      if (table.me?.isActing !== true) return;
      table.feature.set('strangePatternsUsed', false);
    },
    onRest(table) {
      if (table.action?.type === 'longRest') {
        table.feature.set('restChangeAvailable', true);
      }
    },
  },
};
