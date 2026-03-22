/**
 * Wordsmith subclass features — SRD: daggerheart-srd/subclasses/Wordsmith.md
 */

import { when, isActing } from '../engine/when.js';

/**
 * "Within Far range" for Rousing Speech: Melee through Far (not Very Far).
 */
function inFarRangeBand(table, actor) {
  const b = table.me.rangeFrom(actor);
  return b === 'melee' || b === 'veryClose' || b === 'close' || b === 'far';
}

function alliesWithinFarBand(table) {
  return table.characters.filter(
    (c) => c.instanceId !== table.me.instanceId && inFarRangeBand(table, c)
  );
}

export const RousingSpeech = {
  name: 'Rousing Speech',
  description:
    'Once per long rest, you can give a heartfelt, inspiring speech. All allies within Far range clear 2 Stress.',
  frequency: 'longRest',
  isDisabled: (table) => alliesWithinFarBand(table).length === 0,
  onUse(table) {
    for (const ally of alliesWithinFarBand(table)) {
      ally.clearStress(2);
    }
  },
};

export const HeartOfAPoet = {
  name: 'Heart of a Poet',
  description:
    'After you make an action roll to impress, persuade, or offend someone, you can spend a Hope to add a d4 to the roll.',
  chips: [
    when(
      isActing,
      (table) =>
        table.action?.type === 'action' ||
        table.action?.type === 'trait' ||
        table.action?.type === 'attack',
      (table) => ['Presence', 'Finesse'].includes(table.action?.trait),
      {
        name: 'Heart of a Poet',
        placements: ['reviewAction'],
        hopeCost: 1,
        description: 'Spend a Hope to add a d4 to this action roll.',
        onUse(table) {
          table.rolls?.action?.addDie({ name: 'Heart of a Poet', die: 'd4' });
        },
      }
    ),
  ],
};

export const Eloquent = {
  name: 'Eloquent',
  description:
    'Your moving words boost morale. Once per session, when you encourage an ally, you can do one of the following:\n\n- Allow them to find a mundane object or tool they need.\n- Help an Ally without spending Hope.\n- Give them an additional downtime move during their next rest.',
  chips: [
    {
      placements: ['card'],
      frequency: 'session',
      description: 'When you encourage an ally, choose one benefit.',
      isSelect: () => [
        {
          id: 'findTool',
          name: 'Find a mundane object or tool',
          description: 'They find something they need.',
        },
        {
          id: 'helpNoHope',
          name: 'Help an Ally without spending Hope',
          description: 'The Help costs no Hope (GM resolves).',
        },
        {
          id: 'extraRestMove',
          name: 'Extra downtime move on next rest',
          description: 'They gain one additional downtime move next rest (GM tracks).',
        },
      ],
      onUse(table, chip) {
        const id = chip.get('selectedId');
        if (id === 'findTool') {
          table.me.actionLoop(
            'Eloquent',
            'Your ally finds a mundane object or tool they need.'
          );
        } else if (id === 'helpNoHope') {
          table.me.actionLoop(
            'Eloquent',
            'Help an Ally without spending Hope — resolve per SRD with the GM.'
          );
        } else if (id === 'extraRestMove') {
          table.me.actionLoop(
            'Eloquent',
            'Your ally gains an additional downtime move during their next rest (GM tracks).'
          );
        }
      },
    },
  ],
};

/** Wordsmith is the Tag Team partner (helping the ally’s roll). */
function isHelpingAllyTagTeam(table) {
  return (
    table.action?.type === 'tagTeam' &&
    table.action?.tagTeamPartnerInstanceId === table.me?.instanceId
  );
}

/**
 * Rally **d10** is handled in **`rallyDieSizeForBard`** (`classes/Bard.js`). **Help an Ally** uses
 * **`type === 'tagTeam'`** with **`tagTeamPartnerInstanceId`** = helper (this character).
 */
export const EpicPoetry = {
  name: 'Epic Poetry',
  description:
    'Your Rally Die increases to a d10. Additionally, when you Help an Ally, you can narrate the moment as if you were writing the tale of their heroism in a memoir. When you do, roll a d10 as your advantage die.',
  chips: [
    when(
      isHelpingAllyTagTeam,
      (table) => table.rolls?.action != null,
      {
        name: 'Epic Poetry (advantage d10)',
        placements: ['intent'],
        description:
          'When you Help an Ally (Tag Team), roll a d10 as your advantage die on this roll.',
        onUse(table) {
          table.rolls?.action?.addDie({ name: 'Epic Poetry', die: 'd10' });
        },
      }
    ),
  ],
};
