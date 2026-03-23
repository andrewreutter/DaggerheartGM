/**
 * Bone domain — Tactician (Tier 1)
 * SRD: When you Help an Ally, they can spend a Hope to add one of your Experiences to their roll alongside your advantage die.
 */

import { when } from '../../engine/when.js';

function experienceBonus(exp) {
  const v = exp?.value ?? exp?.tier ?? exp?.rank;
  if (v != null && Number.isFinite(Number(v))) return Math.max(1, Math.floor(Number(v)));
  return 2;
}

export const Tactician = {
  name: 'Tactician',
  description:
    'When you Help an Ally, they can spend a Hope to add one of your Experiences to their roll alongside your advantage die.',
  chips: [
    when(
      (t) =>
        t.action?.type === 'tagTeam' &&
        t.action?.actor?.instanceId === t.me?.instanceId &&
        t.action?.tagTeamPartnerInstanceId === t.activeFeature?._ownerInstanceId,
      (t) => t.rolls?.action != null,
      {
        name: 'Tactician',
        placements: ['reviewAction'],
        showOnOtherSheets: true,
        hopeCost: 1,
        description:
          'Ally spends 1 Hope to add one of your Experiences to this roll (static bonus per SRD experience tier).',
        isSelect: (table) => {
          const pid = table.action?.tagTeamPartnerInstanceId;
          const helper = table.characters.find((c) => c.instanceId === pid);
          const exps = helper?.experiences || [];
          if (exps.length === 0) {
            return [
              {
                id: '__none',
                name: '(No experiences on helper)',
                description: 'Add the helper’s experiences to their sheet to pick one.',
              },
            ];
          }
          return exps.map((e) => ({
            id: String(e.id ?? e.name),
            name: e.name,
            description: `Add "${e.name}" to the roll (+${experienceBonus(e)}).`,
          }));
        },
        isDisabled: (table) => {
          const pid = table.action?.tagTeamPartnerInstanceId;
          const helper = table.characters.find((c) => c.instanceId === pid);
          if ((helper?.experiences || []).length === 0) {
            return 'Helper has no Experiences to add.';
          }
          return false;
        },
        onUse(table, chipState) {
          const sid = chipState.get?.('selectedId');
          if (!sid || sid === '__none') return;
          const pid = table.action?.tagTeamPartnerInstanceId;
          const helper = table.characters.find((c) => c.instanceId === pid);
          const exps = helper?.experiences || [];
          const pick = exps.find((e) => String(e.id ?? e.name) === String(sid));
          if (!pick) return;
          const bonus = experienceBonus(pick);
          table.rolls?.action?.addStatic({ name: `Tactician (${pick.name})`, value: bonus });
        },
      }
    ),
  ],
};
