import { when, isActing, anAttackSucceeds, againstYou, unwrap, youSucceedOnAnAttack } from '../engine/when.js';
import { buildTableSnapshot } from '../engine/table.js';

/**
 * Rogue class features — SRD: daggerheart-srd/classes/Rogue.md
 */

const ROGUE_DODGE_KEY = "Rogue's Dodge";

function roguesDodgeActive(table) {
  return table.feature.get('roguesDodgeActive') === true;
}

export const RoguesDodge = {
  name: ROGUE_DODGE_KEY,
  description:
    'Spend 3 Hope to gain a +2 bonus to your Evasion until the next time an attack succeeds against you. Otherwise, this bonus lasts until your next rest.',
  hopeCost: 3,
  passiveStatMods: when(roguesDodgeActive, { evasion: 2 }),
  onUse(table) {
    table.feature.set('roguesDodgeActive', true);
  },
  hooks: {
    onResolve: when(anAttackSucceeds, againstYou, roguesDodgeActive, (table) => {
      table.feature.set('roguesDodgeActive', false);
    }),
    onRest(table) {
      table.feature.set('roguesDodgeActive', false);
    },
  },
};

/**
 * Evasion bonus while Rogue's Dodge is active — unwraps {@link RoguesDodge.passiveStatMods} for
 * client defense math (`getEvasionModifierTotal` / `effectiveEvasion`).
 */
export function resolveRoguesDodgePassiveEvasion(character = {}) {
  const ownerId = character.instanceId || character.id;
  if (!ownerId) return 0;
  const table = buildTableSnapshot({
    activeElements: [{ ...character, elementType: 'character', instanceId: ownerId }],
    _ownerInstanceId: ownerId,
    _featureKey: ROGUE_DODGE_KEY,
    featureState: character.featureState,
  });
  const mods = unwrap(RoguesDodge.passiveStatMods, table);
  return typeof mods?.evasion === 'number' ? mods.evasion : 0;
}

export const Cloaked = {
  name: 'Cloaked',
  description:
    'Any time you would be Hidden, you are instead Cloaked. In addition to the benefits of the Hidden condition, while Cloaked you remain unseen if you are stationary when an adversary moves to where they would normally see you. After you make an attack or end a move within line of sight of an adversary, you are no longer Cloaked.',
  chips: [
    {
      placements: ['card'],
      isToggle: true,
      onUse(table, chipState) {
        chipState.isOn ? table.me.addCondition('Cloaked') : table.me.removeCondition('Cloaked');
      },
    },
  ],
};

function allyInMeleeOfTarget(table) {
  const target = table.action?.target;
  if (!target?.instanceId) return false;
  const selfId = table.me?.instanceId;
  for (const c of table.characters || []) {
    if (c.instanceId === selfId) continue;
    if (c.rangeFrom(target) === 'melee') return true;
  }
  return false;
}

function sneakAttackDiceCount(table) {
  const lv = table.me?.level ?? 1;
  if (lv <= 1) return 1;
  if (lv <= 4) return 2;
  if (lv <= 7) return 3;
  return 4;
}

function sneakAttackEligible(table) {
  return table.me.hasCondition('Cloaked') || allyInMeleeOfTarget(table);
}

function applySneakAttackDice(table) {
  const n = sneakAttackDiceCount(table);
  if (n <= 0) return;
  table.rolls?.damage?.addDie({
    name: 'Sneak Attack',
    die: `${n}d6`,
  });
}

export const SneakAttack = {
  name: 'Sneak Attack',
  description:
    'When you succeed on an attack while Cloaked or while an ally is within Melee range of your target, add a number of d6s equal to your tier to your damage roll.',
  chips: [
    when(
      youSucceedOnAnAttack,
      sneakAttackEligible,
      {
        name: 'Sneak Attack',
        placements: ['reviewAction'],
        description: 'Add your Sneak Attack dice (tier in d6) to this damage roll.',
        onUse(table) {
          applySneakAttackDice(table);
        },
      }
    ),
  ],
};
