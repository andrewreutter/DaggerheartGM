/**
 * Codex domain — Transcendent Union (Level 10 / Tier 3 spell)
 * SRD: Once per long rest, spend 5 Hope (Recall 1) on two or more willing creatures. Until your next rest,
 * when a connected creature would mark Stress or HP, the union chooses who marks it.
 */

import { when } from '../../engine/when.js';

function isRestAction(table) {
  const t = table.action?.type;
  return t === 'shortRest' || t === 'longRest';
}

function unionIds(table) {
  const raw = table.feature.get('transcendentUnionMemberIds');
  return Array.isArray(raw) ? raw : null;
}

function unionIdSet(table) {
  const ids = unionIds(table);
  if (!ids || ids.length < 2) return null;
  return new Set(ids);
}

function pendingMarkOnUnionMember(table) {
  const set = unionIdSet(table);
  if (!set) return false;
  for (const e of table.action?.effects ?? []) {
    if (!(e.amount > 0)) continue;
    if (e.stat !== 'currentHP' && e.stat !== 'currentStress') continue;
    const tid = e.target?.instanceId;
    if (tid && set.has(tid)) return true;
  }
  return false;
}

function unionRecipients(table) {
  const set = unionIdSet(table);
  if (!set) return [];
  return (table.characters ?? []).filter((c) => set.has(c.instanceId));
}

export const TranscendentUnion = {
  name: 'Transcendent Union',
  description:
    '**Recall cost 1.** Once per long rest, **spend 5 Hope** to cast this spell on two or more willing creatures. Until your next rest, when a creature connected by this union would mark Stress or Hit Points, the connected creatures can choose who marks it.',
  hooks: {
    onRest: when(isRestAction, (table) => {
      table.feature.set('transcendentUnionMemberIds', null);
    }),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Transcendent Union',
      hopeCost: 6,
      frequency: 'longRest',
      multiSelect: true,
      description:
        'Spend 6 Hope total (1 recall + 5 spell; once per long rest). Choose two or more willing creatures on the table. Until any rest, when any of them would mark Stress or HP, use the review chip to choose which union member marks it.',
      selectTargets: (table) => table.characters ?? [],
      isDisabled: (table) =>
        (table.characters ?? []).length < 2 ? 'Need at least two characters on the table.' : false,
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const uniq = [...new Set(ids)];
        if (uniq.length < 2) return;
        uniq.sort();
        table.feature.set('transcendentUnionMemberIds', uniq);
        const names = uniq
          .map((i) => table.characters.find((c) => c.instanceId === i)?.name ?? i)
          .join(', ');
        table.me.actionLoop(
          'Transcendent Union',
          `Union bound: ${names}. When any of you would mark Stress or Hit Points, choose who among the union marks it until your next rest.`
        );
      },
    },
    when(pendingMarkOnUnionMember, {
      placements: ['reviewOutcome'],
      name: 'Transcendent Union — assign marks',
      description:
        'A union member would mark Stress or Hit Points. Choose which member of the union marks it (any willing member).',
      selectTargets: (table) => unionRecipients(table),
      onUse(table, chipState) {
        const ids = chipState.get?.('selectedTargetIds') ?? [];
        const newId = ids[0];
        const set = unionIdSet(table);
        if (!newId || !set?.has(newId)) return;
        const recipient =
          table.characters.find((c) => c.instanceId === newId) ??
          table.actors.find((a) => a.instanceId === newId);
        if (!recipient) return;
        const effects = table.action?.effects ?? [];
        for (const e of effects) {
          if (!(e.amount > 0)) continue;
          if (e.stat !== 'currentHP' && e.stat !== 'currentStress') continue;
          const tid = e.target?.instanceId;
          if (tid && set.has(tid)) {
            e.target = recipient;
            table.action.addNarration(
              `Transcendent Union: the group assigns this mark to ${recipient.name ?? newId}.`
            );
            return;
          }
        }
      },
    }),
  ],
};
