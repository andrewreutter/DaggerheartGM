/**
 * Blade domain — Battle Cry (Tier 2 / level 8)
 * SRD: daggerheart-srd/abilities/Battle Cry.md — Recall Cost 2.
 */

import { when } from '../../engine/when.js';

function rallyIsActive(table) {
  return table.feature.get('battleCryRallyActive') === true;
}

/** Fear dominates (failure with Fear) on a duality action roll. */
function fearFailureRoll(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return h < f;
}

export const BattleCry = {
  name: 'Battle Cry',
  description:
    'Once per long rest, while you\'re charging into danger, you can muster a rousing call that inspires your allies. All allies who can hear you each clear a Stress and gain a Hope. Additionally, your allies gain advantage on attack rolls until you or an ally rolls a failure with Fear.',
  frequency: 'longRest',
  onUse(table) {
    for (const ally of table.characters) {
      if (ally.instanceId === table.me.instanceId) continue;
      ally.clearStress(1);
      ally.gainHope(1);
    }
    table.feature.set('battleCryGrantorInstanceId', table.me.instanceId);
    table.feature.set('battleCryRallyActive', true);
    table.me.actionLoop(
      'Battle Cry',
      'Allies who can hear you clear a Stress, gain a Hope, and have advantage on attack rolls until someone rolls a failure with Fear (Hope < Fear on a duality roll).'
    );
  },
  hooks: {
    onIntent: when(
      rallyIsActive,
      (t) => t.action?.type === 'attack',
      (t) => {
        const actor = t.action?.actor;
        if (!actor?.isCharacter) return;
        if (actor.instanceId === t.me.instanceId) return;
        const already = (t.rolls?.action?.dice ?? []).some((d) => d.name === 'Battle Cry');
        if (already) return;
        t.rolls?.action?.addAdvantageDie('Battle Cry');
      }
    ),
    onReviewOutcome: when(
      rallyIsActive,
      (t) => t.action?.generatesHopeFear === true,
      fearFailureRoll,
      (t) => {
        t.feature.set('battleCryRallyActive', false);
        t.feature.set('battleCryGrantorInstanceId', null);
      }
    ),
  },
};
