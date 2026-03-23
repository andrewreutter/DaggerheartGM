/**
 * Bone domain — Splintering Strike (Tier 3 / level 9)
 * SRD: daggerheart-srd/abilities/Splintering Strike.md — Recall Cost 3.
 * Spend 1 Hope to attack all adversaries in weapon range; once per long rest on success, pool weapon damage and add an extra weapon die to each target's share.
 */

import { leadingDamageDieFromString } from '../../engine/weapon-damage-die.js';
import { when, isActing } from '../../engine/when.js';

export const SplinteringStrike = {
  name: 'Splintering Strike',
  description:
    '**Recall Cost 3.** **Spend a Hope** and make an attack against all adversaries within your weapon\'s range. Once per long rest, on a success against any targets, roll your weapon\'s damage and distribute that damage however you wish between the targets you succeeded against. Before you deal damage to each target, roll an additional damage die and add its result to the damage you deal to them.',
  chips: [
    {
      name: 'Splintering Strike',
      placements: ['card'],
      hopeCost: 1,
      description:
        'Spend 1 Hope and make an attack against all adversaries within your weapon\'s range.',
      onUse(table) {
        table.feature.set('splinteringStrikeActive', true);
        table.me.actionLoop(
          'Splintering Strike',
          'Spend 1 Hope. Make an attack against each adversary within your weapon range.'
        );
      },
    },
    when(
      isActing,
      (t) => t.action?.type === 'attack',
      (t) => t.rolls?.action?.isSuccess === true,
      (t) => t.feature.get('splinteringStrikeActive') === true,
      (t) => t.rolls?.damage != null,
      {
        name: 'Splintering Strike — pooled damage',
        placements: ['reviewAction'],
        frequency: 'longRest',
        description:
          'Once per long rest after a successful Splintering Strike: roll your weapon damage once and split it among targets you hit. Before damage to each target, roll an additional damage die (same die size as your weapon) and add it to that target\'s share.',
        onUse(table) {
          const die = leadingDamageDieFromString(table.me.primaryWeapon?.damage);
          const idCount = table.action?.targetInstanceIds?.length ?? 0;
          const resolvedCount = table.action?.targets?.length ?? 0;
          const count =
            idCount > 0 ? idCount : resolvedCount > 0 ? resolvedCount : 1;
          for (let i = 0; i < count; i += 1) {
            const name =
              count === 1 ? 'Splintering Strike (extra)' : `Splintering Strike (extra ${i + 1})`;
            table.rolls.damage.addDie({ name, die });
          }
          table.me.actionLoop(
            'Splintering Strike',
            'Once per long rest: GM rolls weapon damage once, splits among targets you hit, and adds an extra weapon die to each target\'s share when applying.'
          );
        },
      }
    ),
  ],
  hooks: {
    onResolve: when(
      isActing,
      (t) => t.action?.type === 'attack',
      (t) => t.feature.get('splinteringStrikeActive') === true,
      (table) => {
        table.feature.set('splinteringStrikeActive', false);
      }
    ),
  },
};
