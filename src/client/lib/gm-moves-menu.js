/**
 * Build the GM Moves board from table / scene `activeElements`.
 * Shared by the live Game Table and the Scene editor preview.
 */

import { isAdversaryDefeated, parseFeatureCategory } from './helpers.js';
import { isAdversaryPresentForParty } from './party-scaled-adversaries.js';

// Strip boundaries (1-indexed in the spec, 0-indexed here):
// Amber (Failure w/ Hope): items 1–6, Violet (Success w/ Fear): items 6–13,
// Navy (Failure w/ Fear): items 12–16. Ranges overlap intentionally.
export const HOPE_END = 6;
export const FEAR_SUCCESS_START = 5;
export const FEAR_SUCCESS_END = 13;
export const FEAR_FAILURE_START = 11;

export const DEFAULT_GM_MOVES = [
  { name: 'Show how the world reacts.', example: '\u201cThe kick shatters the door. Light spills in from the barracks as a half-dozen sleepy soldiers stumble to their feet, looking worried.\u201d' },
  { name: 'Ask a question and build on the answer.', example: '\u201cHow is it that you notice the assassin lurking in the treetops?\u201d' },
  { name: 'Make an NPC act in accordance with their motive.', example: '\u201cThe Jagged Knife Bandit snips the gold purse off the merchant\u2019s hip and attempts to escape.\u201d' },
  { name: 'Lean on the character\u2019s goals to drive them to action.', example: '\u201cThe relic you\u2019ve been trying to recover for your people floats ominously in the center of the altar, surrounded by cultists preparing to drain its power.\u201d' },
  { name: 'Signal an imminent off-screen threat.', example: '\u201cYou hear the crashing of falling trees and shattered branches as thundering steps approach. What do you do?\u201d' },
  { name: 'Reveal an unwelcome truth or unexpected danger.', example: '\u201cHe reaches into his cloak and produces the Orb of Vengeance as you realize that he was the necromancer the entire time.\u201d' },
  { name: 'Force the group to split up.', example: '\u201cThe elementals are scattering\u2014two heading for the town, three bearing down on the mill. What do you do?\u201d' },
  { name: 'Make a PC mark Stress as a consequence for their actions.', example: '\u201cYou can pull the baron to safety if you mark a Stress. Otherwise you can only get yourself out of the way. What do you do?\u201d' },
  { name: 'Make a move the characters don\u2019t see.', example: '\u201cYou brace for the alarm\u2026 but the door clicks open and everything seems fine\u2026 for now.\u201d' },
  { name: 'Show the collateral damage.', example: '\u201cThe Minotaur Wrecker barrels into the street, shattering a vegetable cart, sending cabbages flying and knocking the merchant into the wall.\u201d' },
  { name: 'Clear a temporary condition or effect.', example: '\u201cThe guard cuts through the vines that are holding her legs in place. She looks around to find her next target and raises her sword.\u201d' },
  { name: 'Shift the environment.', example: '\u201cAs soon as you cross, the ancient rope bridge snaps, leaving you stranded.\u201d' },
  { name: 'Spotlight an adversary.', example: '\u201cAs the Skeleton Dredge shambles forward to strike you, you see the two others on their flank turn their attention toward you as well.\u201d' },
  { name: 'Capture someone or something important.', example: '\u201cThe thief slides past you and jumps into the cart, grabbing the idol from the seat and stuffing it into their pouch.\u201d' },
  { name: 'Use a PC\u2019s backstory against them.', example: '\u201cYour mentor sighs, drawing their blade. \u2018I wish it didn\u2019t come to this, child. But you still don\u2019t understand what sacrifices are required to maintain the peace.\u2019\u201d' },
  { name: 'Take away an opportunity permanently.', example: '\u201cThe door slams shut, cutting you off from the vault as the temple continues to collapse. You\u2019ll need to find another exit if you want to make it out alive.\u201d' },
];

export const ROLE_MOVES = {
  bruiser:  'The {name} roars in anger, preparing for its next strike. The next time the {name} attacks, it gains an additional 1d4 to its attack roll.',
  horde:    'The {name} rally together, gaining strength. They clear 1 HP or 1 Stress.',
  leader:   'The {name} encourages one of their allies, giving them advantage on their next attack roll.',
  minion:   'The {name} moves into a better position, surrounding the target.',
  ranged:   'The {name} focuses for their next attack, adding +X to the damage of their next attack if it hits.',
  skulk:    'The {name} retreats to a better position, disengaging from the PCs.',
  standard: 'The {name} braces for the next attack. Their difficulty increases by 1 until the next GM Turn.',
  support:  'The {name} clears a condition on themselves or someone else.',
};

