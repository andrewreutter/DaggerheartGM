/**
 * Arcana — Confusing Aura (domain spell card tier 2 / SRD level 8)
 * SRD: daggerheart-srd/abilities/Confusing Aura.md
 */

import { when, isTargeted, hasDamage } from '../../engine/when.js';
import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function stressLayerSelectOptions(table) {
  const max = table.me?.maxStress ?? 6;
  const cur = table.me?.currentStress ?? 0;
  const empty = Math.max(0, max - cur);
  return Array.from({ length: empty + 1 }, (_, i) => ({
    id: String(i),
    name:
      i === 0
        ? 'No additional Stress (1 layer total)'
        : `Mark ${i} Stress (${i + 1} layers total)`,
  }));
}

export const ConfusingAura = {
  name: 'Confusing Aura',
  description:
    'Make a **Spellcast Roll (14)**. Once per long rest on a success, you create a layer of illusion over your body that makes it hard to tell exactly where you are. **Mark any number of Stress** to make that many additional layers. When an adversary makes an attack against you, roll a number of **d6s** equal to the number of layers currently active. If any roll a 5 or higher, one layer of the aura is destroyed and the attack fails. If all the results are 4 or lower, you take the damage and this spell ends',
  chips: [
    {
      placements: ['card'],
      name: 'Confusing Aura',
      frequency: 'longRest',
      description:
        'Once per long rest: Spellcast (14). On a success, you gain one illusion layer, then choose how much Stress to mark for additional layers.',
      onUse(table) {
        table.feature.set('cauAwaitingSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Confusing Aura',
          `Make a Spellcast (${trait}) roll (14). Once per long rest on a success, you create one illusion layer, then you may mark any number of Stress for that many additional layers. When an adversary attacks you, roll 1d6 per active layer: if any die is 5+, one layer is lost and the attack fails; if all dice are 4 or lower, you take the hit and the spell ends.`,
          { trait, difficulty: 14 }
        );
      },
    },
    when(
      (table) => table.feature.get('cauExtraStressPending') === true,
      {
        placements: ['card'],
        name: 'Additional layers',
        description:
          'After a successful Spellcast, mark any number of Stress — each marked Stress adds one illusion layer (choose below).',
        isSelect: (table) => stressLayerSelectOptions(table),
        onUse(table, chip) {
          const n = parseInt(String(chip.get('selectedId') ?? '0'), 10) || 0;
          table.feature.set('cauExtraStressPick', n);
          table.feature.set('confusingAuraLayers', 1 + n);
          table.feature.set('cauExtraStressPending', false);
        },
        stressCost: (table) => table.feature.get('cauExtraStressPick') ?? 0,
      }
    ),
  ],
  hooks: {
    onReviewAction: when(
      (table) =>
        (table.action?.type === 'spellcast' &&
          table.feature.get('cauAwaitingSpellcast') === true &&
          typeof table.rolls?.action?.isSuccess === 'boolean') ||
        (isTargeted(table) &&
          table.action?.type === 'attack' &&
          hasDamage(table) &&
          (table.feature.get('confusingAuraLayers') ?? 0) > 0),
      (table) => {
        if (
          table.action?.type === 'spellcast' &&
          table.feature.get('cauAwaitingSpellcast') === true &&
          typeof table.rolls?.action?.isSuccess === 'boolean'
        ) {
          table.feature.set('cauAwaitingSpellcast', false);
          if (table.rolls.action.isSuccess === true) {
            table.feature.set('cauExtraStressPending', true);
          }
          return;
        }

        const layers = table.feature.get('confusingAuraLayers') ?? 0;

        const rolls = [];
        for (let i = 0; i < layers; i++) {
          rolls.push(table.rollDie('d6'));
        }
        const anyHigh = rolls.some((v) => v >= 5);
        const meId = table.me.instanceId;

        if (anyHigh) {
          table.feature.set('confusingAuraLayers', layers - 1);
          for (;;) {
            const next = table.action?.effects?.find(
              (e) =>
                e.type === 'damage' &&
                e.target?.instanceId === meId &&
                typeof e.amount === 'number' &&
                e.amount > 0
            );
            if (!next) break;
            table.action.reducePendingDamageForTarget(meId, next.amount);
          }
          table.action.addNarration(
            `Confusing Aura: [${rolls.join(', ')}] — a layer absorbs the hit; the attack fails.`
          );
        } else {
          table.feature.set('confusingAuraLayers', null);
          table.feature.set('cauExtraStressPending', false);
          table.action.addNarration(
            `Confusing Aura: [${rolls.join(', ')}] — all dice 4 or lower; the illusion ends and you take the damage.`
          );
        }
      }
    ),
    onRest: when(
      (table) => table.action?.type === 'longRest',
      (table) => {
        table.feature.set('cauAwaitingSpellcast', false);
        if (table.feature.get('cauExtraStressPending') === true) {
          table.feature.set('cauExtraStressPending', false);
        }
      }
    ),
  },
};
