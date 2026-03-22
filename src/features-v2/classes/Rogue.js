import { when, isActing, isTargeted } from '../engine/when.js';
import { queueInternalMutation } from '../engine/table.js';

/**
 * Rogue class features — SRD: daggerheart-srd/classes/Rogue.md
 */

export const RoguesDodge = {
  name: "Rogue's Dodge",
  description:
    'Spend 3 Hope to gain a +2 bonus to your Evasion until the next time an attack succeeds against you. Otherwise, this bonus lasts until your next rest.',
  hopeCost: 3,
  onUse(table) {
    table.feature.set('roguesDodgeActive', true);
  },
  hooks: {
    onIntent: when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      (table) => table.feature.get('roguesDodgeActive') === true,
      (table) => {
        queueInternalMutation(table, 'addTemporaryStatMod', {
          instanceId: table.me.instanceId,
          stat: 'evasion',
          value: 2,
        });
      }
    ),
    onResolve: when(
      isTargeted,
      (table) => table.action?.type === 'attack',
      (table) => table.feature.get('roguesDodgeActive') === true,
      (table) => {
        if (table.rolls?.action?.isSuccess === true) {
          table.feature.set('roguesDodgeActive', false);
        }
      }
    ),
    onRest(table) {
      table.feature.set('roguesDodgeActive', false);
    },
  },
};

function batchAddsHiddenToMe(table) {
  return (table.mutationBatch || []).some(
    (m) =>
      m.type === 'addCondition' &&
      m.payload?.instanceId === table.me?.instanceId &&
      m.payload?.condition === 'Hidden'
  );
}

/**
 * After the rogue's token moves: drop Cloaked if they end within Far or closer of a placed adversary.
 * Open-map proxy for "line of sight" (no walls). Beyond Very Far range, concealment may still apply.
 */
function rogueEndedMoveInSightOfAdversary(table) {
  const mover = table.tokenMove?.mover;
  const me = table.me;
  if (!mover || !me?.isCharacter) return false;
  if (mover.instanceId !== me.instanceId) return false;
  if (!me.hasCondition('Cloaked')) return false;
  for (const adv of table.adversaries || []) {
    const band = me.rangeFrom(adv);
    if (band == null || band === 'veryFar') continue;
    return true;
  }
  return false;
}

export const Cloaked = {
  name: 'Cloaked',
  description:
    'Any time you would be Hidden, you are instead Cloaked. In addition to the benefits of the Hidden condition, while Cloaked you remain unseen if you are stationary when an adversary moves to where they would normally see you. After you make an attack or end a move within line of sight of an adversary, you are no longer Cloaked.',
  hooks: {
    onStateChange: when(batchAddsHiddenToMe, (table) => {
      table.me.removeCondition('Hidden');
      table.me.addCondition('Cloaked');
    }),
    onResolve: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.me.hasCondition('Cloaked'),
      (table) => table.me.removeCondition('Cloaked')
    ),
    onTokenMove: when(rogueEndedMoveInSightOfAdversary, (table) => {
      table.me.removeCondition('Cloaked');
    }),
  },
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

export const SneakAttack = {
  name: 'Sneak Attack',
  description:
    'When you succeed on an attack while Cloaked or while an ally is within Melee range of your target, add a number of d6s equal to your tier to your damage roll.',
  hooks: {
    onReviewAction: when(
      isActing,
      (table) => table.action?.type === 'attack',
      (table) => table.rolls?.action?.isSuccess === true,
      (table) => {
        const cloaked = table.me.hasCondition('Cloaked');
        const allyFlank = allyInMeleeOfTarget(table);
        if (!cloaked && !allyFlank) return;
        const n = sneakAttackDiceCount(table);
        if (n <= 0) return;
        table.rolls?.damage?.addDie({
          name: 'Sneak Attack',
          die: `${n}d6`,
        });
      }
    ),
  },
};
