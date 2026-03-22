/**
 * Warden of Renewal subclass — SRD: daggerheart-srd/subclasses/Warden of Renewal.md
 */

import { when } from '../engine/when.js';

const WARDEN_OF_RENEWAL_ID = 'srd-sub-warden-of-renewal';

/** SRD "within Close range": Melee, Very Close, or Close. */
function inCloseRangeBand(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close';
}

function alliesWithinCloseExcludingSelf(table) {
  return table.characters.filter(
    (c) => c.instanceId !== table.me.instanceId && inCloseRangeBand(table, c)
  );
}

/** Allies in Close (Melee / Very Close / Close) who have a pending damage effect marking ≥2 HP. */
function defenderEligibleAllies(table) {
  const meId = table.me?.instanceId;
  if (!meId || !table.me.inBeastform) return [];
  const out = [];
  const seen = new Set();
  for (const e of table.action?.effects ?? []) {
    if (e.type !== 'damage' || !(e.amount >= 2)) continue;
    const tid = e.target?.instanceId;
    if (!tid || tid === meId) continue;
    if (seen.has(tid)) continue;
    const ally = table.characters.find((c) => c.instanceId === tid);
    if (!ally) continue;
    if (!inCloseRangeBand(table, ally)) continue;
    seen.add(tid);
    out.push(ally);
  }
  return out;
}

export const ClarityOfNature = {
  name: 'Clarity of Nature',
  description:
    'Once per long rest, you can create a space of natural serenity within Close range. When you spend a few minutes resting within the space, clear Stress equal to your Instinct, distributed as you choose between you and your allies.',
  chips: [
    {
      placements: ['card'],
      frequency: 'longRest',
      description:
        'Create a serenity space in Close range; when you rest there, distribute Stress clears (GM).',
      onUse(table) {
        const instinct = Number(table.me?.traits?.instinct ?? 0) || 0;
        table.me.actionLoop(
          'Clarity of Nature',
          `Create a space of natural serenity within Close range. When you spend a few minutes resting in this space, clear Stress equal to your Instinct (${instinct}) total, distributed as you choose between you and your allies (GM).`
        );
      },
    },
  ],
};

export const Defender = {
  name: 'Defender',
  description:
    "When you're in Beastform and an ally within Close range marks 2 or more Hit Points, you can mark a Stress to reduce the number of Hit Points they mark by 1.",
  chips: [
    when(
      (table) => defenderEligibleAllies(table).length > 0,
      {
        name: 'Defender',
        placements: ['reviewAction'],
        stressCost: 1,
        selectTargets: (table) => defenderEligibleAllies(table),
        isDisabled: (table) => defenderEligibleAllies(table).length === 0,
        onUse(table, chipState) {
          const ids = chipState.get?.('selectedTargetIds') ?? [];
          const allyId = ids[0];
          if (!allyId) return;
          table.action.reducePendingDamageForTarget(allyId, 1);
        },
      }
    ),
  ],
};

export const WardensProtection = {
  name: "Warden's Protection",
  description:
    'Once per long rest, spend 2 Hope to clear 2 Hit Points on 1d4 allies within Close range.',
  chips: [
    {
      placements: ['card'],
      frequency: 'longRest',
      hopeCost: 2,
      multiSelect: true,
      maxSelections: 4,
      selectTargets: (table) => alliesWithinCloseExcludingSelf(table),
      isDisabled: (table) => alliesWithinCloseExcludingSelf(table).length === 0,
      onUse(table, chipState) {
        const n = table.rollDie('d4');
        const ids = (chipState.get('selectedTargetIds') || []).slice(0, n);
        for (const id of ids) {
          const t = table.characters.find((c) => c.instanceId === id);
          t?.clearHP(2);
        }
      },
    },
  ],
};

/**
 * At tier 3+ the specialization **Regenerative Reach** is unlocked: Regeneration may target
 * creatures within Very Close (as well as Melee / touch). Lower tiers use Melee only.
 */
function regenerationAllowsVeryClose(table) {
  return table.me?.subclassId === WARDEN_OF_RENEWAL_ID && (table.me?.tier ?? 1) >= 3;
}

function isRegenerationTouchRange(table, actor) {
  const r = table.me.rangeFrom(actor);
  if (r === 'melee') return true;
  if (regenerationAllowsVeryClose(table) && r === 'veryClose') return true;
  return false;
}

export const Regeneration = {
  name: 'Regeneration',
  description: 'Touch a creature and spend 3 Hope. That creature clears 1d4 Hit Points.',
  chips: [
    {
      placements: ['card'],
      hopeCost: 3,
      selectTargets: (table) => table.characters.filter((c) => isRegenerationTouchRange(table, c)),
      isDisabled: (table) =>
        table.characters.filter((c) => isRegenerationTouchRange(table, c)).length === 0,
      onUse(table, chip) {
        const ids = chip.get('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const target = table.characters.find((c) => c.instanceId === id);
        if (!target) return;
        const cleared = table.rollDie('d4');
        target.clearHP(cleared);
      },
    },
  ],
};

/** Narrative card; extended range for **Regeneration** is implemented there (tier ≥ 3). */
export const RegenerativeReach = {
  name: 'Regenerative Reach',
  description:
    'You can target creatures within Very Close range with your "Regeneration" feature.',
};
