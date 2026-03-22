/**
 * Sage domain — Natural Familiar (Tier 1)
 * SRD: summon (ground or flying via **isSelect**); command; scry; +d6 when the foe is in melee of the familiar
 *
 * **+d6:** With no map tokens, range is unknown — allow the die. With tokens, use caster↔target
 * range (familiar at caster for ground; flying allows melee / very close / close).
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';
import { when, isActing, unwrap } from '../../engine/when.js';

function damageTargetActor(table) {
  const eff = table.action?.effects?.find((e) => e.type === 'damage' && (e.amount ?? 0) > 0);
  if (!eff?.target?.instanceId) return null;
  return table.actors.find((a) => a.instanceId === eff.target.instanceId) ?? null;
}

function foeInMeleeOfFamiliar(table) {
  const target = damageTargetActor(table);
  if (!table.me || !target) return false;
  const band = table.me.rangeFrom(target);
  if (band === null) {
    return true;
  }
  if (table.feature.get('naturalFamiliarFlying') === true) {
    return band === 'melee' || band === 'veryClose' || band === 'close';
  }
  return band === 'melee';
}

export const NaturalFamiliar = {
  name: 'Natural Familiar',
  description:
    '**Spend a Hope** to summon a small nature spirit or forest critter to your side until your next rest, you cast Natural Familiar again, or the familiar is targeted by an attack. If you **spend an additional Hope**, you can summon a familiar that flies. You can communicate with them, make a **Spellcast Roll** to command them to perform simple tasks, and **mark a Stress** to see through their eyes. When you deal damage to an adversary within Melee range of your familiar, you add a **d6** to your damage roll.',
  hooks: {
    onReviewAction(table) {
      const addDie = unwrap(
        when(
          isActing,
          (t) => t.action?.type === 'attack',
          (t) => t.rolls?.action?.isSuccess === true,
          (t) => t.feature.get('naturalFamiliarActive') === true,
          (t) => foeInMeleeOfFamiliar(t),
          (t) => {
            t.rolls?.damage?.addDie({ name: 'Natural Familiar', die: 'd6' });
          }
        ),
        table
      );
      if (typeof addDie === 'function') addDie(table);
    },
    onRest(table) {
      table.feature.set('naturalFamiliarActive', false);
      table.feature.set('naturalFamiliarFlying', false);
      table.feature.set('_summonHopeCost', undefined);
    },
  },
  chips: [
    {
      placements: ['card'],
      name: 'Summon familiar',
      isSelect: () => [
        { id: 'ground', label: 'Ground (1 Hope)' },
        { id: 'flying', label: 'Flying (2 Hope)' },
      ],
      hopeCost: (table) => {
        const v = table.feature.get('_summonHopeCost');
        return typeof v === 'number' ? v : 1;
      },
      description:
        'Spend 1 Hope (ground) or 2 Hope (flying) to summon until rest, recast, or the familiar is targeted by an attack.',
      onUse(table, chipState) {
        const mode = chipState.get('selectedId') || 'ground';
        const hope = mode === 'flying' ? 2 : 1;
        table.feature.set('_summonHopeCost', hope);
        table.feature.set('naturalFamiliarActive', true);
        table.feature.set('naturalFamiliarFlying', mode === 'flying');
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Natural Familiar — Summon',
          `Spend ${hope} Hope. Summon a small nature spirit or forest critter to your side until your next rest, you cast Natural Familiar again, or the familiar is targeted by an attack.${mode === 'flying' ? ' This familiar can fly.' : ''} (Spellcast trait ${trait} for reference; GM resolves.)`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Command familiar',
      description:
        'Spellcast to command your familiar to perform simple tasks.',
      onUse(table) {
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Natural Familiar — Command',
          `Make a Spellcast (${trait}) roll to command your familiar to perform simple tasks.`,
          { trait }
        );
      },
    },
    {
      placements: ['card'],
      name: 'See through familiar eyes',
      stressCost: 1,
      description: 'Mark 1 Stress to see through your familiar eyes for a moment (GM).',
      onUse(table) {
        table.me.actionLoop(
          'Natural Familiar — Scry',
          'Mark Stress: see through your familiar eyes (GM sets duration and scope).'
        );
      },
    },
  ],
};
