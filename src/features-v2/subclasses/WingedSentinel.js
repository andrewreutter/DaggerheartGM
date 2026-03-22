/**
 * Winged Sentinel subclass — SRD: Winged Sentinel (community SRD mirror; submodule path may differ)
 */

import { when, isActing } from '../engine/when.js';

const SCOPE = 'WingedSentinel';

function ws(table) {
  return table.featureState?.[SCOPE] ?? {};
}

function isFlying(table) {
  return ws(table).flying === true;
}

function hopeDominates(table) {
  const h = table.rolls?.action?.hopeDie?.value;
  const f = table.rolls?.action?.fearDie?.value;
  if (h == null || f == null) return false;
  return h > f;
}

export const WingsOfLight = {
  name: 'Wings of Light',
  description:
    'You can fly. While flying, you can do the following:\n\n- Mark a Stress to pick up and carry another willing creature approximately your size or smaller.\n- Spend a Hope to deal an extra 1d8 damage on a successful attack.',
  movementModes: [when(isFlying, 'fly')],
  chips: [
    {
      name: 'Flight',
      placements: ['card'],
      description: 'While toggled on, you are flying (Wings of Light).',
      isToggle: true,
      onUse(table, chip) {
        table.source.set('flying', chip.isOn === true);
      },
    },
    {
      name: 'Pick up and carry',
      placements: ['card'],
      stressCost: 1,
      description:
        'Pick up and carry another willing creature approximately your size or smaller. Mark 1 Stress.',
      isDisabled: (table) => !isFlying(table),
      onUse(table) {
        table.me.markStress(1);
        table.me.actionLoop(
          'Wings of Light',
          'Pick up and carry a willing creature of your size or smaller (mark 1 Stress).'
        );
      },
    },
    when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      isFlying,
      {
        name: 'Wings of Light — extra damage',
        placements: ['reviewAction'],
        hopeCost: 1,
        description:
          'Spend 1 Hope to deal an extra 1d8 damage on this successful attack (1d12 while **Power of the Gods** applies).',
        onUse(table) {
          const useD12 = table.source?.get?.('powerOfTheGodsMastery') === true;
          table.rolls?.damage?.addDie({
            name: 'Wings of Light',
            die: useD12 ? 'd12' : 'd8',
          });
        },
      }
    ),
  ],
};

export const EtherealVisage = {
  name: 'Ethereal Visage',
  description:
    "Your supernatural visage strikes awe and fear. While flying, you have advantage on Presence Rolls. When you succeed with Hope on a Presence Roll, you can remove a Fear from the GM's Fear pool instead of gaining Hope.",
  hooks: {
    onIntent: when(
      isActing,
      isFlying,
      (table) => table.action?.trait === 'Presence',
      (table) => {
        table.rolls?.action?.addAdvantageDie('Ethereal Visage');
      }
    ),
  },
  chips: [
    when(
      isActing,
      isFlying,
      (table) => table.action?.trait === 'Presence',
      (table) => table.rolls?.action?.isSuccess === true,
      hopeDominates,
      {
        name: 'Ethereal Visage — Fear instead of Hope',
        placements: ['reviewOutcome'],
        description:
          "Remove 1 Fear from the GM's Fear pool instead of gaining Hope from this roll. (Host should not apply the usual Hope gain when this is used.)",
        isToggle: true,
        isDisabled: (table) => (table.top.fear ?? 0) < 1,
        onUse(table) {
          table.top.spendFear(1);
        },
      }
    ),
  ],
};

export const Ascendant = {
  name: 'Ascendant',
  description: 'Gain a permanent +4 bonus to your Severe damage threshold.',
  passiveStatMods: {
    severeThreshold: 4,
  },
};

export const PowerOfTheGods = {
  name: 'Power of the Gods',
  description:
    'While flying, you deal an extra 1d12 damage instead of 1d8 from your "Wings of Light" feature.',
  hooks: {
    onSessionStart(table) {
      table.source.set('powerOfTheGodsMastery', true);
    },
  },
};
