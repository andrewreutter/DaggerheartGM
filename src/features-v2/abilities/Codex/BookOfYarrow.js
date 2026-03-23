/**
 * Codex — Book of Yarrow (Tier 3 grimoire; SRD Level 10 domain card)
 * SRD: daggerheart-srd/.build/03_json/abilities.json
 */

import { when, isActing } from '../../engine/when.js';
import { spellcastTraitLabel } from './spellcast-label.js';

function clearTimejammer(table) {
  table.feature.set('yarrowTimejammerActive', false);
}

/** True when the current action roll includes at least one target other than the actor. */
function targetsAnotherCreature(table) {
  const me = table.me?.instanceId;
  if (!me) return false;
  const ids = table.action?.targetInstanceIds ?? [];
  if (ids.length > 0) {
    return ids.some((id) => id !== me);
  }
  const t = table.action?.target?.instanceId;
  return t != null && t !== me;
}

function isActionRollThatCanEndTimejammer(table) {
  const t = table.action?.type;
  return (
    t === 'attack' ||
    t === 'spellcast' ||
    t === 'trait' ||
    t === 'action' ||
    t === 'reaction' ||
    t === 'tagTeam'
  );
}

function timejammerEndPredicate(table) {
  return (
    table.feature.get('yarrowTimejammerActive') === true &&
    isActionRollThatCanEndTimejammer(table) &&
    targetsAnotherCreature(table)
  );
}

function timejammerActiveForSceneEnd(table) {
  return table.feature.get('yarrowTimejammerActive') === true;
}

export const BookOfYarrow = {
  name: 'Book of Yarrow',
  description:
    '_Timejammer:_ Make a **Spellcast Roll (18)**. On a success, time temporarily slows to a halt for everyone within Far range except for you. It resumes the next time you make an action roll that targets another creature.\n\n_Magic Immunity:_ **Spend 5 Hope** to become immune to magic damage until your next rest.',
  damageAffinities: {
    immunities: [when((table) => table.feature.get('yarrowMagicImmunity') === true, 'magic')],
  },
  hooks: {
    onIntent: when(isActing, timejammerEndPredicate, clearTimejammer),
    onReviewAction: when(
      isActing,
      (table) =>
        table.action?.type === 'spellcast' &&
        table.feature.get('yarrowAwaitingTimejammerSpellcast') === true &&
        typeof table.rolls?.action?.isSuccess === 'boolean',
      (table) => {
        table.feature.set('yarrowAwaitingTimejammerSpellcast', false);
        if (table.rolls.action.isSuccess === true) {
          table.feature.set('yarrowTimejammerActive', true);
        }
      }
    ),
    onRest(table) {
      table.feature.set('yarrowAwaitingTimejammerSpellcast', false);
      if (table.action?.type === 'shortRest' || table.action?.type === 'longRest') {
        table.feature.set('yarrowMagicImmunity', false);
      }
    },
    onSceneEnd: when(timejammerActiveForSceneEnd, clearTimejammer),
  },
  chips: [
    {
      placements: ['card'],
      name: 'Timejammer',
      description:
        'Spellcast (18). On a success, everyone within Far range except you is frozen in time until your next action roll that targets another creature.',
      onUse(table) {
        table.feature.set('yarrowAwaitingTimejammerSpellcast', true);
        const trait = spellcastTraitLabel(table);
        table.me.actionLoop(
          'Book of Yarrow — Timejammer',
          `Make a Spellcast (${trait}) roll (18). On a success, time temporarily slows to a halt for everyone within Far range except for you. It resumes the next time you make an action roll that targets another creature.`,
          { trait, difficulty: 18 }
        );
      },
    },
    {
      placements: ['card'],
      name: 'Magic Immunity',
      hopeCost: 5,
      description: 'Spend 5 Hope to become immune to magic damage until your next rest.',
      onUse(table) {
        table.feature.set('yarrowMagicImmunity', true);
        table.me.actionLoop(
          'Book of Yarrow — Magic Immunity',
          'You spend 5 Hope. You are immune to magic damage until your next rest.'
        );
      },
    },
  ],
};
