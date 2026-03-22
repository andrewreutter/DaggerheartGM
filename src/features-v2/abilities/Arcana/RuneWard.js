/**
 * Arcana domain spell — SRD: daggerheart-srd/abilities/Rune Ward.md
 *
 * The caster picks who holds the ward (any PC). The holder spends Hope on the damage banner to roll d8
 * reduction; `showOnOtherSheets` lets the chip appear on the holder’s sheet when they are not the caster.
 */

import { when, isTargeted, hasDamage } from '../../engine/when.js';

function wardNotDepleted(table) {
  return table.feature.get('runeWardDepleted') !== true;
}

/** Holder is explicit `runeWardHolderInstanceId` or the caster (ability owner). */
function runeWardHolderInstanceId(table) {
  return table.feature.get('runeWardHolderInstanceId') ?? table.activeFeature?._ownerInstanceId ?? table.me?.instanceId;
}

function holderIsWardHolder(table) {
  const hid = runeWardHolderInstanceId(table);
  return hid != null && table.me?.instanceId === hid;
}

export const RuneWard = {
  name: 'Rune Ward',
  description:
    "You have a deeply personal trinket that can be infused with protective magic and held as a ward by you or an ally. Describe what it is and why it's important to you. The ward's holder can spend a Hope to reduce incoming damage by **1d8**.\n\nIf the Ward Die result is 8, the ward's power ends after it reduces damage this turn. It can be recharged for free on your next rest.",
  chips: [
    {
      name: 'Ward Holder',
      placements: ['card'],
      description: 'Choose who holds your rune ward (defaults to you until you pick someone else).',
      selectTargets: (table) => table.characters,
      onUse(table, chipState) {
        const ids = chipState.get('selectedTargetIds');
        const id = Array.isArray(ids) && ids[0] ? ids[0] : null;
        if (id) table.feature.set('runeWardHolderInstanceId', id);
      },
    },
    when(
      isTargeted,
      hasDamage,
      wardNotDepleted,
      holderIsWardHolder,
      {
        name: 'Rune Ward',
        placements: ['reviewAction'],
        showOnOtherSheets: true,
        hopeCost: 1,
        description:
          'Roll 1d8 and reduce incoming damage by that much. On an 8, the ward ends until your next rest.',
        onUse(table) {
          const roll = table.rollDie('d8');
          table.action?.reducePendingDamageForTarget?.(table.me?.instanceId, roll);
          if (roll === 8) {
            table.feature.set('runeWardDepleted', true);
          }
        },
      }
    ),
  ],
  hooks: {
    onRest(table) {
      table.feature.set('runeWardDepleted', false);
    },
  },
};
