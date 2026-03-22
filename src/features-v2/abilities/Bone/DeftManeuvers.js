/**
 * Bone domain — Deft Maneuvers (Tier 1)
 * SRD: Once per rest, mark a Stress to sprint anywhere within Far range without an Agility Roll.
 * If you end this movement within Melee range of an adversary and immediately attack them, +1 to the attack roll.
 */

import { when, isActing } from '../../engine/when.js';

function meleeAttackVsAdversary(table) {
  if (table.action?.type !== 'attack') return false;
  if (table.action?.range !== 'melee') return false;
  const tgt = table.action?.target;
  return !!(tgt && (tgt.isAdversary === true || tgt.elementType === 'adversary'));
}

export const DeftManeuvers = {
  name: 'Deft Maneuvers',
  description:
    'Once per rest, **mark a Stress** to sprint anywhere within Far range without making an Agility Roll to get there. If you end this movement within Melee range of an adversary and immediately make an attack against them, gain a +1 bonus to the attack roll.',
  chips: [
    {
      placements: ['card'],
      name: 'Sprint (Far)',
      frequency: 'rest',
      stressCost: 1,
      placement: 'card',
      label: 'Sprint (Far)',
      _featureKey: 'Deft Maneuvers',
      resetsOn: 'rest',
      description:
        'Once per rest: mark 1 Stress to sprint anywhere within Far range without an Agility roll (GM: reposition). Your next Melee attack against an adversary gains +1 if you ended that movement within Melee of them and attack immediately.',
      /** `activateChip` passes the table snapshot as the first argument (`chip-system.js`). */
      onUse(table) {
        if (!table?.feature?.set) return;
        table.feature.set('deftManeuversNextAttackBonus', true);
        table.me?.actionLoop?.(
          'Deft Maneuvers',
          'Sprint anywhere within Far range without making an Agility roll to get there (GM: reposition your token). If you ended within Melee of a foe, your next immediate Melee attack against them gains +1 to the attack roll.'
        );
      },
    },
  ],
  hooks: {
    onIntent: when(
      isActing,
      meleeAttackVsAdversary,
      (t) => t.feature.get('deftManeuversNextAttackBonus') === true,
      (t) => {
        t.rolls?.action?.addStatic({ name: 'Deft Maneuvers', value: 1 });
        t.feature.set('deftManeuversNextAttackBonus', false);
      }
    ),
    onRest(table) {
      if (table.action?.type === 'shortRest' || table.action?.type === 'longRest') {
        table.feature.set('deftManeuversNextAttackBonus', false);
      }
    },
  },
  /** Game Table: +1 on next weapon attack roll after Sprint (merged `activeFeatures` + `runCharacterHook`). */
  onRoll(ctx) {
    const { roll, feature } = ctx;
    const meta = roll?.meta || {};
    if (!meta._weaponId) return;
    const ready = typeof feature?.get === 'function' ? feature.get('deftManeuversNextAttackBonus', false) : false;
    if (!ready) return;
    if (typeof roll.addRollBonus === 'function') roll.addRollBonus(1);
    feature?.set?.('deftManeuversNextAttackBonus', false);
  },
};
