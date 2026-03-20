/**
 * Rest downtime move definitions for Short Rest and Long Rest banners.
 * Used by RestBanner for CustomSelect options and tooltips.
 * Optional: canTargetAlly, rollDice (e.g. '1d4'), onApply(rest, roll, target, char).
 */

import { ancestryMap } from '../../features/ancestries/index.js';
import { communityMap } from '../../features/communities/index.js';

export const SHORT_REST_MOVES = [
  {
    id: 'tend-to-wounds',
    name: 'Tend to Wounds',
    description: 'Describe how you hastily patch yourself up, then clear a number of Hit Points equal to 1d4 + your tier. You can do this to an ally instead.',
    canTargetAlly: true,
    rollDice: '1d4',
    onApply(rest, roll, target, char) {
      const n = (roll?.value ?? 0) + (char?.tier ?? 1);
      if (n > 0 && target) target.clearHp(n);
    },
  },
  {
    id: 'clear-stress',
    name: 'Clear Stress',
    description: 'Describe how you blow off steam or pull yourself together, then clear a number of Stress equal to 1d4 + your tier.',
    rollDice: '1d4',
    onApply(rest, roll, target, char) {
      const n = (roll?.value ?? 0) + (char?.tier ?? 1);
      if (n > 0 && target) target.clearStress(n);
    },
  },
  {
    id: 'repair-armor',
    name: 'Repair Armor',
    description: "Describe how you quickly repair your armor, then clear a number of Armor Slots equal to 1d4 + your tier. You can do this to an ally's armor instead.",
    canTargetAlly: true,
    rollDice: '1d4',
    onApply(rest, roll, target, char) {
      const n = (roll?.value ?? 0) + (char?.tier ?? 1);
      if (n > 0 && target) target.clearArmor(n);
    },
  },
  {
    id: 'prepare',
    name: 'Prepare',
    description: 'Describe how you prepare yourself for the path ahead, then gain a Hope. If you choose to Prepare with one or more members of your party, you each gain 2 Hope.',
    onApply(rest, roll, target, char) {
      if (char) char.gainHope(1);
    },
  },
];

export const LONG_REST_MOVES = [
  {
    id: 'tend-to-all-wounds',
    name: 'Tend to All Wounds',
    description: 'Describe how you patch yourself up, then clear all Hit Points. You can do this to an ally instead.',
    canTargetAlly: true,
    onApply(rest, roll, target, char) {
      if (target && target.maxHp != null) target.clearHp(target.maxHp + 1);
    },
  },
  {
    id: 'clear-all-stress',
    name: 'Clear All Stress',
    description: 'Describe how you blow off steam or pull yourself together, then clear all Stress.',
    onApply(rest, roll, target, char) {
      if (target && target.maxStress != null) target.clearStress(target.maxStress + 1);
    },
  },
  {
    id: 'repair-all-armor',
    name: 'Repair All Armor',
    description: "Describe how you spend time repairing your armor, then clear all Armor Slots. You can do this to an ally's armor instead.",
    canTargetAlly: true,
    onApply(rest, roll, target, char) {
      if (target && target.maxArmor != null) target.clearArmor(target.maxArmor + 1);
    },
  },
  {
    id: 'prepare-long',
    name: 'Prepare',
    description: "Describe how you prepare for the next day's adventure, then gain a Hope. If you choose to Prepare with one or more members of your party, you each gain 2 Hope.",
    onApply(rest, roll, target, char) {
      if (char) char.gainHope(1);
    },
  },
  {
    id: 'work-on-project',
    name: 'Work on a Project',
    description: "Establish or continue work on a project (see the following 'Working on a Project in Downtime' section).",
  },
];

/** Look up move definition by id (short or long rest). */
const REST_MOVE_DEFINITIONS = {};
[...SHORT_REST_MOVES, ...LONG_REST_MOVES].forEach(m => {
  REST_MOVE_DEFINITIONS[m.id] = m;
});

export function getRestMoveDefinition(moveId) {
  return moveId ? REST_MOVE_DEFINITIONS[moveId] : null;
}

/**
 * Build the effective rest move list and slot counts for a character.
 * Runs ancestry onRest(rest) hooks so features like Clank Efficient can extend short rest moves,
 * and Elf Celestial Trance can add extra slots via addShortMoveSlot/addLongMoveSlot.
 * @param {{ ancestry?: string | string[] }} character — resolved character with ancestry name(s)
 * @param {'short' | 'long'} restDuration
 * @returns {{ moves: Array<{ id: string, name: string, description: string }>, shortSlots: number, longSlots: number, shortSlotLabels: string[], longSlotLabels: string[] }}
 */
export function getRestMovesForCharacter(character, restDuration) {
  const shortMoves = SHORT_REST_MOVES.map(m => ({ ...m }));
  const longMoves = LONG_REST_MOVES.map(m => ({ ...m }));
  const rest = {
    shortMoves,
    longMoves,
    shortMoveSlots: 2,
    longMoveSlots: 2,
    shortSlotLabels: ['Move 1', 'Move 2'],
    longSlotLabels: ['Move 1', 'Move 2'],
    addShortMove(m) { this.shortMoves.push(m); },
    addLongMove(m) { this.longMoves.push(m); },
    addShortMoveSlot(name) {
      this.shortMoveSlots += 1;
      this.shortSlotLabels.push(name != null && name !== '' ? String(name) : `Move ${this.shortMoveSlots}`);
    },
    addLongMoveSlot(name) {
      this.longMoveSlots += 1;
      this.longSlotLabels.push(name != null && name !== '' ? String(name) : `Move ${this.longMoveSlots}`);
    },
  };
  const names = Array.isArray(character.ancestry) ? character.ancestry : (character.ancestry ? [character.ancestry] : []);
  for (const name of names) {
    const entry = ancestryMap[name];
    if (!entry?.features) continue;
    for (const f of entry.features) {
      if (typeof f.onRest === 'function') f.onRest({ rest, feature: f });
    }
  }
  const communityName = character.community || null;
  if (communityName) {
    const communityEntry = communityMap[communityName];
    if (communityEntry?.features) {
      for (const f of communityEntry.features) {
        if (typeof f.onRest === 'function') f.onRest({ rest, feature: f });
      }
    }
  }
  return {
    moves: restDuration === 'long' ? rest.longMoves : rest.shortMoves,
    shortSlots: rest.shortMoveSlots,
    longSlots: rest.longMoveSlots,
    shortSlotLabels: rest.shortSlotLabels,
    longSlotLabels: rest.longSlotLabels,
  };
}