const ATTACK_DESC_RE = /^([+-]?\d+)\s+(Melee|Very Close|Close|Far|Very Far)\s*\|\s*([^\s]+)\s+(\w+)$/i;
const DICE_PATTERN_RE = /\d+d\d+(?:[+-]\d+)?/gi;

export function emptyGmMovesMenu() {
  return { Passives: [], Reactions: [], 'Fear Actions': [], Actions: [] };
}

/**
 * Deduplicated GM Moves rows by adversary library id (one type once).
 * Reserved / defeated adversary types are omitted; environments always contribute.
 *
 * @param {Array<object>} activeElements
 * @param {number} characterCount
 * @returns {{ Passives: object[], Reactions: object[], 'Fear Actions': object[], Actions: object[] }}
 */
export function buildConsolidatedGmMovesMenu(activeElements, characterCount) {
  const menu = emptyGmMovesMenu();
  const seenAdvIds = new Set();
  const adversaryIdsWithAlive = new Set();
  for (const el of activeElements || []) {
    if (el.elementType === 'adversary' && isAdversaryPresentForParty(el, characterCount) && !isAdversaryDefeated(el)) {
      adversaryIdsWithAlive.add(el.id);
    }
  }

  for (const element of activeElements || []) {
    if (element.elementType === 'adversary') {
      if (!isAdversaryPresentForParty(element, characterCount)) continue;
      if (!adversaryIdsWithAlive.has(element.id)) continue;
      if (seenAdvIds.has(element.id)) continue;
      seenAdvIds.add(element.id);
    }

    const cardKey = element.elementType === 'adversary'
      ? element.id
      : element.instanceId;

    if (element.attack && element.attack.name) {
      menu.Actions.push({
        id: `${element.instanceId}-attack`,
        name: element.attack.name,
        type: 'action',
        description: `${element.attack.modifier >= 0 ? '+' : ''}${element.attack.modifier} ${element.attack.range} | ${element.attack.damage} ${element.attack.trait?.toLowerCase()}`,
        sourceName: element.name,
        cardKey,
        featureKey: 'attack',
        _rollData: {
          modifier: element.attack.modifier || 0,
          range: element.attack.range || 'Melee',
          damage: element.attack.damage || 'd6',
          trait: element.attack.trait || 'phy',
        },
      });
    }

    (element.features || []).forEach((feature, featureIdx) => {
      const category = parseFeatureCategory(feature);
      const m = feature.type === 'action' && feature.description ? ATTACK_DESC_RE.exec(feature.description) : null;
      const dicePatterns = feature.description
        ? [...feature.description.matchAll(DICE_PATTERN_RE)].map((dm) => dm[0])
        : [];
      const includeAttack = /\bmakes?\b.*?\battack\b/is.test(feature.description || '');
      menu[category].push({
        ...feature,
        sourceName: element.name,
        cardKey,
        featureKey: `feat-${featureIdx}`,
        _rollData: m ? {
          modifier: parseInt(m[1], 10),
          range: m[2],
          damage: m[3],
          trait: m[4],
        } : null,
        _diceRoll: !m && (dicePatterns.length > 0 || includeAttack) ? {
          patterns: dicePatterns,
          includeAttack,
          attackModifier: includeAttack ? (element.attack?.modifier ?? 0) : null,
          attackDamage: includeAttack && dicePatterns.length === 0 ? (element.attack?.damage || null) : null,
          attackTrait: includeAttack && dicePatterns.length === 0 ? (element.attack?.trait || null) : null,
          attackRange: includeAttack && dicePatterns.length === 0 ? (element.attack?.range || 'Melee') : null,
        } : null,
      });
    });

    if (element.elementType === 'adversary') {
      const role = (element.role || 'standard').toLowerCase();
      const template = ROLE_MOVES[role];
      if (template) {
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
        menu.Actions.push({
          id: `${element.instanceId}-role-move`,
          name: `${roleLabel} Move`,
          type: 'action',
          description: template.replace(/\{name\}/g, element.name),
          sourceName: element.name,
          cardKey,
          featureKey: 'role-move',
          _isRoleMove: true,
        });
      }
    }
  }
  return menu;
}

export function gmMovesMenuCount(menu) {
  return Object.values(menu || {}).reduce((sum, rows) => sum + (rows?.length || 0), 0);
}
