/**
 * Codex — Book of Vyola (Tier 2 grimoire; SRD Level 8 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { spellcastTraitLabel } from './spellcast-label.js';
import { isWithinFarRangeOfMe, when } from '../../engine/when.js';

function memoryDelveTargets(table) {
  const meId = table.me?.instanceId;
  return (table.actors ?? []).filter(
    (a) => a.instanceId !== meId && isWithinFarRangeOfMe(table, a)
  );
}

function isRestAction(table) {
  const t = table.action?.type;
  return t === 'shortRest' || t === 'longRest';
}

function pairIds(table) {
  const raw = table.feature.get('sharedClarityPairIds');
  return Array.isArray(raw) && raw.length === 2 ? raw : null;
}

function pairIdSet(table) {
  const ids = pairIds(table);
  if (!ids) return null;
  return new Set(ids);
}

function pendingStressOnPairMember(table) {
  const set = pairIdSet(table);
  if (!set) return false;
  for (const e of table.action?.effects ?? []) {
    if (!(e.amount > 0)) continue;
    if (e.stat !== 'currentStress') continue;
    const tid = e.target?.instanceId;
    if (tid && set.has(tid)) return true;
  }
  return false;
}

function pairRecipients(table) {
  const set = pairIdSet(table);
  if (!set) return [];
  return (table.characters ?? []).filter((c) => set.has(c.instanceId));
}

export const BookOfVyola = {
  name: 'Book of Vyola',
  description:
    '_Memory Delve:_ Make a **Spellcast Roll** against a target within Far range. On a success, peer into the target\'s mind and ask the GM a question. The GM describes any memories the target has pertaining to the answer.\n\n_Shared Clarity:_ Once per long rest, **spend a Hope** to choose two willing creatures. When one of them would mark Stress, they can choose between the two of them who marks it. This spell lasts until their next rest.',
  hooks: {
    onRest: when(isRestAction, (table) => {
      table.feature.set('sharedClarityPairIds', null);
    }),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Memory Delve',
      description:
        'Spellcast vs a target within Far range (Melee–Far on the map). On success: ask the GM a question; they describe memories the target has about the answer.',
      selectTargets: (table) => memoryDelveTargets(table),
      isDisabled: (table) =>
        memoryDelveTargets(table).length === 0 ? 'No target within Far range for Memory Delve.' : false,
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const id = ids[0];
        if (id) {
          const target = table.actors.find((a) => a.instanceId === id);
          const trait = spellcastTraitLabel(table);
          const tname = target?.name ?? 'the target';
          table.me.actionLoop(
            'Book of Vyola — Memory Delve',
            `Make a Spellcast (${trait}) roll against ${tname} (within Far range). On a success, peer into their mind and ask the GM a question; the GM describes any memories the target has pertaining to the answer.`,
            { trait }
          );
        }
      },
    },
    {
      placements: ['card'],
      name: 'Shared Clarity',
      hopeCost: 1,
      frequency: 'longRest',
      multiSelect: true,
      maxSelections: 2,
      description:
        'Spend 1 Hope (once per long rest). Choose exactly two willing creatures. When either would mark Stress, the players decide which of the two marks it. Ends when you take a rest.',
      selectTargets: (table) => table.characters ?? [],
      isDisabled: (table) =>
        (table.characters ?? []).length < 2 ? 'Need at least two characters on the table.' : false,
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const uniq = [...new Set(ids)];
        if (uniq.length === 2) {
          table.feature.set('sharedClarityPairIds', uniq.sort());
          const names = uniq
            .map((i) => table.characters.find((c) => c.instanceId === i)?.name ?? i)
            .join(' and ');
          table.me.actionLoop(
            'Book of Vyola — Shared Clarity',
            `Linked: ${names}. When either would mark Stress, they choose which of the two marks it. This lasts until your next rest.`
          );
        }
      },
    },
    when(pendingStressOnPairMember, {
      placements: ['reviewOutcome'],
      name: 'Shared Clarity — assign Stress',
      description:
        'A linked creature would mark Stress. Choose which of the two marks it.',
      selectTargets: (table) => pairRecipients(table),
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const newId = ids[0];
        const set = pairIdSet(table);
        if (!newId || !set?.has(newId)) return;
        const recipient =
          table.characters.find((c) => c.instanceId === newId) ??
          table.actors.find((a) => a.instanceId === newId);
        if (!recipient) return;
        const effects = table.action?.effects ?? [];
        for (const e of effects) {
          if (!(e.amount > 0)) continue;
          if (e.stat !== 'currentStress') continue;
          const tid = e.target?.instanceId;
          if (tid && set.has(tid)) {
            e.target = recipient;
            table.action.addNarration(
              `Shared Clarity: ${recipient.name ?? newId} marks this Stress.`
            );
            return;
          }
        }
      },
    }),
  ],
};
