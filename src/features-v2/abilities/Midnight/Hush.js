/**
 * Midnight domain — Hush (Tier 2 / SRD level 5 spell)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

/** SRD “within Close range”: Melee, Very Close, or Close bands. */
function withinClose(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function hushEligibleTargets(table) {
  return table.actors.filter(
    (a) => a.instanceId !== table.me.instanceId && withinClose(table, a)
  );
}

export const Hush = {
  name: 'Hush',
  description:
    'Make a **Spellcast Roll** against a target within Close range. On a success, **spend a Hope** to conjure suppressive magic around the target that encompasses everything within Very Close range of them and follows them as they move.\n\nThe target and anything within the area is _Silenced_ until the GM spends a Fear on their turn to clear this condition, you cast Hush again, or you take Major damage. While _Silenced_, they can\'t make noise and can\'t cast spells.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('hushAwaiting') === true,
      (table) => typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('hushAwaiting', false);
        if (table.rolls?.action?.isSuccess !== true) {
          table.feature.set('hushTargetId', null);
          table.feature.set('hushPendingHope', false);
          return;
        }
        table.feature.set('hushPendingHope', true);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Hush',
      description:
        'Spellcast vs a target within Close range. On success, spend 1 Hope: Very Close aura follows the target; those in the area are Silenced until GM spends Fear, you recast Hush, or you take Major damage (GM).',
      selectTargets: (table) => hushEligibleTargets(table),
      multiSelect: false,
      isDisabled: (table) =>
        hushEligibleTargets(table).length === 0 ? 'No valid target in range for Hush.' : false,
      onUse(table, chipState) {
        const targetId = (chipState.get?.('selectedTargetIds') || [])[0];
        if (!targetId) return;
        const target = table.actors.find((a) => a.instanceId === targetId);
        if (!target || target.instanceId === table.me.instanceId || !withinClose(table, target)) return;

        const trait = spellcastTraitLabel(table);
        const opts = { trait };
        if (target.isAdversary && target.effectiveDifficulty != null && Number.isFinite(target.effectiveDifficulty)) {
          opts.difficulty = target.effectiveDifficulty;
        }

        table.feature.set('hushAwaiting', true);
        table.feature.set('hushTargetId', targetId);
        table.feature.set('hushPendingHope', false);

        const dcHint =
          target.isAdversary && opts.difficulty != null
            ? ` (vs Difficulty ${opts.difficulty})`
            : target.isCharacter
              ? ` (vs this target's Evasion — GM)`
              : '';

        table.me.actionLoop(
          'Hush',
          `Make a Spellcast (${trait}) roll against ${target.name} within Close range${dcHint}. On a success, you may spend 1 Hope to conjure suppressive magic: a Very Close-radius aura follows them. The target and others in that area are Silenced until the GM spends a Fear on their turn to clear it, you cast Hush again, or you take Major damage. While Silenced, they cannot make noise or cast spells (GM applies to the anchor and other creatures in the aura).`,
          opts
        );
      },
    },
    when(
      isActing,
      (table) => table.feature.get('hushPendingHope') === true,
      {
        placements: ['reviewAction'],
        name: 'Hush — conjure silence',
        hopeCost: 1,
        description:
          'Spend 1 Hope to apply the silence field: mark the anchor Silenced; the Very Close aura follows them (GM marks others in the aura).',
        onUse(table) {
          const tid = table.feature.get('hushTargetId');
          table.feature.set('hushPendingHope', false);
          table.feature.set('hushTargetId', null);
          if (!tid) return;
          const anchor = table.actors.find((a) => a.instanceId === tid);
          if (!anchor) return;
          anchor.addCondition('Silenced');
        },
      }
    ),
  ],
};
