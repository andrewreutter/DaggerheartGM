/**
 * Grace domain — Words of Discord (domain spell)
 * SRD: daggerheart-srd/abilities/Words of Discord.md
 */

import { spellcastTraitLabel } from '../Codex/spellcast-label.js';

function isMeleeToAdversary(table, adv) {
  return table.me.rangeFrom(adv) === 'melee';
}

export const WordsOfDiscord = {
  name: 'Words of Discord',
  description:
    'Whisper words of discord to an adversary within Melee range and make a **Spellcast Roll (13)**. On a success, the target must mark a Stress and make an attack against another adversary instead of against you or your allies.\n\nOnce this attack is over, the target realizes what happened. The next time you cast Words of Discord on them, gain a -5 penalty to the Spellcast Roll.',
  chips: [
    {
      placements: ['card'],
      name: 'Words of Discord',
      description:
        'Spellcast (13) vs an adversary in Melee range. On success: they mark 1 Stress and must attack another adversary instead of you or your allies (GM). If you owe a −5 on this adversary (after they realized), use threshold 18.',
      selectTargets: (table) => table.adversaries.filter((a) => isMeleeToAdversary(table, a)),
      multiSelect: false,
      isDisabled: (table) =>
        table.adversaries.filter((a) => isMeleeToAdversary(table, a)).length === 0
          ? 'No adversary in Melee range.'
          : false,
      onUse(table, chip) {
        const id = (chip.get?.('selectedTargetIds') || [])[0];
        if (!id) return;
        const adv = table.adversaries.find((a) => a.instanceId === id);
        if (!adv || !isMeleeToAdversary(table, adv)) return;
        const trait = spellcastTraitLabel(table);
        const bag = table.feature.get('wodPenaltyByTarget');
        const prev = bag && typeof bag === 'object' ? { ...bag } : {};
        const penalized = !!prev[id];
        if (penalized) {
          delete prev[id];
          table.feature.set('wodPenaltyByTarget', prev);
        }
        const dc = penalized ? 18 : 13;
        const penaltyNote = penalized
          ? ' This cast applies −5 to your Spellcast check (threshold 18 instead of 13).'
          : '';
        table.me.actionLoop(
          'Words of Discord',
          `Make a Spellcast (${trait}) roll (${dc}) against ${adv.name} in Melee range.${penaltyNote} On a success, the target marks 1 Stress and must make an attack against another adversary instead of you or your allies (GM chooses the new target and resolves the attack). After that attack ends, use "Target has realized" if they learn what happened (next cast on them: −5, threshold 18).`,
          { trait, difficulty: dc }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Words of Discord — Target has realized',
      description:
        'After a target finishes the compelled attack from Words of Discord, select them: your next Words of Discord against that adversary suffers −5 to the Spellcast roll (threshold 18 instead of 13).',
      selectTargets: (table) => table.adversaries,
      multiSelect: false,
      isDisabled: (table) =>
        table.adversaries.length === 0 ? 'No adversary to mark as having realized.' : false,
      onUse(table, chip) {
        const id = (chip.get?.('selectedTargetIds') || [])[0];
        if (!id) return;
        const adv = table.adversaries.find((a) => a.instanceId === id);
        if (!adv) return;
        const bag = table.feature.get('wodPenaltyByTarget');
        const prev = bag && typeof bag === 'object' ? { ...bag } : {};
        prev[id] = true;
        table.feature.set('wodPenaltyByTarget', prev);
        table.me.actionLoop(
          'Words of Discord — Target realized',
          `Noted: ${adv.name} has realized what happened. Your next Words of Discord against them suffers −5 to the Spellcast roll (threshold 18).`
        );
      },
    },
  ],
};
