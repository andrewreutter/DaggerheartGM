/**
 * Midnight domain — Vanishing Dodge (Tier 3 domain spell / SRD level 7)
 * SRD: daggerheart-srd/abilities/Vanishing Dodge.md
 */

import { when, isActing, isTargeted } from '../../engine/when.js';

const FS_ACTIVE = 'vanishingDodgeActive';

/** Infer whether the rolled damage line is physical (default) vs magic. */
function inferPhysicalDamageAttack(table) {
  const first = table.rolls?.damage?.dice?.[0];
  if (!first) return false;
  return first.damageType !== 'magic';
}

function failedPhysicalAttackAgainstMe(table) {
  return (
    table.action?.type === 'attack' &&
    table.rolls?.action?.isSuccess === false &&
    inferPhysicalDamageAttack(table)
  );
}

export const VanishingDodge = {
  name: 'Vanishing Dodge',
  description:
    'When an attack made against you that would deal physical damage fails, you can **spend a Hope** to envelop yourself in shadow, becoming _Hidden_ and teleporting to a point within Close range of the attacker. You remain _Hidden_ until the next time you make an action roll.',
  hooks: {
    onIntent: when(isActing, (table) => {
      if (table.feature.get(FS_ACTIVE) !== true) return;
      table.me.removeCondition('Hidden');
      table.feature.set(FS_ACTIVE, false);
    }),
  },
  chips: [
    when(isTargeted, failedPhysicalAttackAgainstMe, {
      placements: ['reviewAction'],
      name: 'Vanishing Dodge',
      hopeCost: 1,
      description:
        'Spend 1 Hope: become Hidden and request a map move to any position within Close range of the attacker (Melee, Very Close, or Close). You stop being Hidden on your next action roll.',
      isDisabled: (table) => {
        const atk = table.action?.attacker;
        if (!atk) return 'No attacker on this action.';
        if (table.me.tokenX == null || table.me.tokenY == null) return 'Place your token on the map.';
        if (atk.tokenX == null || atk.tokenY == null) return 'Attacker must be on the map to teleport near them.';
        return false;
      },
      onUse(table) {
        table.me.addCondition('Hidden');
        table.feature.set(FS_ACTIVE, true);
        const atk = table.action?.attacker;
        if (!atk) return;
        table.me.move(
          (t) => {
            const band = t.me.rangeFrom(atk);
            if (band == null) return false;
            return band === 'melee' || band === 'veryClose' || band === 'close';
          },
          'Within Close range of the attacker (Melee, Very Close, or Close)',
          'Vanishing Dodge: place your token within Close range of the attacker (30 ft or less). You are Hidden until your next action roll.'
        );
      },
    }),
  ],
};
