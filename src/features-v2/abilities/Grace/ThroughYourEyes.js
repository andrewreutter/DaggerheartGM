/**
 * Grace domain — Through Your Eyes (Level 4 spell)
 * SRD: daggerheart-srd/abilities/Through Your Eyes.md
 */

import { when, isActing } from '../../engine/when.js';

function throughYourEyesTargets(table) {
  return table.actors.filter(
    (a) =>
      a.instanceId !== table.me?.instanceId && table.me?.rangeFrom(a) != null
  );
}

export const ThroughYourEyes = {
  name: 'Through Your Eyes',
  description:
    "**Recall Cost 1.** Choose a target within Very Far range. You can see through their eyes and hear through their ears. You can transition between using your own senses or the target's freely until you cast another spell or until your next rest.",
  hooks: {
    onRest(table) {
      table.feature.set('throughYourEyesSubjectId', null);
    },
    onIntent: when(
      isActing,
      (table) => table.feature.get('throughYourEyesSubjectId') != null,
      (table) => table.action?.type === 'spellcast',
      (table) => {
        table.feature.set('throughYourEyesSubjectId', null);
      }
    ),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Through Your Eyes',
      hopeCost: 1,
      description:
        'Spend 1 Hope (recall). Choose a creature within Very Far range on the map. You perceive through their eyes and ears; you may freely switch between their senses and your own. This ends when you cast another spell (Spellcast actions) or when you take a rest (GM).',
      selectTargets: (table) => throughYourEyesTargets(table),
      isDisabled: (table) =>
        throughYourEyesTargets(table).length === 0 ? 'No ally in range to share senses with.' : false,
      onUse(table, chip) {
        const ids = chip.get?.('selectedTargetIds') || [];
        const id = ids[0];
        if (!id) return;
        const target = table.actors.find((a) => a.instanceId === id);
        const targetName = target?.name ?? 'the target';
        table.feature.set('throughYourEyesSubjectId', id);
        table.me.actionLoop(
          'Through Your Eyes',
          `You link your senses to ${targetName}. You may see through their eyes and hear through their ears, switching freely between their senses and your own. This ends when you cast another spell or when you take a rest.`
        );
      },
    },
  ],
};
